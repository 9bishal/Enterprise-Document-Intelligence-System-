import time
import os
import re
from typing import List, Dict, Any, TypedDict, Annotated
import operator
# pyrefly: ignore [missing-import]
from langgraph.graph import StateGraph, END
from app.vector_store import query_vector_store
from app.llm_helper import call_llm, call_llm_json

# Cache, cost tracking, and metrics integration (graceful if Redis unavailable)
_cache_enabled = False
_semantic_cache = None
_evaluation_cache = None
_cost_tracker = None
_metrics = {}

def _init_cache():
    global _cache_enabled, _semantic_cache, _evaluation_cache, _cost_tracker, _metrics
    if _cache_enabled:
        return
    try:
        from django_backend.cache.semantic_cache import SemanticResponseCache
        from django_backend.cache.domain_caches import EvaluationCache
        from django_backend.cost_tracking.tracker import cost_tracker as ct
        from django_backend.cost_tracking.pricing import estimate_cost as ec, count_tokens as ctk
        from django_backend.monitoring.metrics import RAG_QUERIES_TOTAL, RAG_LATENCY, RAG_COST_TOTAL
        _semantic_cache = SemanticResponseCache()
        _evaluation_cache = EvaluationCache()
        _cost_tracker = ct
        _metrics = {
            "queries_total": RAG_QUERIES_TOTAL,
            "latency": RAG_LATENCY,
            "cost_total": RAG_COST_TOTAL,
            "estimate_cost": ec,
            "count_tokens": ctk,
        }
        _cache_enabled = True
    except Exception:
        _cache_enabled = False


# Fast-path flags (grounded-rag-bot ideas, same logic, fewer LLM calls).
# INTRADOC_FAST_PATH=1 (default): retrieve -> generate -> end, skipping the two
# grading LLM calls + regen loop + judge LLM. Old path still available with =0.
def _fast_path_enabled() -> bool:
    return os.getenv("INTRADOC_FAST_PATH", "1").lower() not in ("0", "false", "no")


def _plain_text_enabled() -> bool:
    return os.getenv("INTRADOC_PLAIN_TEXT", "1").lower() not in ("0", "false", "no")


def _fast_max_context_tokens(default: int) -> int:
    try:
        return int(os.getenv("INTRADOC_FAST_CONTEXT_TOKENS", "1500"))
    except ValueError:
        return 1500
    return default


# Deterministic complexity router (same idea as grounded-rag-bot router_agent:
# regex heuristic, zero LLM cost). Only used when INTRADOC_ROUTE_MODELS=1 so we
# never override the admin-configured model by surprise.
_COMPLEX_SIGNALS = re.compile(
    r"\b(why|explain|compare|contrast|analyz\w*|summar\w*|evaluate|assess"
    r"|implications?|trade-?offs?|pros and cons|elaborate|walk me through"
    r"|how do(es)?|how would|what happens if|relationship between)\b",
    re.IGNORECASE,
)


def _maybe_route_model(question: str, model_config: Dict[str, Any]) -> Dict[str, Any]:
    if os.getenv("INTRADOC_ROUTE_MODELS", "0").lower() not in ("1", "true", "yes"):
        return model_config
    q = (question or "").strip()
    if not q:
        return model_config
    complex_q = bool(_COMPLEX_SIGNALS.search(q)) or q.count("?") > 1 or len(q.split()) >= 14
    if complex_q:
        return model_config
    routed = dict(model_config)
    fast_model = os.getenv("INTRADOC_FAST_MODEL", "llama-3.1-8b-instant")
    # Only reroute Groq chat models; never touch Gemini/OpenAI admin choice.
    if str(routed.get("provider", "")).lower() == "groq":
        routed["model"] = fast_model
    return routed


# Define state schema
class AgentState(TypedDict):
    question: str
    documents: List[Dict[str, Any]]
    generation: str
    steps: Annotated[List[str], operator.add]
    web_search: bool
    api_keys: Dict[str, str]
    model_config: Dict[str, Any]
    regenerate_count: int
    critique: str
    user_doc_ids: List[str]
    department: str
    admin_all: bool
    refuse: bool
    cache_hit: bool
    model_used: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    estimated_cost_usd: float
    start_time: float
    context_block: str


# 1. Retrieve Node
def retrieve_node(state: AgentState) -> Dict[str, Any]:
    print("---RETRIEVING---")
    question = state["question"]
    k = state["model_config"].get("k", 4)
    user_doc_ids = state.get("user_doc_ids", None)
    department = state.get("department", None)
    admin_all = state.get("admin_all", False)
    max_context_tokens = state["model_config"].get("max_context_tokens", 3000)

    retrieved_docs = query_vector_store(
        question, n_results=k, doc_ids=user_doc_ids,
        department=department, admin_all=admin_all, use_hybrid=True
    )

    from app.retrieval.reranker import rerank
    ranked = rerank(question, retrieved_docs, top_k=k)

    from app.retrieval.context_builder import build_context
    budget = _fast_max_context_tokens(max_context_tokens) if _fast_path_enabled() else max_context_tokens
    context_block, used_chunks = build_context(ranked, max_context_tokens=budget)

    return {
        "documents": used_chunks,
        "context_block": context_block,
        "steps": ["retrieve"]
    }


# 2. Grade Documents Node
def grade_documents_node(state: AgentState) -> Dict[str, Any]:
    print("---GRADING DOCUMENTS---")
    # Fast path: deterministic guard only (no LLM call). If retrieval found
    # chunks, keep them; else trigger the local repo-audit fallback.
    # Weak grounding (all noise) refuses locally: no LLM, no citations.
    if _fast_path_enabled():
        docs = state.get("documents", [])
        if not docs:
            return {
                "documents": [],
                "web_search": True,
                "refuse": False,
                "steps": ["grade_documents"],
            }
        if _is_weak_grounding(docs):
            print(f"---WEAK GROUNDING (top sim below threshold), refusing locally---")
            return {
                "documents": [],
                "web_search": False,
                "refuse": True,
                "generation": WEAK_GROUNDING_REPLY,
                "model_used": "grounding_guard",
                "cache_hit": False,
                "steps": ["grade_documents"],
            }
        return {
            "documents": docs,
            "web_search": False,
            "refuse": False,
            "steps": ["grade_documents"],
        }
    question = state["question"]
    documents = state["documents"]
    api_keys = state["api_keys"]
    model_config = state["model_config"]

    filtered_docs = []
    web_search = False

    if not documents:
        print("No documents retrieved, triggering web search...")
        return {"documents": [], "web_search": True, "steps": ["grade_documents"]}

    docs_text = "\n\n".join(
        f"[DOC {i+1}] {d['text']}" for i, d in enumerate(documents)
    )
    prompt = f"""
    You are a strict document relevance checker. Grade each document chunk below against the user query.
    
    User Query: {question}
    
    {docs_text}
    
    Answer ONLY with a JSON object matching this schema:
    {{
        "relevance": [true or false for each document]
    }}
    Example: {{"relevance": [true, false, true, false]}}
    """

    res = call_llm_json(
        prompt=prompt,
        system_prompt="You are a precise document relevance grading assistant. Return valid JSON only.",
        provider=model_config.get("provider", "gemini"),
        api_key=api_keys.get(model_config.get("provider", "gemini"), ""),
        model_name=model_config.get("model", ""),
        temperature=0.0,
    )

    relevance_list = res.get("relevance", [])
    for i, doc in enumerate(documents):
        is_relevant = relevance_list[i] if i < len(relevance_list) else False
        if is_relevant:
            print(f"-> Document '{doc['filename']}' is RELEVANT")
            filtered_docs.append(doc)
        else:
            print(f"-> Document '{doc['filename']}' is IRRELEVANT")

    # If all documents are irrelevant, trigger web search fallback
    if not filtered_docs:
        print("All documents graded as irrelevant. Activating web search fallback.")
        web_search = True

    return {
        "documents": filtered_docs,
        "web_search": web_search,
        "steps": ["grade_documents"],
    }


# 3. Web Search Node (Refactored to Repository Status Audit)
def web_search_node(state: AgentState) -> Dict[str, Any]:
    print("---REPOSITORY STATUS AUDIT---")
    question = state["question"]
    user_doc_ids = state.get("user_doc_ids", None)
    department = state.get("department", None)

    # Attempt to query the Django database or SQLite DB to see what files are indexed
    indexed_docs = []
    try:
        # Try importing Django models (available during Django views execution)
        from django_backend.models import Document
        if user_doc_ids is not None:
            docs = Document.objects.filter(id__in=user_doc_ids, status="indexed")
        elif department:
            docs = Document.objects.filter(department=department, status="indexed")
        else:
            docs = Document.objects.filter(status="indexed")
        
        indexed_docs = [
            {
                "filename": d.filename,
                "file_size": d.file_size,
                "chunk_count": d.chunk_count,
                "status": d.status
            }
            for d in docs
        ]
    except Exception as e:
        print(f"Django Document model query not available or failed ({str(e)}), falling back to sqlite helper...")
        try:
            from app.database import get_all_documents
            all_docs = get_all_documents()
            indexed_docs = [d for d in all_docs if d.get("status") == "indexed"]
        except Exception as ex:
            print(f"Error reading documents list for status audit: {str(ex)}")
            indexed_docs = []

    if indexed_docs:
        docs_list = "\n".join(
            [
                f"- {d['filename']} (Status: Indexed, Size: {(d['file_size']/1024):.1f} KB, Chunks: {d['chunk_count']})"
                for d in indexed_docs
            ]
        )
        search_context = f"""
[Intradoc AI Repository Status Audit]
No matching information was found in the indexed documents for your query: "{question}"

Currently Indexed Files in Repository:
{docs_list}

Please inform the user that the query "{question}" is outside the context of the loaded documents. Suggest either uploading a relevant file covering this topic or refining the query parameters.
"""
    else:
        search_context = f"""
[Intradoc AI Repository Status Audit]
No documents have been indexed in the corporate repository yet. 

To resolve this and get useful answers, please upload your relevant document files (PDF, DOCX, TXT, MD) using the sidebar document uploader.
"""

    web_doc = {
        "id": "repo_status_chunk",
        "text": search_context,
        "filename": "Repository Status Audit",
        "doc_id": "repo_status",
        "page": 1,
        "chunk_index": 0,
        "similarity": 100.0,
    }

    return {"documents": [web_doc], "steps": ["web_search"]}


# 4. Generate Response Node
def _short_answers_enabled() -> bool:
    return os.getenv("INTRADOC_SHORT_ANSWERS", "1").lower() not in ("0", "false", "no")


def _generation_prompts(question: str, documents: List[Dict[str, Any]],
                        context_block: str, critique: str = "") -> tuple:
    """Build (system_prompt, prompt) for answer generation. Shared by the
    non-streaming node and the streaming pipeline so both stay identical."""
    # Use pre-built context_block from hybrid retrieval if available
    context = context_block
    if not context:
        context_list = []
        for i, doc in enumerate(documents):
            context_list.append(f"Source [{i+1}] ({doc['filename']}): {doc['text']}")
        context = "\n\n".join(context_list)

    if _short_answers_enabled():
        # Short answers: the user reads points, not the PDF. Max 5 numbered
        # points, blank line between points (renders as separate paragraphs),
        # plain text only — no *, #, |, backticks, tables or headings.
        system_prompt = """
    You are Intradoc AI, a document assistant that saves the user from reading the whole file.
    Answer ONLY from the provided document context. If the context lacks the answer, say so in one line.
    Reply in at most 5 short numbered points (1. 2. 3. ...), one idea per point, one or two lines each.
    Put a blank line between points. Lead with the direct answer first, details after.
    Plain text only: no markdown, headings, bold, italics, bullet symbols, tables, pipes, asterisks, hash signs, or code fences.
    Cite sources inline like [1], [2] matching the documents given. Skip anything the question did not ask for.
    """
    elif _plain_text_enabled():
        # Plain-text mode: same grounding rules, but no markdown artefacts
        # (*, #, |, backticks, tables) — fixes raw characters in the UI.
        system_prompt = """
    You are Intradoc AI, a professional document assistant. Answer ONLY from the provided document context.
    If the context does not contain enough information, say so plainly rather than hallucinating.
    Write in plain text only. Do NOT use markdown formatting, headings, bold, italics, bullet symbols, numbered lists, tables, pipes, asterisks, hash signs, or code fences.
    Write short sentences in simple paragraphs. Cite sources inline like [1], [2] corresponding to the documents provided.
    Be concise. Answer in the fewest sentences that fully address the question.
    """
    else:
        system_prompt = """
    You are Intradoc AI, an intelligent, professional document assistant. Answer the user's question comprehensively based ONLY on the provided document context.
    If the context does not contain enough information to answer, state that clearly rather than hallucinating.
    Structure your answer with clear headings, bullet points, or lists where helpful.
    At the end of key statements, cite the sources by appending [1], [2], etc., corresponding to the indices of the documents provided.
    """

    prompt = f"""
    Document Context:
    {context}

    User Question: {question}
    """

    # If self-correction loop is active, add critique details to help model improve
    if critique:
        prompt += f"""

        CRITICAL REVISION DIRECTIVE:
        Your previous generation was graded as not grounded in the source documents. Please revise the answer.
        Hallucination feedback: {critique}
        Make sure every sentence in your answer is strictly supported by the sources above.
        """

    return system_prompt, prompt


def generate_node(state: AgentState) -> Dict[str, Any]:
    print("---GENERATING RESPONSE---")
    question = state["question"]
    documents = state["documents"]
    api_keys = state["api_keys"]
    model_config = state["model_config"]
    critique = state.get("critique", "")
    regenerate_count = state.get("regenerate_count", 0)

    system_prompt, prompt = _generation_prompts(
        question, documents, state.get("context_block", ""), critique
    )

    from app.llm_helper import call_llm_with_fallback
    provider = model_config.get("provider", "gemini")
    primary_model = model_config.get("model", "")
    fallback_provider = model_config.get("fallback_provider", "")
    fallback_model = model_config.get("fallback_model", "")
    model_config = _maybe_route_model(question, model_config)
    # Fast path keeps the admin model choice unless INTRADOC_ROUTE_MODELS=1;
    # re-read after routing so provider/model stay consistent.
    provider = model_config.get("provider", provider)
    primary_model = model_config.get("model", primary_model)
    generation, model_used, prompt_cache_hit = call_llm_with_fallback(
        prompt=prompt,
        system_prompt=system_prompt,
        provider=provider,
        api_key=api_keys.get(provider, ""),
        primary_model=primary_model,
        fallback_provider=fallback_provider,
        fallback_model=fallback_model,
        temperature=model_config.get("temperature", 0.3),
    )

    new_count = regenerate_count
    if critique:
        new_count += 1

    # Real billed tokens for THIS generation call (grading calls in the old
    # path run after, so capture now before anything overwrites it).
    try:
        from app import llm_helper as _lh
        _ru = getattr(_lh, "_last_call_usage", {}) or {}
        gen_in, gen_out = int(_ru.get("input_tokens", 0) or 0), int(_ru.get("output_tokens", 0) or 0)
    except Exception:
        gen_in, gen_out = 0, 0

    return {
        "generation": generation,
        "model_used": model_used,
        "steps": ["generate"],
        "regenerate_count": new_count,
        "cache_hit": prompt_cache_hit,
        "input_tokens": gen_in,
        "output_tokens": gen_out,
    }


def decide_to_generate(state: AgentState) -> str:
    """
    Routes from grade_documents to web_search or generate.
    Fast path: skip the grading LLM call entirely (grounded-rag-bot uses a
    deterministic guard instead) — go straight to generate/web_search.
    """
    if _fast_path_enabled():
        if state.get("refuse"):
            return "refuse"
        return "web_search" if state.get("web_search") else "generate"
    if state["web_search"]:
        return "web_search"
    return "generate"


# 5. Grade Generation Node (Hallucination Checker)
def grade_generation_node(state: AgentState) -> Dict[str, Any]:
    print("---GRADING GENERATION (Groundedness Check)---")
    # Fast path: skip the grading LLM call entirely.
    if _fast_path_enabled():
        return {"critique": "", "steps": ["grade_generation"]}
    question = state["question"]
    documents = state["documents"]
    generation = state["generation"]
    api_keys = state["api_keys"]
    model_config = state["model_config"]

    # Don't grade if there are no source documents (e.g. error in API)
    if not documents:
        return {"critique": "", "steps": ["grade_generation"]}

    context_list = [
        f"Source [{i+1}] ({doc['filename']}): {doc['text']}"
        for i, doc in enumerate(documents)
    ]
    context = "\n\n".join(context_list)

    prompt = f"""
    You are an objective AI hallucination checker. Grade if the candidate answer is fully grounded in and supported by the retrieved document context. 
    Every single fact, statistic, or claim made in the answer MUST be explicitly present in the retrieved documents.
    
    Retrieved Context:
    {context}
    
    Candidate Answer:
    {generation}
    
    Answer ONLY with a JSON object matching this schema:
    {{
        "grounded": true or false,
        "explanation": "If false, provide a short 1-sentence critique of what claim was not supported. If true, leave empty."
    }}
    """

    res = call_llm_json(
        prompt=prompt,
        system_prompt="You are a precise binary hallucination evaluator. Return valid JSON only.",
        provider=model_config.get("provider", "gemini"),
        api_key=api_keys.get(model_config.get("provider", "gemini"), ""),
        model_name=model_config.get("model", ""),
        temperature=0.0,
    )

    is_grounded = res.get("grounded", False)
    explanation = res.get("explanation", "")

    if is_grounded:
        print("-> Generation is GROUNDED and faithful. RAG successful!")
        return {"critique": "", "steps": ["grade_generation"]}
    else:
        print(f"-> Generation is NOT GROUNDED. Hallucination feedback: {explanation}")
        return {
            "critique": explanation,
            "steps": ["grade_generation", "grade_generation_critique"],
        }


def grade_generation_router(state: AgentState) -> str:
    """
    Routes from grade_generation to generate or end for correction.
    Fast path: single generation only (no grading LLM, no regen loop).
    """
    if _fast_path_enabled():
        return "end"
    critique = state.get("critique", "")
    regenerate_count = state.get("regenerate_count", 0)
    documents = state.get("documents", [])

    if not documents:
        return "end"

    if not critique:
        return "end"
    else:
        if (
            regenerate_count < 1
        ):  # Limit to 1 regeneration attempt to save latency and tokens
            print(
                f"-> Attempting self-correction loop (attempt {regenerate_count + 1})"
            )
            return "generate"
        else:
            print(
                "-> Reached maximum self-correction attempts. Ending with current response."
            )
            return "end"


# Greeting / small-talk short-circuit (deterministic, zero retrieval, zero LLM).
# A greeting must be the WHOLE query (max 6 words, greeting words only), so
# real questions are never affected. Mirrors grounded-rag-bot's guard agent.
_GREETING_PATTERN = re.compile(
    r"^(hi+|hlo+|hello+|hey+|yo|good\s?(morning|afternoon|evening)|namaste|"
    r"how are you( doing| today)?|how'?s it going|thanks?|thank you|"
    r"bye+|goodbye|see you)"
    r"(\s+(how are you( doing| today)?))?\s*[?!.]*$",
    re.IGNORECASE,
)

GREETING_REPLY = (
    "Hello! I am Intradoc AI, your document assistant. "
    "Ask me anything about your uploaded documents and I will answer in short points with sources."
)


def is_greeting(text: str) -> bool:
    q = re.sub(r"[,;\s]+", " ", (text or "").strip().lower()).strip().strip("?!. ")
    if not q or len(q.split()) > 6:
        return False
    return bool(_GREETING_PATTERN.match(q))


# Weak-grounding guard (deterministic, zero LLM — grounded-rag-bot's guard
# agent idea). Retrieval always returns k chunks, even when all are noise
# (e.g. 34-36% similarity). Below the threshold, answering would only produce
# "no answer" text next to misleading citations — so refuse locally instead.
# Good queries in this corpus score 39%+ top-1; noise scores below. Tunable.
WEAK_GROUNDING_REPLY = (
    "I couldn't find anything relevant in your documents for that. "
    "Try rephrasing your question or upload a document that covers this topic."
)


def _min_similarity_threshold() -> float:
    # Cosine-similarity % scale (see vector_store): good matches score ~22-44,
    # noise scores ~3-18. Tunable via INTRADOC_MIN_SIMILARITY.
    try:
        return float(os.getenv("INTRADOC_MIN_SIMILARITY", "20"))
    except ValueError:
        return 20.0


def _is_weak_grounding(documents: List[Dict[str, Any]]) -> bool:
    if not documents:
        return False  # empty corpus stays on the repo-audit path
    top = max(float(d.get("similarity", 0) or 0) for d in documents)
    return top < _min_similarity_threshold()


def _cacheable_answer(text: str) -> bool:
    """Never cache empty responses or error text — a poisoned entry would be
    served instantly to every later similar query."""
    t = (text or "").strip()
    if not t:
        return False
    return not t.startswith(("An error occurred", "Error", "HTTP Error"))


# Helper function to detect and handle meta-queries about available documents
def is_meta_query(question: str) -> bool:
    """
    Detects if the question is a meta-query about available documents.
    """
    meta_keywords = [
        "what documents", "which documents", "list of documents",
        "available documents", "documents available", "show documents",
        "files available", "what files", "documents in the database",
        "indexed documents", "documents in vector", "stored documents"
    ]
    question_lower = question.lower()
    return any(keyword in question_lower for keyword in meta_keywords)


def get_available_documents(user_doc_ids: List[str] = None, department: str = None, admin_all: bool = False) -> List[Dict[str, Any]]:
    """
    Retrieves the list of available documents for the user.
    """
    try:
        from django_backend.models import Document
        
        if admin_all:
            docs = Document.objects.filter(status="indexed")
        elif user_doc_ids:
            docs = Document.objects.filter(id__in=user_doc_ids, status="indexed")
        elif department:
            docs = Document.objects.filter(department=department, status="indexed")
        else:
            docs = Document.objects.filter(status="indexed")
        
        available_docs = [
            {
                "filename": d.filename,
                "file_size": d.file_size,
                "chunk_count": d.chunk_count,
                "status": d.status,
                "department": d.department,
                "owner": d.user.username if d.user else "Unknown",
                "classification": d.classification or "General"
            }
            for d in docs
        ]
        return available_docs
    except Exception as e:
        print(f"Error fetching documents: {str(e)}")
        return []


def generate_meta_response(available_docs: List[Dict[str, Any]]) -> str:
    """
    Generates a natural language response listing available documents.
    """
    if not available_docs:
        return "There are currently no documents indexed in the vector database. Please upload documents first to enable RAG queries."

    if _plain_text_enabled():
        doc_list = "\n".join([
            f"- {doc['filename']} (Department: {doc['department']}, Owner: {doc['owner']}, Classification: {doc['classification']}, Chunks: {doc['chunk_count']}, Size: {(doc['file_size']/1024):.1f} KB)"
            for doc in available_docs
        ])
        response = f"""Documents Available in Vector Database

I found {len(available_docs)} indexed document(s) available for retrieval:

{doc_list}

These documents are indexed and ready for the RAG pipeline to retrieve relevant information based on your queries. Each document has been split into chunks for efficient vector similarity search.

Total Chunks: {sum(doc['chunk_count'] for doc in available_docs)}
Total Size: {sum(doc['file_size'] for doc in available_docs) / 1024 / 1024:.2f} MB
"""
        return response

    doc_list = "\n".join([
        f"• **{doc['filename']}** (Department: {doc['department']}, Owner: {doc['owner']}, Classification: {doc['classification']}, Chunks: {doc['chunk_count']}, Size: {(doc['file_size']/1024):.1f} KB)"
        for doc in available_docs
    ])
    
    response = f"""## Documents Available in Vector Database

I found **{len(available_docs)}** indexed document(s) available for retrieval:

{doc_list}

These documents are indexed and ready for the RAG pipeline to retrieve relevant information based on your queries. Each document has been split into chunks for efficient vector similarity search.

**Total Chunks**: {sum(doc['chunk_count'] for doc in available_docs)}
**Total Size**: {sum(doc['file_size'] for doc in available_docs) / 1024 / 1024:.2f} MB
"""
    return response


# Build the LangGraph StateGraph
workflow = StateGraph(AgentState)

# Add Nodes
workflow.add_node("retrieve", retrieve_node)
workflow.add_node("grade_documents", grade_documents_node)
workflow.add_node("web_search", web_search_node)
workflow.add_node("generate", generate_node)
workflow.add_node("grade_generation", grade_generation_node)

# Set Entrypoint
workflow.set_entry_point("retrieve")

# Add Static Edges
workflow.add_edge("retrieve", "grade_documents")
workflow.add_edge("web_search", "generate")
workflow.add_edge("generate", "grade_generation")

# Add Conditional Edges
workflow.add_conditional_edges(
    "grade_documents",
    decide_to_generate,
    {"web_search": "web_search", "generate": "generate", "refuse": END},
)

workflow.add_conditional_edges(
    "grade_generation", grade_generation_router, {"generate": "generate", "end": END}
)

# Compile
rag_graph = workflow.compile()


def run_rag_pipeline(question: str, api_keys: Dict[str, str], model_config: Dict[str, Any], user_doc_ids: List[str] = None, department: str = None, admin_all: bool = False) -> Dict[str, Any]:
    """
    Runs the stateful LangGraph RAG pipeline with department scoping.
    Returns the complete execution steps in the order they were executed.
    Handles meta-queries about available documents.
    """
    start_time = time.time()
    _init_cache()

    # Greetings never touch retrieval or the LLM — instant fixed reply.
    if is_greeting(question):
        latency = int((time.time() - start_time) * 1000)
        return {
            "question": question,
            "generation": GREETING_REPLY,
            "documents": [],
            "steps": ["greeting"],
            "success": True,
            "cache_hit": False,
            "model_used": "greeting",
            "input_tokens": 0,
            "output_tokens": 0,
            "estimated_cost_usd": 0.0,
            "latency_ms": latency,
        }

    # Check semantic cache first (RBAC-aware: only return hit if doc scope matches)
    if _cache_enabled:
        try:
            cached = _semantic_cache.lookup(question)
        except Exception as e:
            print(f"Semantic cache lookup failed (continuing without cache): {e}")
            cached = None
        if cached is not None:
            cached_doc_ids = set(cached.get("metadata", {}).get("doc_ids", []) or [])
            current_doc_ids = set(user_doc_ids or [])
            scope_match = (len(cached_doc_ids) == len(current_doc_ids) and cached_doc_ids == current_doc_ids)
            if scope_match:
                latency = int((time.time() - start_time) * 1000)
                model_used = "cache"
                ct = _metrics.get("count_tokens", lambda x: len(x)//4)
                ec = _metrics.get("estimate_cost", lambda m,i,o: 0.0)
                input_tokens = ct(question)
                output_tokens = ct(cached["response"])
                cost = ec(model_used, input_tokens, output_tokens)

                if _cost_tracker:
                    try:
                        _cost_tracker.record(question, cached["response"], "semantic_cache", input_tokens, output_tokens, latency / 1000, cache_hit=True)
                    except Exception as e:
                        print(f"Cost tracking failed (continuing): {e}")

                _metrics["queries_total"].labels("semantic_cache", True, True).inc()
                _metrics["cost_total"].labels("semantic_cache").inc(cost)

                return {
                    "question": question,
                    "generation": cached["response"],
                    "documents": [],
                    "steps": ["semantic_cache_hit"],
                    "success": True,
                    "cache_hit": True,
                    "model_used": "semantic_cache",
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "estimated_cost_usd": cost,
                    "latency_ms": latency,
                }

    # Check if this is a meta-query about available documents
    if is_meta_query(question):
        print("---META QUERY DETECTED---")
        available_docs = get_available_documents(user_doc_ids, department, admin_all)
        response = generate_meta_response(available_docs)
        
        meta_docs = [
            {
                "id": f"meta_{i}",
                "filename": f"{doc['filename']} (Meta)",
                "text": f"Classification: {doc['classification']}, Owner: {doc['owner']}, Department: {doc['department']}",
                "doc_id": "meta_index",
                "page": 1,
                "chunk_index": i,
                "similarity": 100.0
            }
            for i, doc in enumerate(available_docs)
        ]
        
        return {
            "question": question,
            "generation": response,
            "documents": meta_docs[:5],
            "steps": ["retrieve", "meta_query"],
            "success": True,
            "cache_hit": False,
            "model_used": "meta_query",
            "input_tokens": 0,
            "output_tokens": 0,
            "estimated_cost_usd": 0.0,
            "latency_ms": int((time.time() - start_time) * 1000),
        }
    
    initial_state = {
        "question": question,
        "documents": [],
        "generation": "",
        "steps": [],
        "web_search": False,
        "refuse": False,
        "api_keys": api_keys,
        "model_config": model_config,
        "regenerate_count": 0,
        "critique": "",
        "user_doc_ids": user_doc_ids,
        "department": department,
        "admin_all": admin_all,
        "cache_hit": False,
        "model_used": "",
        "input_tokens": 0,
        "output_tokens": 0,
        "latency_ms": 0,
        "estimated_cost_usd": 0.0,
        "start_time": start_time,
        "context_block": "",
    }

    try:
        final_state = rag_graph.invoke(initial_state)
        executed_steps = final_state.get("steps", [])
        latency = int((time.time() - start_time) * 1000)
        model = final_state.get("model_used", model_config.get("provider", "unknown"))
        generation = final_state.get("generation", "")
        ct = _metrics.get("count_tokens", lambda x: len(x)//4)
        ec = _metrics.get("estimate_cost", lambda m,i,o: 0.0)
        # Prefer real provider-reported tokens; fall back to the estimate.
        input_tokens = final_state.get("input_tokens") or ct(question)
        output_tokens = final_state.get("output_tokens") or ct(generation)
        cost = ec(model, input_tokens, output_tokens)

        if _cache_enabled:
            try:
                if _cacheable_answer(generation):
                    _semantic_cache.store(question, generation, doc_ids=user_doc_ids)
            except Exception as e:
                print(f"Semantic cache store failed (continuing): {e}")

        if _cost_tracker:
            try:
                _cost_tracker.record(question, generation, model, input_tokens, output_tokens, latency / 1000, cache_hit=False)
            except Exception as e:
                print(f"Cost tracking failed (continuing): {e}")

        if _cache_enabled:
            _metrics["queries_total"].labels(model, False, True).inc()
            _metrics["latency"].labels(model).observe(latency / 1000)
            _metrics["cost_total"].labels(model).inc(cost)

        documents = final_state.get("documents", [])
        evaluation_result = None
        try:
            from app.evaluation.evaluator import heuristic_scores, llm_judge
            evaluation_result = heuristic_scores(generation, documents)
            # Fast path: heuristic only — llm_judge is an extra Groq call in the
            # request path, so skip it (keeps 1 LLM call total per query).
            if not _fast_path_enabled():
                judge = llm_judge(question, final_state.get("context_block", ""), generation)
                if judge:
                    evaluation_result["judge"] = judge
        except Exception:
            pass

        try:
            from app.analytics import trace_chat_turn
            trace_chat_turn(
                session_id="",
                question=question,
                answer=generation,
                retrieved_chunks=documents,
                model=model,
                latency_ms=latency,
                cost_usd=cost,
                evaluation=evaluation_result,
            )
        except Exception:
            pass

        return {
            "question": final_state["question"],
            "generation": generation,
            "documents": documents,
            "steps": executed_steps,
            "success": True,
            "cache_hit": final_state.get("cache_hit", False),
            "model_used": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "estimated_cost_usd": cost,
            "latency_ms": latency,
            "evaluation": evaluation_result,
        }
    except Exception as e:
        latency = int((time.time() - start_time) * 1000)
        if _cache_enabled and "queries_total" in _metrics:
            _metrics["queries_total"].labels("error", False, False).inc()
        return {
            "question": question,
            "generation": f"An error occurred while running the RAG pipeline: {str(e)}",
            "documents": [],
            "steps": ["retrieve", "error"],
            "success": False,
            "cache_hit": False,
            "model_used": "error",
            "input_tokens": 0,
            "output_tokens": 0,
            "estimated_cost_usd": 0.0,
            "latency_ms": latency,
        }


def run_rag_stream(question: str, api_keys: Dict[str, str], model_config: Dict[str, Any],
                   user_doc_ids: List[str] = None, department: str = None,
                   admin_all: bool = False):
    """Streaming twin of run_rag_pipeline (fast path only, 1 LLM call).

    Yields event dicts: {"type": "citations", ...}, {"type": "token", "delta"},
    {"type": "done", ...}. Retrieval still runs synchronously (local, fast);
    only generation streams, so time-to-first-token drops to ~1 Groq call
    instead of waiting for grade-generate-grade to finish.
    """
    from app.llm_helper import stream_llm
    try:
        from app.llm_helper import _last_stream_usage as _stream_usage
    except Exception:
        _stream_usage = {"input_tokens": 0, "output_tokens": 0}

    start_time = time.time()
    _init_cache()
    model_config = _maybe_route_model(question, model_config)

    # Real token/cost helpers (same pricing tables as the classic path).
    try:
        from django_backend.cost_tracking.pricing import estimate_cost as _ec, count_tokens as _ct
    except Exception:
        _ec = lambda m, i, o: 0.0
        _ct = lambda x: len(x) // 4

    # Greetings never touch retrieval or the LLM — instant fixed reply.
    if is_greeting(question):
        yield {"type": "token", "delta": GREETING_REPLY}
        yield {"type": "done", "model_used": "greeting", "cache_hit": False,
               "latency_ms": int((time.time() - start_time) * 1000),
               "full_answer": GREETING_REPLY, "documents": [],
               "input_tokens": 0, "output_tokens": _ct(GREETING_REPLY),
               "estimated_cost_usd": 0.0}
        return

    # Semantic cache lookup first (same RBAC scope check as run_rag_pipeline):
    # repeat/paraphrased questions return instantly with zero Groq calls.
    if _cache_enabled:
        try:
            cached = _semantic_cache.lookup(question)
        except Exception as e:
            print(f"Semantic cache lookup failed (continuing without cache): {e}")
            cached = None
        if cached is not None:
            cached_doc_ids = set(cached.get("metadata", {}).get("doc_ids", []) or [])
            current_doc_ids = set(user_doc_ids or [])
            scope_match = (len(cached_doc_ids) == len(current_doc_ids) and cached_doc_ids == current_doc_ids)
            if scope_match:
                latency_ms = int((time.time() - start_time) * 1000)
                cached_resp = cached["response"]
                yield {"type": "citations", "citations": []}
                yield {"type": "token", "delta": cached_resp}
                yield {"type": "done", "model_used": "semantic_cache",
                       "cache_hit": True, "latency_ms": latency_ms,
                       "full_answer": cached_resp, "documents": [],
                       "input_tokens": _ct(question),
                       "output_tokens": _ct(cached_resp),
                       "estimated_cost_usd": 0.0}
                return

    # Meta-queries never touch the LLM — yield instantly.
    if is_meta_query(question):
        available_docs = get_available_documents(user_doc_ids, department, admin_all)
        response = generate_meta_response(available_docs)
        yield {"type": "token", "delta": response}
        yield {"type": "done", "model_used": "meta_query", "cache_hit": False,
               "latency_ms": int((time.time() - start_time) * 1000),
               "input_tokens": 0, "output_tokens": _ct(response),
               "estimated_cost_usd": 0.0}
        return

    # Synchronous local retrieval (vector + rerank + context budget).
    state = {
        "question": question,
        "documents": [],
        "generation": "",
        "steps": [],
        "web_search": False,
        "api_keys": api_keys,
        "model_config": model_config,
        "regenerate_count": 0,
        "critique": "",
        "user_doc_ids": user_doc_ids,
        "department": department,
        "admin_all": admin_all,
        "cache_hit": False,
        "model_used": "",
        "input_tokens": 0,
        "output_tokens": 0,
        "latency_ms": 0,
        "estimated_cost_usd": 0.0,
        "start_time": start_time,
        "context_block": "",
    }
    try:
        ret = retrieve_node(state)
        state.update({k: v for k, v in ret.items() if k in state or k == "context_block"})
        state["context_block"] = ret.get("context_block", "")
        state["documents"] = ret.get("documents", [])
        # Weak grounding: refuse locally — no LLM call, no citations.
        if state["documents"] and _is_weak_grounding(state["documents"]):
            yield {"type": "citations", "citations": []}
            yield {"type": "token", "delta": WEAK_GROUNDING_REPLY}
            latency_ms = int((time.time() - start_time) * 1000)
            yield {"type": "done", "model_used": "grounding_guard",
                   "cache_hit": False, "latency_ms": latency_ms,
                   "full_answer": WEAK_GROUNDING_REPLY, "documents": [],
                   "input_tokens": 0, "output_tokens": _ct(WEAK_GROUNDING_REPLY),
                   "estimated_cost_usd": 0.0}
            return
        if not state["documents"]:
            audit = web_search_node(state)
            state["documents"] = audit.get("documents", [])

        yield {"type": "citations", "citations": state["documents"]}

        system_prompt, prompt = _generation_prompts(
            question, state["documents"], state.get("context_block", "")
        )
        provider = model_config.get("provider", "groq")
        model = model_config.get("model", "")
        full_answer = ""
        for delta in stream_llm(
            prompt=prompt, system_prompt=system_prompt, provider=provider,
            api_key=api_keys.get(provider, ""), model_name=model,
            temperature=model_config.get("temperature", 0.3),
        ):
            full_answer += delta
            yield {"type": "token", "delta": delta}

        latency_ms = int((time.time() - start_time) * 1000)
        try:
            from app.llm_helper import to_plain_text, _plain_text_enabled
            if _plain_text_enabled():
                full_answer = to_plain_text(full_answer)
        except Exception:
            pass
        if _cache_enabled:
            try:
                if _cacheable_answer(full_answer):
                    _semantic_cache.store(question, full_answer, doc_ids=user_doc_ids)
            except Exception:
                pass
        in_tok = int(_stream_usage.get("input_tokens", 0) or 0) or _ct(system_prompt + question)
        out_tok = int(_stream_usage.get("output_tokens", 0) or 0) or _ct(full_answer)
        yield {"type": "done", "model_used": model or provider,
               "cache_hit": False, "latency_ms": latency_ms,
               "full_answer": full_answer,
               "documents": state["documents"],
               "input_tokens": in_tok, "output_tokens": out_tok,
               "estimated_cost_usd": _ec(model or provider, in_tok, out_tok)}
    except Exception as e:
        yield {"type": "token", "delta": f"An error occurred: {str(e)}"}
        yield {"type": "done", "model_used": "error", "cache_hit": False,
               "latency_ms": int((time.time() - start_time) * 1000),
               "input_tokens": 0, "output_tokens": 0, "estimated_cost_usd": 0.0}

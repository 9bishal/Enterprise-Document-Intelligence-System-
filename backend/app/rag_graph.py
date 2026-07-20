from typing import List, Dict, Any, TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, END
from app.vector_store import query_vector_store
from app.llm_helper import call_llm, call_llm_json


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


# 1. Retrieve Node
def retrieve_node(state: AgentState) -> Dict[str, Any]:
    print("---RETRIEVING---")
    question = state["question"]
    k = state["model_config"].get("k", 4)
    user_doc_ids = state.get("user_doc_ids", None)
    department = state.get("department", None)
    admin_all = state.get("admin_all", False)
    
    # Query Chroma DB with department scoping and user-specific document filter
    retrieved_docs = query_vector_store(
        question, n_results=k, doc_ids=user_doc_ids,
        department=department, admin_all=admin_all
    )
    
    return {
        "documents": retrieved_docs,
        "steps": ["retrieve"]
    }


# 2. Grade Documents Node
def grade_documents_node(state: AgentState) -> Dict[str, Any]:
    print("---GRADING DOCUMENTS---")
    question = state["question"]
    documents = state["documents"]
    api_keys = state["api_keys"]
    model_config = state["model_config"]

    filtered_docs = []
    web_search = False

    if not documents:
        print("No documents retrieved, triggering web search...")
        return {"documents": [], "web_search": True, "steps": ["grade_documents"]}

    for doc in documents:
        prompt = f"""
        You are a strict document relevance checker. Decide if the document chunk below is relevant to the user query.
        
        User Query: {question}
        Document Chunk: {doc['text']}
        
        Answer ONLY with a JSON object matching this schema:
        {{
            "relevant": true or false
        }}
        """

        res = call_llm_json(
            prompt=prompt,
            system_prompt="You are a precise binary document relevance grading assistant. Return valid JSON only.",
            provider=model_config.get("provider", "gemini"),
            api_key=api_keys.get(model_config.get("provider", "gemini"), ""),
            model_name=model_config.get("model", ""),
            temperature=0.0,
        )

        is_relevant = res.get("relevant", False)
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
def generate_node(state: AgentState) -> Dict[str, Any]:
    print("---GENERATING RESPONSE---")
    question = state["question"]
    documents = state["documents"]
    api_keys = state["api_keys"]
    model_config = state["model_config"]
    critique = state.get("critique", "")
    regenerate_count = state.get("regenerate_count", 0)

    # Construct context string
    context_list = []
    for i, doc in enumerate(documents):
        context_list.append(f"Source [{i+1}] ({doc['filename']}): {doc['text']}")
    context = "\n\n".join(context_list)

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

    generation = call_llm(
        prompt=prompt,
        system_prompt=system_prompt,
        provider=model_config.get("provider", "gemini"),
        api_key=api_keys.get(model_config.get("provider", "gemini"), ""),
        model_name=model_config.get("model", ""),
        temperature=model_config.get("temperature", 0.3),
    )

    new_count = regenerate_count
    if critique:
        new_count += 1

    return {
        "generation": generation,
        "steps": ["generate"],
        "regenerate_count": new_count,
    }


def decide_to_generate(state: AgentState) -> str:
    """
    Routes from grade_documents to web_search or generate.
    """
    if state["web_search"]:
        return "web_search"
    return "generate"


# 5. Grade Generation Node (Hallucination Checker)
def grade_generation_node(state: AgentState) -> Dict[str, Any]:
    print("---GRADING GENERATION (Groundedness Check)---")
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
    """
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
                "owner": d.owner.username if d.owner else "Unknown",
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
    {"web_search": "web_search", "generate": "generate"},
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
    
    # Check if this is a meta-query about available documents
    if is_meta_query(question):
        print("---META QUERY DETECTED---")
        available_docs = get_available_documents(user_doc_ids, department, admin_all)
        response = generate_meta_response(available_docs)
        
        # Create synthetic documents for the response (for display purposes)
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
            "documents": meta_docs[:5],  # Show max 5 in sidebar for space
            "steps": ["retrieve", "meta_query"],
            "success": True,
        }
    
    initial_state = {
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
        "admin_all": admin_all
    }

    try:
        final_state = rag_graph.invoke(initial_state)

        # The steps list contains all executed steps in order (due to operator.add)
        executed_steps = final_state.get("steps", [])

        return {
            "question": final_state["question"],
            "generation": final_state["generation"],
            "documents": final_state["documents"],
            "steps": executed_steps,
            "success": True,
        }
    except Exception as e:
        return {
            "question": question,
            "generation": f"An error occurred while running the RAG pipeline: {str(e)}",
            "documents": [],
            "steps": ["retrieve", "error"],
            "success": False,
        }

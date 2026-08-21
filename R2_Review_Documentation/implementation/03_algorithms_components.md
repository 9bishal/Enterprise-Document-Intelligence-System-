# Algorithms & Components Implementation

## Core Algorithms Implemented

### 1. Hybrid Retrieval (Vector + Keyword)

**Location**: `backend/app/vector_store.py` → `query_vector_store()`

```python
def query_vector_store(query, n_results=4, doc_ids=None, department=None, admin_all=False, use_hybrid=True):
    # 1. Vector search (cosine similarity)
    vector_results = chroma.query(query_embedding, n_results, where=where_clause)

    # 2. Keyword search (BM25 via ChromaDB where_document)
    keyword_results = chroma.query(query_texts=[query], n_results, where=where_clause)

    # 3. Reciprocal Rank Fusion (RRF)
    fused = reciprocal_rank_fusion(vector_results, keyword_results, k=60)

    return fused[:n_results]
```

**Parameters**: k=4 default, hybrid toggle, department filter, doc_id filter

---

### 2. Cross-Encoder Reranking-User ```

Query
↓
Vector Search
↓
Top 10–20 candidate documents
↓
Cross-Encoder Reranker ← this code
↓
Top 4 most relevant documents
↓
LLM
↓
Answer

````

**Location**: `backend/app/retrieval/reranker.py`

```python
def rerank(query, documents, top_k=4):
    cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
    pairs = [(query, doc['text']) for doc in documents]
    scores = cross_encoder.predict(pairs)
    return sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)[:top_k]
````

**Model**: ms-marco-MiniLM-L-6-v2 (fast, 22M params)
**Input**: Query + candidate passages
**Output**: Relevance scores, top-k selection

---

### 3. Context Window Optimization

**Location**: `backend/app/retrieval/context_builder.py`

```python
def build_context(ranked_docs, max_context_tokens=3000):
    context_parts = []
    used_chunks = []
    token_count = 0

    for doc, score in ranked_docs:
        chunk_tokens = count_tokens(doc['text'])
        if token_count + chunk_tokens > max_context_tokens:
            break
        context_parts.append(f"[Source {len(used_chunks)+1}] {doc['text']}")
        used_chunks.append(doc)
        token_count += chunk_tokens

    return "\n\n".join(context_parts), used_chunks
```

**Strategy**: Greedy fill by relevance score, token budget enforcement

---

### 4. LLM-Based Document Grading

**Location**: `backend/app/rag_graph.py` → `grade_documents_node()`

```python
GRADING_PROMPT = """
You are a grader assessing relevance of a retrieved document to a user question.
Grade as "relevant" or "not_relevant". Return JSON: {"relevant": true/false}
"""
```

**Process**: Batch LLM calls for each retrieved chunk → filter → if < 2 relevant, trigger web search

---

### 5. Generation Grading (Faithfulness)

**Location**: `backend/app/evaluation/evaluator.py`

```python
FAITHFULNESS_PROMPT = """
Assess if the answer is grounded in the provided context.
Check each claim in answer against context.
Return JSON: {"faithful": true/false, "unsupported_claims": [], "score": 0.0-1.0}
"""
```

**Metrics**: Faithfulness score (0-1), unsupported claims list, binary pass/fail

---

### 6. Generation Critique

**Location**: `backend/app/rag_graph.py` → `critique_generation_node()`

```python
CRITIQUE_PROMPT = """
Critique the answer for: completeness, clarity, conciseness, tone.
Return JSON with scores (1-5) and improvement suggestions.
"""
```

**Output**: Structured critique for potential regeneration

---

### 7. Reciprocal Rank Fusion (RRF)

**Location**: `backend/app/vector_store.py`

```python
def reciprocal_rank_fusion(results_list, k=60):
    scores = defaultdict(float)
    for results in results_list:
        for rank, doc_id in enumerate(results):
            scores[doc_id] += 1 / (k + rank + 1)
    return sorted(scores.keys(), key=scores.get, reverse=True)
```

**Why RRF**: No score normalization needed, robust across different retrievers

---

## Key Components Summary

| Component           | File                 | Lines | Complexity                          |
| ------------------- | -------------------- | ----- | ----------------------------------- |
| **RAG Graph**       | `rag_graph.py`       | ~700  | High (LangGraph state machine)      |
| **Vector Store**    | `vector_store.py`    | ~250  | Medium (ChromaDB wrapper)           |
| **LLM Helper**      | `llm_helper.py`      | ~330  | High (4 providers, fallback, cache) |
| **Reranker**        | `reranker.py`        | ~80   | Medium (CrossEncoder)               |
| **Context Builder** | `context_builder.py` | ~100  | Medium                              |
| **Evaluator**       | `evaluator.py`       | ~150  | Medium (faithfulness + critique)    |

---

## Data Models (PostgreSQL)

```python
# Core Models
UserProfile          # role, department (extends User)
Document             # filename, dept, status, classification, risk
ChatSession          # user, name, created_at
ChatMessage          # session, role, content, sources(JSON), steps(JSON)
LLMConfig            # singleton: provider, model, temp, k, encrypted_keys
UserInvitation       # email, otp, role, dept, expiry
PasswordResetOTP     # email, otp, created_at
```

---

## API Endpoints Summary

| Module        | Endpoints                                | Count |
| ------------- | ---------------------------------------- | ----- |
| **Auth**      | login, signup, logout, me, forgot, reset | 6     |
| **Chat**      | sessions CRUD, messages, query           | 5     |
| **Documents** | upload, list, delete, reindex            | 4     |
| **Admin**     | users, metrics, graph, llm-config        | 4     |
| **Config**    | llm-config (get/update)                  | 2     |

**Total**: 21 REST endpoints

---

## Configuration Management

| Config             | Location                          | Runtime Override      |
| ------------------ | --------------------------------- | --------------------- |
| Embedding model    | `INTRADOC_EMBEDDING_MODEL` env    | No                    |
| LLM provider/model | Admin Console → DB                | Yes (if not enforced) |
| API Keys           | Admin Console → DB (encrypted)    | Admin only            |
| Temperature / K    | Admin Console + User Settings     | Yes (if not enforced) |
| Chunk size/overlap | `vector_store.py` constants       | Code change           |
| Context window     | `context_builder.py` default 3000 | Per-query via config  |

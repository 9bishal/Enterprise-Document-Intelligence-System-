# Viva Preparation Guide

## Expected Questions by Category

### 1. Architecture & Design (C4 - 8 marks)

**Q: Explain the overall system architecture.**
> **Answer**: Frontend (React/Vite) communicates via REST API with JWT auth to Django backend. Backend orchestrates RAG pipeline using LangGraph. Documents stored in PostgreSQL (metadata) + ChromaDB (vectors). Department-scoped retrieval enforced at query level. Admin console manages users, config, analytics.

**Q: Why LangGraph over simple chain?**
> **Answer**: LangGraph provides stateful workflow with cycles (regeneration), conditional edges (web search fallback), parallel execution support, and built-in checkpointing. Each node (retrieve, grade, generate, critique) can be independently tested and replaced.

**Q: How is department isolation enforced?**
> **Answer**: At vector store query level using ChromaDB `where` clause. User's department from JWT profile. Admin can query "All" or specific dept. Non-admin locked to their dept. Verified in unit tests.

**Q: Explain the LLM provider abstraction.**
> **Answer**: Strategy pattern in `llm_helper.py`. Single `call_llm()` interface. Provider-specific functions handle auth, formatting, errors. Fallback chain: configured → Groq → Gemini → OpenAI → env vars. Caching and metrics decorators.

---

### 2. Implementation Details (C1, C2 - 8 marks)

**Q: Walk through document ingestion pipeline.**
> **Answer**: Upload → Save Document record (status=processing) → Extract text (pdfplumber/docx) → Chunk (RecursiveCharacterTextSplitter, 1000/200) → Embed (sentence-transformers/all-MiniLM-L6-v2, batch 64) → Store in ChromaDB with metadata (doc_id, dept, page) → Update status=indexed.

**Q: How does the RAG pipeline handle insufficient context?**
> **Answer**: Grade Documents node uses LLM to judge relevance of each chunk. If < 2 relevant chunks found, conditional edge triggers Web Search node (SerpAPI). Web results added to context before Generate node.

**Q: How is faithfulness measured?**
> **Answer**: Grade Generation node prompts LLM to verify each claim in answer against provided context. Returns JSON with faithful score (0-1), unsupported claims list. If score < threshold, regeneration triggered (max 2 retries).

**Q: Explain API key encryption.**
> **Answer**: Fernet (AES-128) with key derived from Django SECRET_KEY via SHA256. Keys encrypted on save, decrypted only at runtime in `llm_helper.py`. Never logged or exposed in API responses.

---

### 3. Testing & Validation (C3 - 4 marks)

**Q: What is your test strategy?**
> **Answer**: Pyramid - Unit (23 tests, 87% coverage): auth, permissions, vector store, LLM helper, RAG graph. Integration: API endpoints with test DB. E2E: 5 critical paths manually validated. Load test: 10 concurrent users, 3.2 RPS.

**Q: How do you test department isolation?**
> **Answer**: Unit test creates docs in different depts, queries with different user roles, asserts correct filtering. Integration test with multi-user scenario.

**Q: How do you handle rate limit errors?**
> **Answer**: LLM helper catches rate limit errors, triggers fallback to next model in chain. Frontend shows toast notification. Admin can configure multiple providers.

---

### 4. Technical Decisions (C5 - 5 marks)

**Q: Why ChromaDB over Pinecone/Weaviate?**
> **Answer**: Local-first, no external dependency, persistent file-based, metadata filtering, open-source. Sufficient for current scale. Can migrate to managed vector DB later.

**Q: Why sentence-transformers over OpenAI embeddings?**
> **Answer**: Cost (free, local), privacy (data never leaves), latency (no network), customizable. all-MiniLM-L6-v2 is 384-dim, fast, good quality for retrieval.

**Q: Why not use LangChain's built-in RAG chains?**
> **Answer**: LangGraph provides finer control over state, cycles, conditional edges. LangChain chains are linear. Need regeneration loop, web search fallback, critique - all require graph structure.

**Q: Why React without Redux/Zustand?**
> **Answer**: Simple state needs. Auth + config in App.jsx context. localStorage persistence. No complex client state. Keeps bundle small (180KB).

---

### 5. Challenges & Problem Solving (C5 - 5 marks)

**Q: What was the hardest technical challenge?**
> **Answer**: Groq free tier rate limits causing unpredictable failures. Compound models route to different underlying models with different limits. Solution: Identified `allam-2-7b` as dedicated model with highest quota (500K/day), made it default, updated fallback to avoid compound models.

**Q: How did you debug the macOS MPS crash?**
> **Answer**: Worker SIGABRT with MPSLibrary error. Identified as PyTorch MPS issue with sentence-transformers. Fixed with `PYTORCH_ENABLE_MPS_FALLBACK=1` allowing CPU fallback. Alternative: disable MPS entirely.

**Q: What would you do differently?**
> **Answer**: 1) Add streaming from start (SSE). 2) Use async Celery for document processing. 3) Add comprehensive integration test suite earlier. 4) Implement document versioning from beginning.

---

### 6. Future Work & Scalability (C6 - 10 marks)

**Q: How would you scale to 10K users?**
> **Answer**: Horizontal backend scaling (stateless), PostgreSQL read replicas, ChromaDB cluster or managed vector DB (Pinecone), Redis for caching, Celery for async document processing, CDN for frontend, load balancer.

**Q: What production concerns exist?**
> **Answer**: 1) SQLite → PostgreSQL migration. 2) Single ChromaDB instance → cluster. 3) API keys in DB → vault (HashiCorp/AWS Secrets Manager). 4) No audit logging. 5) Rate limiting at API gateway. 6) Monitoring/alerting (Prometheus + Grafana).

**Q: How to add new LLM provider?**
> **Answer**: 1) Add provider to `PROVIDER_MODELS` in frontend constants. 2) Add `_call_newprovider()` in `llm_helper.py`. 3) Add encrypted field to `LLMConfig` model. 4) Add to fallback chain. 5) Update admin UI.

---

## Demo Script (3 minutes)

### 1. Admin Login & Config (45s)
- Login as admin_intradoc
- Open Admin Console → System Config
- Show Groq key, model=allam-2-7b, enforce_globally
- Save

### 2. Department Isolation (45s)
- Switch to HR Viewer account
- Query "company policy" → no results
- Switch to Admin → "All Departments" → same query → results
- Show department filter dropdown

### 3. RAG Query with Visualization (45s)
- Query "What is Bishal's education?"
- Show chat response with citations
- Open Visualizer → show pipeline steps
- Click source → highlights in visualizer
- Show cost/tokens

### 4. Document Upload (45s)
- Switch to Editor account
- Upload new PDF
- Show indexing progress
- Query new document content

---

## Paper Reference (C7 - 5 marks)

**Title**: "Intradoc AI: Enterprise-Grade Department-Scoped RAG with Admin-Controlled LLM Configuration"

**Key Contributions**:
1. Department-scoped retrieval with role-based access
2. Admin-controlled global LLM config with encryption
3. Multi-provider LLM abstraction with fallback
4. Faithfulness-graded generation with self-correction
5. Real-time pipeline visualization

**Submission**: [Add your paper link/ID here]

---

## Quick Reference Card

| Topic | Key Points |
|-------|------------|
| **Auth** | JWT + SimpleJWT, role/dept in token, refresh rotation |
| **RAG** | LangGraph 6 nodes, hybrid search, rerank, faithfulness grading |
| **Dept Isolation** | ChromaDB where clause, enforced at query level |
| **LLM Config** | Singleton LLMConfig, Fernet encryption, enforce_globally flag |
| **Frontend** | React 18, Vite, Context + localStorage, 4 admin tabs |
| **Testing** | 87% coverage, 23 unit tests, 5 E2E scenarios |
| **Deployment** | Gunicorn, SQLite→PostgreSQL ready, Dockerfile ready |
| **Challenges** | Rate limits, MPS crashes, config precedence, encryption |
# Data Flow Documentation

## 1. Document Ingestion Flow

```
User Upload (Frontend)
        │
        ▼
POST /api/documents/upload (multipart/form-data)
        │
        ▼
DocumentViewSet.create()
        │
        ├── Save to PostgreSQL (Document model)
        │   • filename, file_size, department, classification
        │   • status: "processing"
        │
        ├── Extract text (pdfplumber / python-docx)
        │
        ├── Chunk text (RecursiveCharacterTextSplitter)
        │   • chunk_size: 1000, chunk_overlap: 200
        │
        ├── Generate embeddings (sentence-transformers)
        │   • Model: all-MiniLM-L6-v2 (384 dim)
        │   • Batch size: 64
        │
        ├── Store in ChromaDB
        │   • Collection: "documents"
        │   • Metadata: doc_id, department, classification, page
        │
        └── Update PostgreSQL status: "indexed"
```

**Error Handling**: Failed docs marked "failed" with error message; retry endpoint available.

---

## 2. RAG Query Flow (LangGraph Pipeline)

```
User Question (Frontend)
        │
        ▼
POST /api/chat/query
        │
        ├── Auth validation (JWT)
        ├── Session validation (ownership)
        ├── Get user profile (role, department)
        ├── Load LLMConfig from DB (admin settings)
        │
        ▼
RUN RAG PIPELINE (LangGraph)
        │
        ├── RETRIEVE NODE
        │   • Embed query (same model)
        │   • Vector search (k=4, dept-scoped)
        │   • Hybrid: vector + BM25 keyword
        │   • Rerank (CrossEncoder)
        │   • Build context (max 3000 tokens)
        │
        ├── GRADE DOCUMENTS NODE
        │   • LLM judges relevance (JSON output)
        │   • Filter: keep only relevant chunks
        │   • If < 2 relevant → trigger web search
        │
        ├── WEB SEARCH NODE (conditional)
        │   • SerpAPI / DuckDuckGo fallback
        │   • Add web results to context
        │
        ├── GENERATE NODE
        │   • Prompt: context + question
        │   • LLM call (admin-configured provider/model)
        │   • Track tokens, latency, cost
        │
        ├── GRADE GENERATION NODE
        │   • Faithfulness check (grounded in context?)
        │   • Hallucination detection
        │   • If failed → regenerate (max 2 retries)
        │
        └── CRITIQUE NODE
            • Quality assessment
            • Structured evaluation output
            • Cache semantic response
```

---

## 3. Department Scoping Logic

```
User Query Received
        │
        ▼
Get User Profile (role, department)
        │
        ├── Admin?
        │   ├── requested_dept == "All Departments"
        │   │   └── admin_all = True, target_dept = None
        │   └── requested_dept == specific
        │       └── admin_all = False, target_dept = requested
        │
        └── Non-Admin?
            └── admin_all = False, target_dept = user_department
                    (cannot override)
        │
        ▼
Vector Store Query
        │
        ├── admin_all = True → Filter: status="indexed" (ALL departments)
        ├── admin_all = False, target_dept set → Filter: dept=target + indexed
        └── Default → Filter: dept=user_dept + indexed
```

---

## 4. LLM Configuration Resolution

```
Frontend sends: config {provider, model, temperature, k}
Backend receives in query_rag()
        │
        ▼
Load LLMConfig (singleton) from DB
        │
        ├── enforce_globally = True
        │   └── IGNORE frontend config entirely
        │       Use DB: provider, model, temp, k
        │       Use DB API keys (decrypted)
        │
        └── enforce_globally = False
            └── MERGE: DB config as defaults, frontend overrides
                Use DB API keys (decrypted)
        │
        ▼
resolve_llm_config() in llm_helper.py
        │
        ├── Try configured provider + DB API key
        ├── Fallback: Groq → Gemini → OpenAI (if keys exist)
        └── Fallback: Environment variables
        │
        ▼
Returns: {provider, model, api_key}
```

---

## 5. Response & Caching Flow

```
LLM Response Generated
        │
        ├── Save to PostgreSQL (ChatMessage)
        │   • content, sources (JSON), steps (JSON)
        │   • model_used, tokens, cost, latency
        │   • evaluation metrics (faithfulness, etc.)
        │
        ├── Semantic Cache Check
        │   • Embedding of (question + context) → cache key
        │   • If hit: return cached, skip LLM call
        │
        └── Return to Frontend
            • Streaming: Server-Sent Events (optional)
            • Full: JSON response with all metadata
```

---

## 6. Admin Configuration Persistence

```
Admin Console (Frontend)
        │
        ▼
PUT /api/admin/llm-config
        │
        ▼
AdminSystemConfig.save()
        │
        ├── Encrypt API keys (Fernet, key from settings)
        │
        ├── Update LLMConfig singleton
        │   • provider, model, temperature, k
        │   • enforce_globally flag
        │   • encrypted groq/gemini/openai keys
        │
        └── Broadcast: onConfigSaved callback
            └── Frontend calls fetchGlobalConfig()
                └── Updates local modelConfig state
```

---

## 7. Authentication Flow

```
Login Request
        │
        ▼
POST /api/auth/login {username, password}
        │
        ▼
authenticate() → User + UserProfile
        │
        ├── Generate JWT (SimpleJWT)
        │   • Access: 5 min, Refresh: 24 hr
        │   • Claims: user_id, role, department
        │
        └── Return: {access, refresh, role, department}
        │
Frontend stores in localStorage
        │
Subsequent requests: Authorization: Bearer <access>
        │
Token expiry → POST /api/auth/refresh {refresh}
        │
        └── New access token
```

---

## 8. Frontend State Management

```
App.jsx (Root)
├── Auth State
│   ├── isAuthenticated, currentUser, userRole, userDepartment
│   └── Hydrated from localStorage on mount (/auth/me)
│
├── LLM Config State
│   ├── apiKeys (localStorage: intradoc_api_keys)
│   ├── modelConfig (localStorage: intradoc_model_config)
│   └── isGlobalConfigEnforced (from /llm-config)
│
├── Global Config Sync
│   └── fetchGlobalConfig() called on auth + admin save
│       Merges DB config into local state
│
└── Routing Guards
    ├── /admin/* → Requires userRole === 'Admin'
    ├── Protected routes → Requires isAuthenticated
    └── Login redirect if not authenticated
```
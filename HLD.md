# High-Level Design (HLD) - Document Intelligent System

## 📋 System Overview

The Document Intelligent System is a full-stack RAG (Retrieval-Augmented Generation) application that enables users to upload documents and intelligently query them using Large Language Models. The system provides real-time execution visualization, role-based access control, and department-based document management.

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (React/Vite)               │
├─────────────────────────────────────────────────────────────┤
│  QueryPage │ DocumentsPage │ SettingsPage │ AdminDashboard  │
│         ChatWindow │ Visualizer │ KnowledgeGraphVisualizer  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              API GATEWAY (Django REST Framework)             │
├─────────────────────────────────────────────────────────────┤
│  Authentication │ Authorization │ Rate Limiting │ Validation │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
    ┌────────┐   ┌──────────┐  ┌──────────┐  ┌──────────┐
    │  RAG   │   │   Chat   │  │Documents │  │  Admin   │
    │ Module │   │  Module  │  │ Module   │  │ Module   │
    └────┬───┘   └──────────┘  └────┬─────┘  └──────────┘
         │                          │
         ▼                          ▼
    ┌──────────┐             ┌──────────────┐
    │ Hybrid   │             │   Batch      │
    │ Retrieval│             │   Uploader   │
    │(BM25+Vec)│             │  (RQ/Thread) │
    └────┬─────┘             └──────────────┘
         │
         ▼
    ┌──────────┐
    │ Reranker │
    └────┬─────┘
         │
    ┌────▼─────┐   ┌───────────┐   ┌───────────┐
    │ Semantic │   │  Cost &   │   │Monitoring │
    │  Cache   │   │ Tracking  │   │(Prom/     │
    │(RBAC)    │   │(Tokens, $)│   │ Langfuse) │
    └──────────┘   └───────────┘   └───────────┘
         │              │              │
         └──────────────┼──────────────┘
                        │
        ┌──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
    ┌────────────┐ ┌──────────┐ ┌──────────────┐ ┌────────┐
    │   Django   │ │  Chroma  │ │   SQLite     │ │ Redis  │
    │  ORM Models│ │(Vector)  │ │              │ │(Cache) │
    └────────────┘ └──────────┘ └──────────────┘ └────────┘
        │              │              │              │
        └──────────────┼──────────────┘              │
                       │                             │
        ┌──────────────┼──────────────┐              │
        ▼              ▼              ▼              │
    ┌──────────┐  ┌──────────┐  ┌──────────┐        │
    │ LLM APIs │  │ Document │  │  Web     │        │
    │(Multi-   │  │Processing │  │  Search  │        │
    │ Provider)│  │(PDF/Text)│  │(Fallback)│        │
    └──────────┘  └──────────┘  └──────────┘        │
                                                   │
    ┌────────────────────────────────────────────────┘
    │  (Job Queue)
    ▼
┌──────────┐
│  RQ Job  │
│  Workers │
└──────────┘
```

---

## 🔄 Data Flow Architecture

### 1. Document Upload Flow

```
User uploads document
    │
    ▼
Frontend validates file type & size
    │
    ▼
POST /api/documents/upload
    │
    ▼
Backend receives & stores file
    │
    ▼
Extract text from PDF/Document
    │
    ▼
Split into chunks (max 512 tokens)
    │
    ▼
Generate embeddings using LLM
    │
    ▼
Store in Vector Database (Chroma)
    │
    ▼
Create Document record with metadata
    │
    ▼
Store in PostgreSQL/SQLite
    │
    ▼
Response: Document indexed successfully
```

### 2. Query/Chat Flow

```
User sends message in chat
    │
    ▼
Create ChatMessage (user role)
    │
    ▼
POST /api/chat/query
    │
    ▼
Backend receives query + session_id + department
    │
    ▼
RAG Pipeline starts:
    │
    ├─ Step 1: Generate query embeddings
    │
    ├─ Step 2: Hybrid search (dense + BM25 via RRF) filtered by department
    │          Returns: Top-K chunks with BM25 + vector similarity fusion
    │
    ├─ Step 3: Rerank results with relevance scoring
    │          Filter out chunks below RELEVANCE_THRESHOLD
    │
    ├─ Step 4: Check semantic cache (RBAC-aware)
    │          If similar query found → return cached response
    │
    ├─ Step 5: If relevance too low → invoke web search fallback
    │
    ├─ Step 6: Build context (token-budget-aware), construct prompt
    │
    ├─ Step 7: Call primary LLM provider (Groq/Gemini/OpenAI/Ollama)
    │          On failure → fallback to secondary provider
    │
    ├─ Step 8: Evaluate response quality (heuristic scores + optional LLM judge)
    │
    ├─ Step 9: Cache response in semantic cache
    │
    ├─ Step 10: Save ChatMessage with model_used, tokens, cost, latency, cache_hit
    │
    └─ Step 11: Trace to Langfuse (if configured)
    │
    ▼
Response: {
    content: "Answer from LLM",
    sources: [...],
    steps: [...],
    model_used: "llama-3.3-70b-versatile",
    input_tokens: 450,
    output_tokens: 120,
    estimated_cost_usd: 0.00015,
    latency_ms: 1250,
    cache_hit: false,
    evaluation: { heuristic: 0.85, llm_judge: 4 }
}
    │
    ▼
Frontend displays response + visualizes steps
```

### 3. Chat Session Management Flow

```
User clicks "New Chat"
    │
    ├─ GET /api/chat/sessions (fetch all sessions)
    │ 
    ├─ POST /api/chat/sessions (create new session)
    │   Returns: { id, name, created_at, user }
    │
    ├─ Sidebar displays chat history
    │
    └─ User can:
       ├─ Click to select session
       ├─ Click 3-dot menu (⋮)
       ├─ Rename: PUT /api/chat/sessions/{id}
       └─ Delete: DELETE /api/chat/sessions/{id}
```

---

## 👥 User Roles & Permissions

```
┌─────────────────────────────────────────┐
│         User Roles Hierarchy            │
├─────────────────────────────────────────┤
│ Admin                                   │
│ ├─ All permissions                      │
│ ├─ Can manage users                     │
│ ├─ Can delete any document              │
│ └─ Can view analytics                   │
│                                         │
│ Editor                                  │
│ ├─ Can upload documents                 │
│ ├─ Can query documents                  │
│ ├─ Can create chat sessions             │
│ └─ Can view own documents               │
│                                         │
│ Viewer                                  │
│ ├─ Can only query documents             │
│ ├─ Can create chat sessions             │
│ ├─ Cannot upload documents              │
│ └─ Can view own sessions                │
│                                         │
│ Guest (if enabled)                      │
│ ├─ Limited query access                 │
│ └─ No upload/download                   │
└─────────────────────────────────────────┘
```

---

## 🔐 Security Architecture

### Authentication Flow

```
1. User Login
   Login Form → POST /api/auth/login
   → Validate credentials
   → Generate JWT Token
   → Return token to frontend

2. Token Storage
   localStorage.setItem('intradoc_token', token)

3. API Requests
   Every request includes:
   Headers: { Authorization: Bearer <token> }

4. Token Validation
   Middleware checks token validity
   If invalid/expired → 401 Unauthorized
   If valid → Process request
```

### Authorization Strategy

```
@permission_classes([IsViewerOrAbove])
def protected_endpoint(request):
    # Only users with Viewer role or higher can access
    
@permission_classes([IsEditorOrAbove])
def upload_document(request):
    # Only Editors and Admins can upload

@permission_classes([IsAdmin])
def delete_document(request):
    # Only Admins can delete documents
```

---

## 📊 Data Models

### Core Entities

```
User
├─ id (UUID)
├─ username (String)
├─ email (Email)
├─ password (Hashed)
├─ role (Enum: Admin, Editor, Viewer)
├─ department (String)
└─ created_at (DateTime)

Document
├─ id (UUID)
├─ title (String)
├─ filename (String)
├─ file_path (String)
├─ file_size (Integer)
├─ classification (String: HR, Legal, Finance, etc)
├─ department (String)
├─ uploaded_by (FK: User)
├─ content_hash (String)
├─ indexed (Boolean)
├─ created_at (DateTime)
└─ updated_at (DateTime)

ChatSession
├─ id (UUID)
├─ user (FK: User)
├─ name (String)
├─ created_at (DateTime)
└─ updated_at (DateTime)

ChatMessage
├─ id (UUID)
├─ session (FK: ChatSession)
├─ role (Enum: user, assistant)
├─ content (Text)
├─ sources (JSON: [{id, title, page}])
├─ steps (JSON: RAG pipeline steps)
└─ created_at (DateTime)

DocumentChunk
├─ id (UUID)
├─ document (FK: Document)
├─ chunk_text (Text)
├─ chunk_index (Integer)
├─ embedding_id (String)  # Reference in Chroma
├─ page_number (Integer, optional)
└─ created_at (DateTime)
```

---

## 🔗 Module Interactions

### RAG Module

```
RAG Pipeline orchestrates:
├─ Hybrid Retrieval (Dense + BM25 via RRF)
├─ Reranking & Threshold Filtering
├─ Context Assembly (token-budget-aware)
├─ Web Search Fallback
├─ LLM API Calls (multi-provider with fallback)
├─ Response Evaluation (heuristic + LLM judge)
└─ Semantic Caching (RBAC-aware)
```

### Chat Module

```
Chat Service manages:
├─ Session CRUD operations
├─ Message storage (with cost/metrics metadata)
├─ Query routing to RAG
├─ Response formatting
├─ Source attribution
└─ Cost tracking per message
```

### Document Module

```
Document Service handles:
├─ File upload & validation
├─ Batch upload (up to 1000 files via RQ/ThreadPool)
├─ Text extraction (PDF/Text)
├─ Semantic chunking
├─ Embedding generation
├─ Vector store indexing
└─ Metadata storage
```

### Admin Module

```
Admin Service provides:
├─ User management
├─ Document deletion (with vector store cleanup)
├─ Analytics & reporting
├─ LLM configuration (encrypted API keys, masked display)
├─ System monitoring (Prometheus metrics)
├─ Cache statistics
└─ Health checks
```

### Caching Module

```
Cache Service provides:
├─ Semantic Cache (RBAC-aware, doc-scoped)
├─ Embedding Cache
├─ Domain-specific Caches
├─ Cache metrics & statistics
└─ Redis-backed with configurable TTL
```

### Cost Tracking Module

```
Cost Tracking handles:
├─ Token counting (input + output)
├─ Per-model pricing lookups
├─ Estimated cost per query
├─ Aggregate usage statistics
└─ Prometheus cost metrics
```

### Monitoring Module

```
Monitoring provides:
├─ Prometheus metrics (queries, latency, cost)
├─ Langfuse tracing (chat turn observability)
├─ Health check endpoints (liveness/readiness)
└─ Structured logging (DEBUG/INFO levels)
```

---

## 🎨 Frontend Architecture

### Page Components

```
App (Root)
├─ LandingPage (welcome/feature showcase)
├─ LoginScreen
├─ MainLayout
│  ├─ Sidebar
│  └─ MainContent
│     ├─ QueryPage
│     │  ├─ ChatWindow
│     │  ├─ Visualizer (cost, latency, model, cache metrics)
│     │  └─ KnowledgeGraphVisualizer
│     │
│     ├─ DocumentsPage
│     │  ├─ DocumentUpload
│     │  ├─ DocumentList
│     │  └─ DocumentFilters
│     │
│     ├─ SettingsPage
│     │  ├─ APIKeyManagement
│     │  ├─ ModelConfiguration
│     │  └─ UserPreferences
│     │
│     └─ AdminDashboard
│        ├─ UserManagement
│        ├─ DocumentAnalytics
│        ├─ AdminAnalytics
│        └─ SystemMonitoring
```

### State Management

```
Component-level state:
├─ UI state (showVisualizer, openMenuId)
├─ Data state (sessions, messages, documents)
├─ Loading state (chatLoading, isLoading)
└─ User state (currentUser, userRole, userDepartment)

Persisted state:
├─ Auth token (localStorage)
├─ API configuration
└─ User preferences
```

---

## 🔄 Integration Points

### Frontend ↔ Backend

```
HTTP/REST API Endpoints:
├─ /api/auth/* (Authentication)
├─ /api/chat/* (Chat & Sessions)
├─ /api/documents/* (Document Management)
├─ /api/admin/* (Admin Functions)
└─ /api/rag/* (RAG Pipeline)

Data Format: JSON
Authentication: Bearer Token (JWT)
Error Handling: Standard HTTP Status Codes
```

### Backend ↔ LLM (Multi-Provider)

```
HTTPS API Calls:
├─ POST /v1/embeddings (Generate embeddings)
├─ POST /v1/chat/completions (Get responses)
└─ Authentication: API Key

Supported Providers:
├─ Groq (llama, mixtral models)
├─ Gemini (gemini-1.5-flash, gemini-1.5-pro)
├─ OpenAI (gpt-4o-mini, gpt-4o)
└─ Ollama (local, llama3, mistral, gemma2)

Fallback: Primary → Secondary provider on failure
Retry Logic: Exponential backoff
Timeout: 30 seconds
```

### Backend ↔ Vector Store (Chroma)

```
HTTP REST or Direct Python SDK:
├─ add() - Insert embeddings
├─ query() - Search similar vectors
├─ delete() - Remove embeddings
└─ Collection management

Collection Strategy: One collection per department
```

---

## 📈 Scalability Considerations

### Horizontal Scaling

```
Current Setup (Development):
├─ Single Django instance
├─ Single React instance
└─ Single Vector Store instance

Production Setup:
├─ Multiple Django instances (Load balanced)
├─ CDN for React static files
├─ Distributed Vector Store (Pinecone/Weaviate)
└─ Caching layer (Redis)
```

### Performance Optimizations

```
1. Caching
   ├─ Semantic cache for similar questions (RBAC-aware)
   ├─ Embedding cache (lazy-initialized)
   ├─ Vector search cache
   └─ Domain-specific caches (Redis backend)

2. Indexing
   ├─ Vector database indexing (HNSW)
   ├─ BM25 inverted index for keyword search
   ├─ Full-text search indexing
   └─ Department-based partitioning

3. Hybrid Search
   ├─ Dense (semantic) + BM25 (keyword) fusion
   ├─ Reciprocal Rank Fusion (RRF) for score merging
   └─ Reranker for precision filtering

3. Pagination
   ├─ Chat messages pagination
   ├─ Document list pagination
   └─ Search results pagination
```

---

## 🚀 Deployment Architecture

### Development Environment

```
Local machine:
├─ Django dev server (http://localhost:8000)
├─ React dev server (http://localhost:5173)
├─ SQLite database (data/app.db)
└─ Chroma vector store (local)
```

### Staging Environment

```
Docker containers:
├─ Django container (port 8000)
├─ React container (port 80)
├─ PostgreSQL container
├─ Chroma container
└─ Nginx reverse proxy
```

### Production Environment

```
Cloud deployment:
├─ Django on AWS/Heroku (auto-scaling)
├─ React on Vercel/Netlify (CDN)
├─ RDS PostgreSQL (managed)
├─ Pinecone/Weaviate (cloud vector DB)
└─ CloudFlare/AWS CloudFront (CDN)
```

---

## 📊 System Constraints & Assumptions

### Constraints

```
1. File Upload
   ├─ Max file size: 50MB
   └─ Supported formats: PDF, TXT, DOCX

2. Query Processing
   ├─ Max query length: 2000 characters
   ├─ Max response tokens: 2000
   └─ Response timeout: 60 seconds

3. Vector Store
   ├─ Chunk size: 512 tokens (semantic boundary-aware)
   ├─ Overlap: 100 tokens
   ├─ Max vectors per collection: 1M
   ├─ Hybrid search: BM25 + dense vector via RRF
   └─ Relevance threshold: configurable (default 0.7)

4. Semantic Cache
   ├─ Max cache size: 10,000 entries
   ├─ Default TTL: 24 hours
   ├─ Similarity threshold: 0.85
   └─ RBAC-scoped: cached per user/role/doc access

4. Concurrent Users
   ├─ Dev: 10 concurrent users
   ├─ Staging: 100 concurrent users
   └─ Production: 1000+ concurrent users
```

### Assumptions

```
1. Users have stable internet connection
2. Documents are in English (LLM trained on English)
3. API keys are valid and have sufficient quota
4. Database is accessible during operation
5. Vector store is always available
```

---

## 🔍 Monitoring & Observability

### Key Metrics

```
1. System Health
   ├─ API response time
   ├─ Error rate
   ├─ Database query time
   └─ Vector store latency

2. User Activity
   ├─ Active users
   ├─ Queries per minute
   ├─ Documents uploaded
   └─ Session duration

3. Performance
   ├─ LLM API latency
   ├─ Embedding generation time
   ├─ Search latency
   └─ Frontend load time
```

### Logging Strategy

```
Levels: DEBUG, INFO, WARNING, ERROR, CRITICAL

Components:
├─ API requests/responses
├─ RAG pipeline steps
├─ Database operations
├─ LLM API calls
├─ Error traces
└─ Security events
```

---

## 🎯 Future Enhancements

```
1. Features
   ├─ Multi-modal documents (images, videos)
   ├─ Real-time collaboration
   ├─ Custom knowledge graphs
   ├─ Multi-language support
   ├─ Document versioning system
   └─ Webhook support for document events

2. Performance
   ├─ Advanced RRF tuning per department
   ├─ Adaptive chunking strategy
   ├─ Distributed vector store (Pinecone/Weaviate)
   └─ Async background jobs (already with RQ/ThreadPool)

3. Security
   ├─ End-to-end encryption
   ├─ Document watermarking
   ├─ Audit logging
   ├─ IP whitelisting
   └─ API key rotation

4. Infrastructure
   ├─ Kubernetes deployment
   ├─ Auto-scaling groups
   ├─ Disaster recovery
   ├─ Multi-region setup
   └─ Redis Sentinel for high-availability cache
```

---

## 📚 References

- [Django REST Framework](https://www.django-rest-framework.org/)
- [React Documentation](https://react.dev/)
- [Chroma Vector Store](https://www.trychroma.com/)
- [OpenAI API](https://openai.com/api/)
- [JWT Authentication](https://jwt.io/)

---

**Last Updated**: July 2026
**Version**: 2.0
**Status**: Production Ready

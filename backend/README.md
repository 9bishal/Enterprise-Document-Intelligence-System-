# Backend - Document Intelligent System

Django REST Framework backend for the Document Intelligent System with RAG (Retrieval-Augmented Generation) pipeline, vector search, and LLM integration.

## 📁 Backend Structure

```
backend/
├── app/                          # Core RAG & LLM Logic
│   ├── rag_graph.py             # RAG pipeline execution with step tracking
│   ├── llm_helper.py            # LLM API calls (multi-provider, fallback, cost)
│   ├── vector_store.py          # Chroma vector database operations (hybrid search)
│   ├── database.py              # Database initialization
│   ├── main.py                  # Application startup & route registration
│   ├── analytics.py             # Langfuse tracing integration
│   ├── semantic_chunk.py        # Semantic document chunking
│   ├── evaluation/              # Response evaluation (heuristic + LLM judge)
│   └── retrieval/               # Hybrid retrieval pipeline (BM25, RRF, reranker)
├── django_backend/              # Django Configuration
│   ├── models.py                # Django ORM models (encrypted keys, cost fields)
│   ├── serializers.py           # DRF serializers (with cost/model fields)
│   ├── permissions.py           # Custom permission classes (RBAC)
│   ├── middleware.py            # Custom middleware (logging, auth)
│   ├── settings.py              # Django settings (Redis, structured logging)
│   ├── urls.py                  # URL routing (health, cache, batch)
│   ├── cache/                   # Multi-layer caching (semantic, embedding, domain)
│   ├── cost_tracking/           # LLM cost tracking (pricing, aggregation)
│   ├── monitoring/              # Prometheus metrics & health checks
│   ├── views/                   # API Views (endpoints)
│   │   ├── auth.py              # Authentication (login, register, refresh)
│   │   ├── doc_api.py           # Document CRUD (batch upload, pagination)
│   │   ├── doc_indexing.py      # Document indexing (RQ/ThreadPool)
│   │   ├── documents.py         # Additional document operations
│   │   ├── rag.py               # RAG query endpoints (fallback, cost tracking)
│   │   ├── rag_query.py         # Query-specific logic
│   │   ├── admin.py             # Admin operations
│   │   ├── admin_graph.py       # Admin graph/analytics
│   │   ├── admin_llm.py         # Admin LLM config (masked encrypted keys)
│   │   ├── admin_metrics.py     # System metrics
│   │   ├── admin_users.py       # User management
│   │   └── __init__.py          # Exports for easy importing
│   ├── migrations/              # Database schema migrations
│   └── __pycache__/             # Python bytecode cache
├── uploads/                     # Temporary file uploads
├── data/                        # Persistent data storage
│   ├── app.db                   # SQLite database
│   └── chroma/                  # Vector database (Chroma)
├── venv/                        # Python virtual environment
├── manage.py                    # Django management script
├── run.py                       # Application entry point (WSGI)
├── requirements.txt             # Python dependencies
├── .env                         # Environment variables (git-ignored)
└── .env.example                 # Example environment template
```

## 🔧 Key Components

### 1. RAG Pipeline (`app/rag_graph.py`)

Handles the complete Retrieval-Augmented Generation flow:

```python
# Steps executed (v2.0):
1. Query Embedding         - Generate query vector
2. Hybrid Search           - Dense (semantic) + BM25 (keyword) via RRF
3. Reranking               - Relevance scores, threshold filtering
4. Semantic Cache Check    - RBAC-aware cache lookup
5. Web Search Fallback     - External search if relevance low
6. Context Assembly        - Token-budget-aware context building
7. LLM Generation          - Primary provider with automatic fallback
8. Response Evaluation     - Heuristic scores + LLM judge
9. Response Caching        - Store in semantic cache for reuse
```

**Features:**
- Step-by-step tracking for visualization (with cost/metrics)
- Hybrid retrieval (dense + BM25 fused via Reciprocal Rank Fusion)
- Reranker with configurable relevance threshold
- LLM fallback (primary → secondary provider on failure)
- Web search fallback when retrieval relevance is below threshold
- Semantic caching (RBAC-aware, doc-scoped)
- Response evaluation (heuristic + LLM judge)
- Prometheus metrics integration
- Langfuse tracing

### 2. LLM Helper (`app/llm_helper.py`)

Manages LLM API interactions:

```python
# Supported Providers (v2.0):
- Groq (llama-3.3-70b, mixtral, llama-3.1-8b)
- Google Gemini (gemini-1.5-flash, gemini-1.5-pro)
- OpenAI (gpt-4o-mini, gpt-4o)
- Ollama (local: llama3, mistral, gemma2)
```

**Features:**
- `call_llm_with_fallback()` - Automatic failover to secondary provider
- `call_llm_json()` - Structured JSON responses
- Token counting utilities (`count_tokens`)
- Cost estimation per model (`estimate_cost`)
- SSL/TLS certificate handling
- Configurable API keys per deployment
- Error handling and retries with exponential backoff
- Prometheus metrics (`llm_requests_total`, `llm_latency`, `llm_cost_total`)

### 3. Vector Store (`app/vector_store.py`)

Manages semantic search using Chroma:

```python
# Operations (v2.0):
- add_documents()       - Index new documents
- query_vector_store()  - Hybrid search (dense + BM25 via RRF)
- search()              - Semantic similarity search
- delete()              - Remove indexed documents
- update()              - Update document embeddings
```

**Features:**
- Hybrid search: dense vector + BM25 keyword search fused via RRF
- Semantic chunking (replaced RecursiveCharacterTextSplitter)
- Embedding cache (lazy-initialized, Redis-backed)
- Retrieval cache integration
- Chroma vector database integration
- Batch processing support
- Metadata preservation

### 4. Retrieval Module (`app/retrieval/`)

Dedicated hybrid retrieval pipeline:

| File | Purpose |
|------|---------|
| `hybrid.py` | Dense + BM25 fusion via Reciprocal Rank Fusion (RRF) |
| `bm25.py` | BM25 keyword search (inverted index) |
| `reranker.py` | Relevance scoring & threshold filtering |
| `context_builder.py` | Token-budget-aware context assembly |

### 5. Caching System (`django_backend/cache/`)

Multi-layer caching with Redis backend:

| Module | Purpose |
|--------|---------|
| `semantic_cache.py` | RBAC-aware response cache (similar queries reuse responses) |
| `embedding_cache.py` | Embedding cache (lazy-initialized) |
| `domain_caches.py` | Domain-specific caches |
| `manager.py` | Cache manager & orchestration |
| `metrics.py` | Cache hit/miss metrics |

### 6. Cost Tracking (`django_backend/cost_tracking/`)

LLM usage cost monitoring:

| Module | Purpose |
|--------|---------|
| `pricing.py` | Per-provider, per-model pricing tables |
| `tracker.py` | Token counting, cost aggregation, usage stats |

### 7. Monitoring (`django_backend/monitoring/`)

System health & observability:

| Module | Purpose |
|--------|---------|
| `metrics.py` | Prometheus metrics (queries_total, latency, cost_total) |
| `health.py` | Health check endpoints (liveness, readiness) |

### 8. Analytics (`app/analytics.py`)

Langfuse tracing integration:
- Tracks chat turns with session_id, question, answer, model, latency, cost
- Links retrieved chunks and guardrail actions
- Graceful no-op if Langfuse not configured

### 9. Django Models (`django_backend/models.py`)

Core database models:

```python
- User               # User accounts (with roles)
- Document          # Document metadata
- ChatSession       # Chat conversation sessions
- ChatMessage       # Messages with cost/model tracking fields
- LLMConfig        # LLM configuration (encrypted API keys)
```

**New ChatMessage fields (v2.0):**
- `model_used` - LLM model name
- `input_tokens` - Input token count
- `output_tokens` - Output token count
- `estimated_cost_usd` - Estimated cost in USD
- `latency_ms` - Response latency in milliseconds
- `cache_hit` - Whether response was from cache

**API Key Encryption:**
- All provider API keys (groq, gemini, openai) encrypted at rest
- Uses cryptography.fernet.Fernet with SHA-256 derived from SECRET_KEY
- Accessor methods: `get_*_key()`, `set_*_key()`
- Masked display: `masked_keys()` returns `"abcd****efgh"` format

### 5. REST API Views

#### Chat Session Endpoints (`views/rag.py`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/sessions` | List all user's chat sessions |
| POST | `/api/chat/sessions` | Create new chat session |
| GET | `/api/chat/sessions/{id}` | Get session details |
| PUT | `/api/chat/sessions/{id}` | Update/rename session |
| DELETE | `/api/chat/sessions/{id}` | Delete chat session |
| GET | `/api/chat/sessions/{id}/messages` | Get all messages in session |
| POST | `/api/chat/query` | Send question & get RAG response |

#### Document Endpoints (`views/doc_api.py`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents` | List documents (paginated with limit/offset) |
| POST | `/api/documents/upload` | Upload new document |
| POST | `/api/documents/upload/batch` | Batch upload (up to 1000 files) |
| GET | `/api/documents/{id}` | Get document details |
| DELETE | `/api/documents/{id}` | Delete document |
| GET | `/api/documents/search` | Search documents |

#### Admin Endpoints (`views/admin.py`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/documents/delete` | Admin delete document |
| GET | `/api/admin/metrics` | System metrics |
| GET | `/api/admin/users` | Manage users |
| POST | `/api/admin/llm/config` | Configure LLM (encrypted keys, masked display) |

#### Health & Monitoring Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health/live` | Liveness probe |
| GET | `/api/health/ready` | Readiness probe |
| GET | `/api/cache/stats` | Cache statistics |

## 🚀 Setup & Installation

### 1. Environment Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Configuration

Create `.env` file:

```env
# Django
DEBUG=False
SECRET_KEY=your-super-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=sqlite:///data/app.db

# LLM Configuration
OPENAI_API_KEY=sk-xxxxxxxxxxxx
OPENAI_MODEL=gpt-4
LLM_TEMPERATURE=0.7
GROQ_API_KEY=gsk-xxxxxxxxxxxx
GEMINI_API_KEY=AIzaxxxxxxxxxxxx

# Chroma Vector DB
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Redis (for caching & job queue)
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET=your-jwt-secret
JWT_ALGORITHM=HS256

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Langfuse (optional tracing)
LANGFUSE_PUBLIC_KEY=pk-xxxx
LANGFUSE_SECRET_KEY=sk-xxxx
LANGFUSE_HOST=https://cloud.langfuse.com
```

### 4. Database Setup

```bash
# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Collect static files (production)
python manage.py collectstatic
```

### 5. Start Backend Server

```bash
# Development
python run.py

# Or using Django directly
python manage.py runserver 0.0.0.0:8000

# Production (Gunicorn)
gunicorn django_backend.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

## 📚 API Documentation

### Authentication Flow

1. **Register User**
   ```bash
   POST /api/auth/register
   {
     "username": "user@example.com",
     "password": "secure_password",
     "department": "HR"
   }
   ```

2. **Login**
   ```bash
   POST /api/auth/login
   {
     "username": "user@example.com",
     "password": "secure_password"
   }
   
   Response:
   {
     "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
     "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
     "user": { "id": 1, "role": "viewer" }
   }
   ```

3. **Use Token**
   ```bash
   Authorization: Bearer {access_token}
   ```

### Chat Session Management

**Create Session**
```bash
POST /api/chat/sessions
Header: Authorization: Bearer {token}
{
  "name": "Project Discussion"
}

Response: { "id": "uuid", "name": "Project Discussion", "created_at": "..." }
```

**Send Query**
```bash
POST /api/chat/query
Header: Authorization: Bearer {token}
{
  "session_id": "uuid",
  "question": "What are the HR policies?",
  "department": "HR",
  "api_keys": { "openai": "sk-..." },
  "config": { "model": "gpt-4", "temperature": 0.7 }
}

Response:
{
  "id": "message_uuid",
  "content": "Based on the documents...",
  "steps": [
    { "name": "retrieval", "status": "completed", "duration": 125 },
    { "name": "processing", "status": "completed", "duration": 45 },
    ...
  ],
  "sources": [
    { "document_id": "doc1", "title": "HR Handbook", "relevance": 0.95 }
  ]
}
```

## 🔐 Permission System

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **Admin** | Full access, user management, document deletion |
| **Editor** | Create/edit documents, manage own chats |
| **Viewer** | Read documents, chat queries only |

### Permission Classes

```python
# Built-in permission classes
IsViewerOrAbove      # Viewer, Editor, Admin
IsEditorOrAbove      # Editor, Admin
IsAdmin              # Admin only
IsOwnerOrAdmin       # Owner or Admin
```

## 🧪 Testing

### Run Tests

```bash
# All tests
python manage.py test

# Specific test file
python manage.py test django_backend.tests.test_auth

# With coverage
coverage run --source='.' manage.py test
coverage report
```

### Test Structure

```
django_backend/tests/
├── test_auth.py          # Authentication tests
├── test_documents.py     # Document CRUD tests
├── test_rag.py           # RAG pipeline tests
└── test_permissions.py   # Permission system tests
```

## 🐛 Troubleshooting

### Common Issues

1. **Import Errors**
   ```bash
   # Solution: Ensure venv is activated
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Database Locked**
   ```bash
   # Solution: Remove database and migrate again
   rm data/app.db
   python manage.py migrate
   ```

3. **Vector Store Connection Failed**
   ```bash
   # Ensure Chroma is running
   docker run -p 8000:8000 chromadb/chroma
   ```

4. **SSL Certificate Verification Failed**
   ```bash
   # Set environment variable
   export PYTHONHTTPSVERIFY=0  # (development only!)
   # Or fix certificate in production
   ```

5. **LLM API Key Issues**
   ```bash
   # Verify in .env
   OPENAI_API_KEY=sk-xxxxxxxx
   # Check API key validity
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

## 📊 Performance Optimization

### Database Indexing

```python
# Models have optimized indexes on:
- User.username (unique)
- Document.user_id (foreign key)
- ChatSession.user_id (foreign key)
- ChatMessage.session_id (foreign key)
```

### Caching Strategy

```python
# Implemented caching for:
- Document metadata (1 hour TTL)
- User permissions (30 min TTL)
- Semantic cache for similar queries (24 hours TTL, RBAC-aware)
- Embedding cache (lazy-initialized, Redis-backed)
```

### Hybrid Search

- Dense vector search (Chroma) + BM25 keyword search
- Reciprocal Rank Fusion (RRF) for score merging
- Reranker filters results below relevance threshold
- Configurable top-K and relevance threshold

### Query Optimization

```python
# Use select_related() for foreign keys
# Use prefetch_related() for reverse relationships
# Use only() to fetch specific fields
# Use values() for simple queries
```

## 🔍 Logging & Monitoring

### Logging Configuration

```python
# Logs location: logs/
# Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL

# Example usage:
logger.info("Document indexed", extra={"doc_id": doc_id})
logger.error("LLM API failed", exc_info=True)
```

### Monitoring Endpoints

```bash
# Health check
GET /api/health

# Metrics
GET /api/admin/metrics

# System status
GET /api/admin/status
```

## 📦 Dependencies Overview

### Core
- `django` - Web framework
- `djangorestframework` - REST API
- `django-cors-headers` - CORS support
- `django-environ` - Environment variables

### Data & Search
- `chromadb` - Vector database
- `sqlalchemy` - ORM
- `psycopg2-binary` - PostgreSQL support
- `rank-bm25` - BM25 keyword search

### LLM & NLP
- `openai` - OpenAI API
- `google-genai` - Gemini API
- `groq` - Groq API
- `langchain` - LLM orchestration
- `sentence-transformers` - Embeddings
- `pydantic` - Data validation

### Caching & Job Queue
- `redis` - Redis client
- `redisvl` - Redis vector library
- `rq` - RQ job queue

### Monitoring
- `prometheus-client` - Prometheus metrics
- `langfuse` - LLM observability (optional)

### Authentication
- `djangorestframework-simplejwt` - JWT auth
- `bcrypt` - Password hashing
- `cryptography` - Fernet encryption for API keys

### Utilities
- `python-dotenv` - .env loading
- `requests` - HTTP client

## 🚀 Deployment

### Production Checklist

```bash
# [ ] Set DEBUG=False in .env
# [ ] Update SECRET_KEY
# [ ] Set ALLOWED_HOSTS
# [ ] Configure database (PostgreSQL)
# [ ] Enable HTTPS
# [ ] Setup CORS properly
# [ ] Configure logging
# [ ] Setup monitoring
# [ ] Run migrations
# [ ] Collect static files
```

### Docker Deployment

```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["gunicorn", "django_backend.wsgi:application", \
     "--bind", "0.0.0.0:8000"]
```

```bash
# Build and run
docker build -t doc-intelligent-system-backend .
docker run -p 8000:8000 doc-intelligent-system-backend
```

## 📞 Support & Documentation

- **Issues**: GitHub Issues
- **Docs**: See ../README.md for full documentation
- **API Docs**: Available at `/api/docs` (when enabled)
- **Database Schema**: See models.py

## 🎯 Future Enhancements

- [ ] Add webhook support for document events
- [ ] Add GraphQL API alongside REST
- [ ] Support for async document processing with progress tracking
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Document versioning system
- [ ] Adaptive RRF tuning per department
- [ ] Distributed vector store (Pinecone/Weaviate)

---

**Last Updated**: July 2026  
**Backend Version**: 2.0.0  
**Python Version**: 3.10+  
**Django Version**: 4.x+

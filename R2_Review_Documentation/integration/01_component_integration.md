# Integration & System Architecture

## Component Integration Matrix

| Component A | Component B | Integration Method | Status |
|-------------|-------------|-------------------|--------|
| Frontend ↔ Backend | REST API + JWT | HTTP/JSON, Authorization header | ✅ |
| Django ↔ ChromaDB | Python client | `chromadb.PersistentClient` | ✅ |
| Django ↔ sentence-transformers | Direct import | `SentenceTransformer.encode()` | ✅ |
| RAG Graph ↔ LLM Providers | Strategy pattern | `llm_helper.call_llm()` | ✅ |
| RAG Graph ↔ Vector Store | Function calls | `query_vector_store()` | ✅ |
| Admin Console ↔ Backend | Admin endpoints | `/api/admin/*` | ✅ |
| Auth ↔ User Profile | OneToOne | `User.profile` property | ✅ |
| Document ↔ Vector Store | Signal + explicit | Post-save + manual sync | ✅ |

---

## API Contract (OpenAPI 3.0 Summary)

### Authentication
```
POST /api/auth/login
  Request: {username, password}
  Response: {access, refresh, role, department, username}

POST /api/auth/signup
  Request: {username, password, email?, otp?}
  Response: {access, refresh, role, department, username}

GET /api/auth/me
  Headers: Authorization: Bearer <token>
  Response: {username, role, department, authenticated}
```

### Chat / RAG
```
POST /api/chat/sessions
  Request: {name}
  Response: {id, name, created_at}

GET /api/chat/sessions
  Response: [{id, name, created_at}]

GET /api/chat/sessions/{id}/messages
  Response: [{id, role, content, created_at, sources, steps, model_used, tokens...}]

POST /api/chat/query
  Request: {session_id, question, api_keys?, config?, department?}
  Response: {id, role, content, sources, steps, model_used, tokens, cost, latency, evaluation}
```

### Documents
```
POST /api/documents/upload (multipart)
  Form: file, department, classification
  Response: {id, filename, status, department, classification}

GET /api/documents
  Query: department?
  Response: [{id, filename, status, department, classification, file_size, created_at}]

DELETE /api/documents/{id}
  Response: {status: "success"}
```

### Admin
```
GET /api/admin/users
  Response: [{id, username, email, role, department, is_active, date_joined}]

PUT /api/admin/users/{id}
  Request: {role?, department?, is_active?}

GET /api/admin/metrics
  Response: {total_users, total_docs, total_queries, total_tokens, total_cost, queries_today}

GET /api/admin/graph
  Response: {departments, documents, connections}

GET /api/admin/llm-config
  Response: {enforce_globally, config: {provider, model, temperature, k}, api_keys: {groq, gemini, openai}}

PUT /api/admin/llm-config
  Request: {enforce_globally?, config?, api_keys?}
  Response: {enforce_globally, config, api_keys}
```

---

## Data Consistency Guarantees

### PostgreSQL ↔ ChromaDB Sync
- **Document creation**: Atomic - PostgreSQL first, then ChromaDB
- **Document deletion**: Cascade - ChromaDB delete, then PostgreSQL
- **Failure handling**: Status field tracks "processing" → "indexed" / "failed"
- **Reconciliation**: Admin reindex endpoint scans PostgreSQL, rebuilds ChromaDB

### Transaction Boundaries
```
Document Upload:
  BEGIN TRANSACTION
    INSERT Document (status=processing)
  COMMIT
  → Extract text (outside transaction)
  → Generate embeddings
  → ChromaDB add
  BEGIN TRANSACTION
    UPDATE Document (status=indexed, chunk_count=N)
  COMMIT
```

---

## Deployment Architecture

### Development (Current)
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL  │
│  (Vite:5173) │     │ (Gunicorn:8000)     │   (SQLite)   │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   ChromaDB   │
                     │  (./data)    │
                     └──────────────┘
```

### Production Ready (Config Only)
```yaml
# docker-compose.yml (planned)
services:
  frontend:
    build: ./frontend
    ports: ["80:80"]
    depends_on: [backend]
  
  backend:
    build: ./backend
    command: gunicorn django_backend.wsgi:application --bind 0.0.0.0:8000 --workers 4
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/intradoc
      - CHROMA_HOST=chromadb
      - SECRET_KEY=${SECRET_KEY}
    depends_on: [db, chromadb]
  
  db:
    image: postgres:15
    volumes: [postgres_data:/var/lib/postgresql/data]
  
  chromadb:
    image: chromadb/chroma:latest
    volumes: [chroma_data:/chroma/data]
```

---

## Environment Configuration

### Backend (.env)
```bash
# Django
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=localhost,yourdomain.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/intradoc

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000

# LLM Providers (optional, can use Admin Console)
GROQ_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=

# Embeddings
INTRADOC_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Encryption (for API keys in DB)
FERNET_KEY=generated-via-fernet-keygen

# Web Search (optional)
SERPAPI_KEY=
```

### Frontend (.env)
```bash
VITE_API_BASE=http://localhost:8000/api
```

---

## Security Integration

### Authentication Flow
```
1. User submits credentials
2. Django authenticate() → User + UserProfile
3. SimpleJWT generates:
   - Access token (5 min, RS256)
   - Refresh token (24 hr, rotating)
4. Tokens returned to frontend
5. Frontend stores in localStorage
6. Subsequent requests: Authorization: Bearer <access>
7. Token expiry → POST /auth/refresh → new access
```

### Authorization Enforcement
```
Request → JWTAuthentication → User
         → Permission Class Check
         → View Logic
```
- `IsViewerOrAbove`: Authenticated users
- `IsEditorOrAbove`: Editor, Admin
- `IsAdminOrAbove`: Admin only
- Department filter applied in view logic (not permission class)

### API Key Encryption
```
Admin saves key → Fernet.encrypt(key) → Store in LLMConfig
Backend reads → Fernet.decrypt(encrypted) → Use in LLM call
Key derivation: SECRET_KEY → PBKDF2 → 32-byte Fernet key
```

---

## Monitoring & Observability

### Prometheus Metrics (Exposed at /metrics)
```
intradoc_queries_total{status="success|error"}
intradoc_query_latency_seconds{quantile="0.5|0.9|0.99"}
intradoc_tokens_total{type="input|output"}
intradoc_cost_usd_total
intradoc_active_users
intradoc_documents_total{status="indexed|processing|failed"}
```

### Logging Structure
```json
{
  "timestamp": "2026-08-21T08:30:00Z",
  "level": "INFO",
  "logger": "django_backend.views.rag",
  "message": "RAG query completed",
  "user_id": 2,
  "session_id": "uuid",
  "model": "allam-2-7b",
  "latency_ms": 3200,
  "tokens": {"input": 1200, "output": 450},
  "cost_usd": 0.0001,
  "cache_hit": false
}
```

### Health Checks
```
GET /health/ → 200 OK (Django + DB + ChromaDB)
GET /health/db → 200 OK (PostgreSQL connection)
GET /health/chroma → 200 OK (ChromaDB heartbeat)
```
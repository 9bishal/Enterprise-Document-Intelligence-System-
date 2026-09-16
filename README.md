# Document Intelligent System

A full-stack document intelligence platform that leverages **RAG (Retrieval-Augmented Generation)** with hybrid search, semantic caching, real-time cost tracking, and multi-provider LLM support. Built with Django REST Framework backend, React/Vite frontend, and advanced NLP capabilities.

## 🎯 Overview

The Document Intelligent System is designed to help organizations:
- Upload and index documents with semantic understanding
- Query documents using natural language with hybrid retrieval (dense + BM25)
- Get AI-powered answers with source attribution and groundedness verification
- Manage chat sessions and conversation history
- Control access through role-based permissions
- Filter results by department
- Monitor LLM usage, costs, and system health

## 📁 Project Structure

```
document_intelligent_system/
├── backend/                    # Django REST API + RAG Pipeline
│   ├── app/                   # Core RAG logic & helpers
│   │   ├── rag_graph.py       # RAG execution pipeline with step tracking
│   │   ├── llm_helper.py      # LLM API interactions (with SSL handling)
│   │   ├── vector_store.py    # Vector database (Chroma) operations
│   │   ├── database.py        # Database connection & setup
│   │   ├── main.py            # Application entry & route registration
│   │   ├── analytics.py       # Langfuse tracing integration
│   │   ├── semantic_chunk.py  # Semantic document chunking
│   │   ├── evaluation/        # Response evaluation (heuristic + LLM judge)
│   │   └── retrieval/         # Hybrid retrieval pipeline
│   │       ├── hybrid.py      # Dense + BM25 fusion via RRF
│   │       ├── bm25.py        # BM25 keyword search
│   │       ├── reranker.py    # Relevance reranking & threshold filtering
│   │       └── context_builder.py # Token-budget-aware context assembly
│   ├── django_backend/        # Django configuration & models
│   │   ├── models.py          # Database models (encrypted API keys, cost tracking)
│   │   ├── views/             # API endpoints
│   │   │   ├── auth.py        # Authentication endpoints
│   │   │   ├── doc_api.py     # Document CRUD + batch upload
│   │   │   ├── doc_indexing.py # Document indexing & classification
│   │   │   ├── rag.py         # RAG query endpoints (with fallback)
│   │   │   ├── admin.py       # Admin operations
│   │   │   └── admin_*.py     # Specialized admin endpoints
│   │   ├── serializers.py     # DRF serializers (with cost fields)
│   │   ├── permissions.py     # Custom permission classes
│   │   ├── middleware.py      # Custom middleware
│   │   ├── settings.py        # Django settings (Redis, structured logging)
│   │   ├── urls.py            # URL routing (health, cache, batch)
│   │   ├── cache/             # Multi-layer caching system
│   │   │   ├── semantic_cache.py # RBAC-aware semantic response cache
│   │   │   ├── embedding_cache.py # Embedding cache
│   │   │   └── domain_caches.py # Domain-specific caches
│   │   ├── cost_tracking/     # LLM cost tracking
│   │   │   ├── pricing.py     # Provider model pricing tables
│   │   │   └── tracker.py     # Usage & cost aggregation
│   │   ├── monitoring/        # System monitoring & health
│   │   │   ├── metrics.py     # Prometheus metrics
│   │   │   └── health.py      # Health check endpoints
│   │   └── migrations/        # Database migrations
│   ├── uploads/               # Temporary file uploads
│   ├── data/                  # Vector database & SQLite storage
│   ├── manage.py              # Django management script
│   ├── run.py                 # Application entry point
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Environment variables (not in repo)
│
├── frontend/                   # React + Vite application
│   ├── src/
│   │   ├── pages/            # Page components
│   │   │   ├── QueryPage.jsx      # Chat interface with RAG pipeline
│   │   │   ├── DocumentsPage.jsx  # Document management
│   │   │   ├── SettingsPage.jsx   # Admin-managed config view
│   │   │   └── ...
│   │   ├── components/       # Reusable components
│   │   │   ├── ChatWindow.jsx     # Chat UI
│   │   │   ├── Visualizer.jsx     # RAG pipeline visualization (cost/metrics)
│   │   │   ├── LandingPage.jsx    # Landing/welcome page
│   │   │   ├── ErrorBoundary.jsx  # React error boundary
│   │   │   ├── Toast.jsx          # Toast notification system
│   │   │   ├── Icons.jsx          # SVG icon library
│   │   │   ├── admin/             # Admin components
│   │   │   └── ...
│   │   ├── utils/            # Utility functions
│   │   │   ├── api.js        # API client functions
│   │   │   └── constants.js  # Shared constants (API_BASE, provider models, tiers)
│   │   ├── App.jsx           # Main app component
│   │   └── main.jsx          # Entry point
│   ├── public/               # Static assets
│   ├── index.html            # HTML template
│   ├── package.json          # Node dependencies
│   ├── vite.config.js        # Vite configuration
│   └── README.md             # Frontend README
│
└── .venv/                     # Python virtual environment
```

## 🚀 Features

### Core Features
- **📄 Document Management**: Upload, index, and organize documents by department
- **🔍 Semantic Search**: RAG-powered search with context awareness
- **💬 Chat Interface**: Real-time conversational interface with message history
- **📊 RAG Pipeline Visualization**: See each step of the retrieval and generation process with cost/metrics
- **🏢 Department Filtering**: Query documents from specific departments
- **👤 Role-Based Access Control**: Admin, Editor, Viewer roles with granular permissions

### Chat Session Management (CRUD)
- ✨ **Create** new chat threads
- 📖 **Read** chat history with full conversation context
- ✏️ **Update** (rename) chat sessions via 3-dot menu
- 🗑️ **Delete** chat sessions with confirmation

### Backend Features
- **REST API** with Django REST Framework
- **JWT Authentication** for secure access
- **Vector Database** (Chroma) for semantic search
- **LLM Integration** with configurable API keys (Groq, Gemini, OpenAI, Ollama)
- **Hybrid Retrieval**: Dense (semantic) + BM25 (keyword) search fused via RRF
- **Semantic Cache**: RBAC-aware response reuse for similar queries, reducing cost
- **LLM Fallback**: Automatic failover to secondary provider on error
- **Web Search Fallback**: External web search when retrieval relevance is low
- **Reranker**: Re-rank retrieved chunks with relevance threshold filtering
- **Evaluation**: Heuristic scoring + LLM judge for response quality
- **Cost Tracking**: Token counting, cost estimation per query
- **Monitoring**: Prometheus metrics, health check endpoints, Langfuse tracing
- **Encrypted API Keys**: Fernet encryption at rest for provider credentials
- **Batch Upload**: Upload up to 1000 files at once with RQ/ThreadPool job queue
- **Department-based Classification** for documents
- **Structured Logging**: Quieted noisy libraries, DEBUG/INFO levels
- **SSL/TLS Support** for secure LLM API calls
- **Pagination & Filtering** for document queries

### Admin Features
- Document deletion with vector store cleanup
- User management and access control
- LLM configuration management (encrypted keys, masked display)
- System metrics, cost analytics, and usage monitoring
- Cache statistics endpoint

## 🛠️ Tech Stack

### Backend
- **Framework**: Django 4.x + Django REST Framework
- **Database**: SQLite (with migration support)
- **Vector DB**: Chroma (for semantic search)
- **LLM**: Groq, Gemini, OpenAI, Ollama (multi-provider with fallback)
- **Authentication**: JWT tokens
- **Job Queue**: RQ (Redis) with ThreadPoolExecutor fallback
- **Caching**: Redis, multi-layer semantic + embedding cache
- **Monitoring**: Prometheus, Langfuse tracing
- **Encryption**: Fernet (symmetric) for API keys at rest
- **Search**: BM25 + dense vector hybrid (RRF fusion)
- **Language**: Python 3.10+

### Frontend
- **Framework**: React 18.x
- **Build Tool**: Vite
- **Styling**: CSS (navy/gold PERC-inspired design system)
- **State Management**: React Hooks + context-based reducers
- **HTTP Client**: Fetch API
- **Icons**: SVG component library (replacing emoji)
- **Language**: JavaScript (ES6+)

## 📋 Prerequisites

- Python 3.10+ (backend)
- Node.js 16+ (frontend)
- npm or yarn (frontend)
- Git (for version control)

## ⚙️ Installation & Setup

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables** (create `.env` file):
   ```env
   DEBUG=True
   SECRET_KEY=your-secret-key-here
   DATABASE_URL=sqlite:///db.sqlite3
   OPENAI_API_KEY=your-openai-key
   CHROMA_HOST=localhost
   CHROMA_PORT=8000
   ```

5. **Run migrations**:
   ```bash
   python manage.py migrate
   ```

6. **Start the backend server**:
   ```bash
   python run.py
   ```
   Server will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment configuration** (create `.env.local`):
   ```env
   VITE_API_BASE=http://localhost:8000/api
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```
   Application will be available at `http://localhost:5173`

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh JWT token

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh JWT token

### Chat Sessions (CRUD)
- `GET /api/chat/sessions` - List all chat sessions
- `POST /api/chat/sessions` - Create new chat session
- `PUT /api/chat/sessions/{id}` - Update/rename session
- `DELETE /api/chat/sessions/{id}` - Delete session
- `GET /api/chat/sessions/{id}/messages` - Get session messages

### Chat Query
- `POST /api/chat/query` - Send question and get RAG response (includes cost, model, cache fields)

### Documents
- `GET /api/documents` - List documents (with limit/offset pagination)
- `POST /api/documents/upload` - Upload document
- `POST /api/documents/upload/batch` - Batch upload (up to 1000 files)
- `DELETE /api/documents/{id}` - Delete document (admin only)
- `GET /api/documents/search` - Search documents

### Admin
- `GET /api/admin/metrics` - System metrics
- `GET /api/admin/users` - Manage users
- `POST /api/admin/llm/config` - Update LLM config (encrypted keys)
- `DELETE /api/admin/documents/{id}` - Admin document deletion

### Health & Monitoring
- `GET /api/health/live` - Liveness probe
- `GET /api/health/ready` - Readiness probe
- `GET /api/cache/stats` - Cache statistics

## 🔐 Authentication

The system uses **JWT (JSON Web Token)** authentication:

1. User logs in with credentials
2. Server returns `access_token` and `refresh_token`
3. Token is stored in localStorage as `intradoc_token`
4. All API requests include: `Authorization: Bearer {token}`
5. Token can be refreshed before expiration

## 🎯 Usage Examples

### Upload a Document
```bash
curl -X POST http://localhost:8000/api/documents/upload \
  -H "Authorization: Bearer {token}" \
  -F "file=@document.pdf" \
  -F "department=HR"
```

### Send a Chat Query
```bash
curl -X POST http://localhost:8000/api/chat/query \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session-uuid",
    "question": "What are the HR policies?",
    "department": "HR"
  }'
```

### Create a Chat Session
```bash
curl -X POST http://localhost:8000/api/chat/sessions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Project Discussion"}'
```

## 📊 RAG Pipeline Execution

The system shows a visual representation of the RAG pipeline:

1. **Document Retrieval** - Hybrid search (dense + BM25 via RRF) finds relevant chunks
2. **Reranking** - Relevance scores computed, low-confidence results filtered
3. **Context Assembly** - Token-budget-aware context built from top chunks
4. **Fallback Check** - If relevance below threshold, web search is invoked
5. **LLM Generation** - AI generates response (with automatic fallback on error)
6. **Source Attribution** - Sources are cited in response
7. **Evaluation** - Heuristic scoring + optional LLM judge on response quality
8. **Caching** - Similar future queries served from semantic cache

Each step is tracked and displayed in real-time with cost, latency, model, and cache-hit indicators.

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Role-Based Access Control (RBAC)**: Admin/Editor/Viewer roles
- **CORS Protection**: Cross-Origin Resource Sharing configured
- **SSL/TLS Support**: Secure LLM API connections
- **Input Validation**: All inputs validated server-side
- **SQL Injection Protection**: ORM-based queries prevent SQL injection
- **Permission Classes**: Custom DRF permission classes
- **API Key Encryption**: Fernet encryption at rest for all provider credentials
- **Token Security**: httpOnly cookie support, secure token refresh cycles

## 🧪 Testing

### Backend Tests
```bash
cd backend
python manage.py test
```

### Frontend Tests
```bash
cd frontend
npm test
```

### LLM Evaluation
```bash
cd backend
python -m app.evaluation.evaluator
```

## 📦 Deployment

### Backend Deployment (Gunicorn + Nginx)
```bash
gunicorn django_backend.wsgi:application --bind 0.0.0.0:8000
```

### Frontend Deployment (Build for production)
```bash
npm run build
# Output in dist/ directory
```

## 🐛 Troubleshooting

### Backend Issues
- **Import errors**: Ensure virtual environment is activated and requirements.txt is installed
- **Database errors**: Run `python manage.py migrate`
- **SSL errors**: Check `.env` file and LLM API key configuration

### Frontend Issues
- **CORS errors**: Verify `VITE_API_BASE` matches backend URL
- **Token errors**: Clear localStorage and re-login
- **API 404**: Ensure backend is running on correct port

## 📚 Documentation

- [Backend README](./backend/README.md) - Backend-specific documentation
- [Frontend README](./frontend/README.md) - Frontend-specific documentation
- [API Documentation](./API.md) - Detailed API reference

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Team

- **Backend Engineer**: RAG Pipeline & API Development
- **Frontend Engineer**: UI/UX & Chat Interface
- **DevOps**: Deployment & Infrastructure

## 📞 Support

For issues, questions, or suggestions:
- Open an Issue on GitHub
- Check existing documentation
- Review the troubleshooting section

## 🎉 Acknowledgments

- Django REST Framework for excellent REST API framework
- Chroma for vector database capabilities
- React & Vite for modern web development
- Groq, Gemini, OpenAI, Ollama for LLM capabilities
- Redis for caching and job queue
- Langfuse for LLM observability
- Prometheus for system monitoring

---

**Last Updated**: July 2026  
**Version**: 2.0.0

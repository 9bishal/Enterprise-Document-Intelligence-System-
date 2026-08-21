# System Overview - Intradoc AI

## Project Vision
An enterprise-grade **Retrieval-Augmented Generation (RAG)** system for intelligent document processing, enabling secure, department-scoped Q&A over organizational knowledge bases with admin-controlled LLM configuration.

## Core Capabilities

### 1. Document Intelligence Pipeline
- **Multi-format ingestion**: PDF, DOCX, TXT, MD
- **Semantic chunking** with RecursiveCharacterTextSplitter
- **Vector embeddings** via sentence-transformers (all-MiniLM-L6-v2)
- **ChromaDB** vector store with metadata filtering
- **Hybrid search** (vector + keyword) with reranking

### 2. Role-Based Access Control (RBAC)
| Role | Permissions |
|------|-------------|
| **Admin** | Full system config, user management, all departments, global LLM settings |
| **Editor** | Upload documents, manage own department docs |
| **Viewer** | Query only, assigned department only |

### 3. Department-Scoped Retrieval
- Documents tagged with department (HR, Legal, Finance, Technical, General)
- Users only query their assigned department
- Admins can query "All Departments" or specific departments
- Enforced at vector store query level

### 4. Admin-Controlled LLM Configuration
- Global LLM settings (provider, model, temperature, k) stored in DB
- API keys encrypted in database (Fernet)
- `enforce_globally` flag locks user settings
- Supports: Groq, Gemini, OpenAI, Ollama

### 5. RAG Pipeline (LangGraph)
```
Query → Retrieve → Grade → (Web Search) → Generate → Grade → Critique → Response
```
- **Stateful** LangGraph workflow
- **Self-correction** via generation grading
- **Web search fallback** for insufficient context
- **Execution visualization** in frontend

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend API** | Django REST Framework + JWT Auth |
| **RAG Orchestration** | LangGraph (stateful workflow) |
| **Vector Store** | ChromaDB (persistent) |
| **Embeddings** | sentence-transformers/all-MiniLM-L6-v2 |
| **LLM Providers** | Groq, Google Gemini, OpenAI, Ollama |
| **Frontend** | React 18 + Vite + React Router |
| **Auth** | SimpleJWT (access + refresh tokens) |
| **Deployment** | Gunicorn + SQLite (dev) / PostgreSQL (prod) |

## Data Flow Summary
1. **Upload** → Parse → Chunk → Embed → Store in ChromaDB + PostgreSQL metadata
2. **Query** → Embed query → Vector search (dept-scoped) → Rerank → Build context
3. **Generate** → LLM call with context → Grade → Critique → Return response + sources
4. **Visualize** → Pipeline steps shown in real-time frontend visualizer
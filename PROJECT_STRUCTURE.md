# Project Structure & Architecture

## 📊 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Web Browser (User)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/HTTPS
┌────────────────────────────▼────────────────────────────────────┐
│              Frontend (React + Vite)                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ - Chat Interface (QueryPage)                           │    │
│  │ - Document Management (DocumentsPage)                  │    │
│  │ - Settings & Configuration (SettingsPage)              │    │
│  │ - Admin Dashboard (AdminDashboard)                     │    │
│  │ - RAG Pipeline Visualizer                              │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API (JSON)
                             │ JWT Authentication
┌────────────────────────────▼────────────────────────────────────┐
│           Backend (Django REST Framework)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ API Routes Layer                                         │   │
│  │ - Authentication endpoints (/api/auth)                   │   │
│  │ - Chat endpoints (/api/chat)                             │   │
│  │ - Document endpoints (/api/documents)                    │   │
│  │ - Admin endpoints (/api/admin)                           │   │
│  └──────────┬───────────────────────────────────────────────┘   │
│  ┌──────────▼───────────────────────────────────────────────┐   │
│  │ Business Logic Layer                                     │   │
│  │ - Permission & Authorization                            │   │
│  │ - User Management                                        │   │
│  │ - Chat Session Management                               │   │
│  │ - Document Processing                                   │   │
│  └──────────┬───────────────────────────────────────────────┘   │
│  ┌──────────▼───────────────────────────────────────────────┐   │
│  │ RAG Pipeline Layer (app/)                                │   │
│  │ - Document Retrieval (Vector Search)                     │   │
│  │ - Context Processing                                     │   │
│  │ - LLM Orchestration                                      │   │
│  │ - Response Generation                                    │   │
│  └──────────┬───────────────────────────────────────────────┘   │
│  ┌──────────▼───────────────────────────────────────────────┐   │
│  │ Data Access Layer                                        │   │
│  │ - SQLAlchemy ORM                                         │   │
│  │ - Database Models                                        │   │
│  │ - Query Optimization                                     │   │
│  └──────────┬───────────────────────────────────────────────┘   │
└────────────────────────────┬───────────────────────────────────┘
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
    ┌───────┐         ┌──────────┐       ┌──────────┐
    │ SQLite│         │  Chroma  │       │   LLM    │
    │ (DB)  │         │(Vector)  │       │   API    │
    └───────┘         └──────────┘       └──────────┘
```

## 📁 Directory Structure (Detailed)

```
document_intelligent_system/
│
├── README.md                    # Main project documentation
├── CONTRIBUTING.md              # Contribution guidelines
├── PROJECT_STRUCTURE.md         # This file
├── LICENSE                      # MIT License
├── .gitignore                   # Git ignore rules
│
├── backend/                     # Django REST Backend
│   │
│   ├── app/                     # Core RAG Logic
│   │   ├── __init__.py
│   │   ├── main.py              # Application startup
│   │   ├── database.py          # Database initialization
│   │   ├── rag_graph.py         # ★ RAG Pipeline execution
│   │   │                        #   - Retrieval step
│   │   │                        #   - Processing step
│   │   │                        #   - LLM generation step
│   │   │                        #   - Step tracking
│   │   ├── llm_helper.py        # ★ LLM API Integration
│   │   │                        #   - OpenAI/Claude calls
│   │   │                        #   - SSL certificate handling
│   │   │                        #   - Error handling
│   │   └── vector_store.py      # ★ Vector Database (Chroma)
│   │                            #   - Semantic search
│   │                            #   - Document indexing
│   │                            #   - Similarity queries
│   │
│   ├── django_backend/          # Django Configuration
│   │   ├── __init__.py
│   │   ├── settings.py          # Django settings, middleware
│   │   ├── urls.py              # URL routing configuration
│   │   ├── wsgi.py              # WSGI entry point
│   │   ├── asgi.py              # ASGI entry point (async)
│   │   ├── middleware.py        # Custom middleware
│   │   │                        #   - Auth middleware
│   │   │                        #   - Request logging
│   │   │                        #   - CORS handling
│   │   ├── models.py            # ★ Database Models
│   │   │                        #   - User
│   │   │                        #   - Document
│   │   │                        #   - ChatSession
│   │   │                        #   - ChatMessage
│   │   │                        #   - LLMConfig
│   │   ├── serializers.py       # DRF Serializers
│   │   │                        #   - UserSerializer
│   │   │                        #   - DocumentSerializer
│   │   │                        #   - ChatSessionSerializer
│   │   │                        #   - ChatMessageSerializer
│   │   ├── permissions.py       # ★ Permission Classes
│   │   │                        #   - IsViewerOrAbove
│   │   │                        #   - IsEditorOrAbove
│   │   │                        #   - IsAdmin
│   │   │                        #   - IsOwnerOrAdmin
│   │   │
│   │   ├── views/               # ★ API Endpoints
│   │   │   ├── __init__.py      # Exports for easy importing
│   │   │   ├── auth.py          # Authentication
│   │   │   │                    #   - login
│   │   │   │                    #   - register
│   │   │   │                    #   - refresh token
│   │   │   ├── doc_api.py       # Document CRUD
│   │   │   │                    #   - list documents
│   │   │   │                    #   - upload document
│   │   │   │                    #   - delete document
│   │   │   ├── doc_indexing.py  # Document Indexing
│   │   │   │                    #   - index documents
│   │   │   │                    #   - classify by department
│   │   │   ├── documents.py     # Additional document ops
│   │   │   ├── rag.py           # ★ Chat & RAG Endpoints
│   │   │   │                    #   - GET /chat/sessions
│   │   │   │                    #   - POST /chat/sessions
│   │   │   │                    #   - PUT /chat/sessions/{id}
│   │   │   │                    #   - DELETE /chat/sessions/{id}
│   │   │   │                    #   - GET messages
│   │   │   │                    #   - POST /chat/query
│   │   │   ├── rag_query.py     # Query-specific logic
│   │   │   ├── admin.py         # Admin Operations
│   │   │   │                    #   - delete documents
│   │   │   │                    #   - system management
│   │   │   ├── admin_graph.py   # Admin Analytics
│   │   │   ├── admin_llm.py     # Admin LLM Config
│   │   │   ├── admin_metrics.py # System Metrics
│   │   │   └── admin_users.py   # User Management
│   │   │
│   │   ├── migrations/          # Database Migrations
│   │   │   ├── __init__.py
│   │   │   ├── 0001_initial.py
│   │   │   ├── 0002_document_classification_...
│   │   │   ├── 0003_userinvitation_document_...
│   │   │   ├── 0004_passwordresetotp.py
│   │   │   └── 0005_llmconfig.py
│   │   │
│   │   └── __pycache__/         # Python bytecode cache
│   │
│   ├── uploads/                 # Temporary file uploads
│   │   ├── document1.pdf
│   │   ├── document2.docx
│   │   └── ...
│   │
│   ├── data/                    # Persistent Data Storage
│   │   ├── app.db               # SQLite database
│   │   └── chroma/              # Chroma Vector Database
│   │       ├── chroma.sqlite3
│   │       ├── uuid1/           # Document embeddings
│   │       └── uuid2/           # Document embeddings
│   │
│   ├── manage.py                # Django CLI
│   ├── run.py                   # ★ Application Entry Point
│   ├── requirements.txt         # Python Dependencies
│   ├── .env                     # Environment Variables (git-ignored)
│   ├── .env.example             # Example environment template
│   ├── README.md                # Backend Documentation
│   └── venv/                    # Virtual Environment
│
├── frontend/                    # React + Vite Application
│   │
│   ├── src/                     # Source Code
│   │   ├── pages/               # Page Components
│   │   │   ├── QueryPage.jsx    # ★ Main Chat Interface
│   │   │   │                    #   - Chat window
│   │   │   │                    #   - Chat history sidebar
│   │   │   │                    #   - Department filter
│   │   │   │                    #   - Session CRUD (3-dot menu)
│   │   │   │                    #   - RAG pipeline visualizer
│   │   │   ├── DocumentsPage.jsx # Document Management
│   │   │   ├── SettingsPage.jsx  # Settings & Configuration
│   │   │   ├── AdminAnalytics.jsx # Admin Dashboard
│   │   │   ├── AdminMetrics.jsx   # Metrics & Analytics
│   │   │   └── ...
│   │   │
│   │   ├── components/          # Reusable Components
│   │   │   ├── ChatWindow.jsx   # ★ Chat UI Component
│   │   │   │                    #   - Message display
│   │   │   │                    #   - Input area
│   │   │   │                    #   - Session selector
│   │   │   ├── Visualizer.jsx   # ★ RAG Pipeline Visualizer
│   │   │   │                    #   - Step visualization
│   │   │   │                    #   - Source highlighting
│   │   │   │                    #   - Step tracking
│   │   │   ├── LoginScreen.jsx  # Authentication
│   │   │   ├── Navbar.jsx       # Navigation
│   │   │   ├── Sidebar.jsx      # Sidebar Navigation
│   │   │   ├── admin/           # Admin Components
│   │   │   │   ├── AdminAnalytics.jsx
│   │   │   │   ├── AdminUsers.jsx
│   │   │   │   └── AdminSettings.jsx
│   │   │   ├── Icons.jsx        # Icon Components
│   │   │   ├── KnowledgeGraphVisualizer.jsx
│   │   │   └── ...
│   │   │
│   │   ├── utils/               # Utility Functions
│   │   │   ├── api.js           # API client functions
│   │   │   ├── auth.js          # Authentication helpers
│   │   │   ├── formatters.js    # Date/time formatting
│   │   │   └── ...
│   │   │
│   │   ├── assets/              # Static Assets
│   │   │   ├── hero.png
│   │   │   ├── react.svg
│   │   │   └── ...
│   │   │
│   │   ├── App.jsx              # Main App Component
│   │   ├── App.css              # App Styles
│   │   ├── index.css            # Global Styles
│   │   └── main.jsx             # Entry Point
│   │
│   ├── public/                  # Public Static Files
│   │   ├── favicon.svg
│   │   ├── icons.svg
│   │   └── ...
│   │
│   ├── index.html               # HTML Template
│   ├── package.json             # Node Dependencies
│   ├── package-lock.json        # Dependency Lock File
│   ├── vite.config.js           # Vite Configuration
│   ├── eslint.config.js         # ESLint Configuration
│   ├── .gitignore               # Git Ignore Rules
│   ├── README.md                # Frontend Documentation
│   └── node_modules/            # Dependencies
│
└── .venv/                       # Root Python Virtual Environment

★ = Core/Important files
```

## 🔄 Data Flow

### Chat Query Flow

```
User Input (QueryPage)
    ↓
ChatWindow Component
    ↓
handleSendMessage() in QueryPage
    ↓
POST /api/chat/query (REST API)
    ↓
Django Backend (rag.py view)
    ↓
Permission Check (IsViewerOrAbove)
    ↓
run_rag_pipeline() [app/rag_graph.py]
    ├─ retrieval step
    │  └─ Vector Store Search (Chroma)
    ├─ processing step
    │  └─ Context Formatting
    ├─ llm_generation step
    │  └─ LLM API Call (llm_helper.py)
    └─ formatting step
       └─ Response Formatting
    ↓
Return Response with steps & sources
    ↓
Frontend Updates State
    ├─ Set messages
    ├─ Set execution steps (for visualizer)
    └─ Display response
    ↓
Visualizer Component renders steps
    ↓
User sees response + pipeline visualization
```

### Document Upload Flow

```
User selects file (DocumentsPage)
    ↓
Upload form submission
    ↓
POST /api/documents/upload (REST API)
    ↓
Django Backend (doc_api.py)
    ↓
Permission Check (IsEditorOrAbove)
    ↓
Save file to uploads/
    ↓
doc_indexing.py processes document
    ├─ Extract text
    ├─ Split into chunks
    ├─ Generate embeddings
    └─ Classify by department
    ↓
Store in vector_store.py (Chroma)
    ↓
Save document metadata to SQLite
    ↓
Return success response
    ↓
Frontend updates document list
    ↓
User sees document in list
```

### Session Management CRUD Flow

```
Create Session
    ├─ User clicks "➕ New Chat"
    ├─ handleCreateSession() prompts for name
    ├─ POST /api/chat/sessions
    ├─ Backend creates ChatSession object
    └─ Frontend adds to sessions list

Read Sessions
    ├─ QueryPage useEffect fetches sessions
    ├─ GET /api/chat/sessions
    ├─ Backend queries ChatSession table
    └─ Frontend displays in sidebar

Update Session (Rename)
    ├─ User clicks 3-dot menu → "✏️ Rename"
    ├─ Inline edit form appears
    ├─ handleEditSessionSave()
    ├─ PUT /api/chat/sessions/{id}
    ├─ Backend updates ChatSession.name
    └─ Frontend updates UI

Delete Session
    ├─ User clicks 3-dot menu → "🗑️ Delete"
    ├─ Confirmation dialog
    ├─ handleDeleteSession()
    ├─ DELETE /api/chat/sessions/{id}
    ├─ Backend deletes ChatSession + messages
    └─ Frontend removes from list
```

## 🔐 Authentication & Authorization Flow

```
Login Page
    ↓
User enters credentials
    ↓
POST /api/auth/login
    ↓
Backend validates credentials
    ↓
Generate JWT tokens
    ├─ access_token (15 min expiry)
    └─ refresh_token (7 day expiry)
    ↓
Frontend stores token in localStorage
    ↓
All subsequent requests include header:
    Authorization: Bearer {access_token}
    ↓
Backend validates token
    ↓
Permission class checks role
    ├─ Viewer: Read-only access
    ├─ Editor: Create/edit access
    └─ Admin: Full access
    ↓
Request proceeds or returns 403 Forbidden
```

## 📊 Database Schema Overview

```
User Table
├─ id (PK)
├─ username (unique)
├─ email (unique)
├─ password_hash
├─ role (viewer/editor/admin)
├─ department
└─ created_at

Document Table
├─ id (PK)
├─ user_id (FK → User)
├─ title
├─ file_path
├─ department
├─ classification
├─ file_size
├─ upload_date
└─ metadata (JSON)

ChatSession Table
├─ id (PK)
├─ user_id (FK → User)
├─ name
├─ created_at
└─ updated_at

ChatMessage Table
├─ id (PK)
├─ session_id (FK → ChatSession)
├─ role (user/assistant)
├─ content
├─ steps (JSON) [for RAG tracking]
├─ sources (JSON) [cited documents]
└─ created_at

LLMConfig Table
├─ id (PK)
├─ user_id (FK → User)
├─ model_name
├─ api_key (encrypted)
├─ temperature
├─ max_tokens
└─ created_at
```

## 🔌 API Structure

```
REST Endpoints:

/api/auth/
├─ POST   login          # Authenticate user
├─ POST   register       # Create account
└─ POST   refresh        # Refresh JWT token

/api/chat/
├─ GET    sessions       # List sessions
├─ POST   sessions       # Create session
├─ GET    sessions/{id}  # Get session
├─ PUT    sessions/{id}  # Update session
├─ DELETE sessions/{id}  # Delete session
├─ GET    sessions/{id}/messages
└─ POST   query          # Send chat query

/api/documents/
├─ GET    .              # List documents
├─ POST   upload         # Upload document
├─ GET    {id}           # Get document
├─ DELETE {id}           # Delete document
└─ GET    search         # Search documents

/api/admin/
├─ GET    metrics        # System metrics
├─ DELETE documents/{id} # Force delete
├─ GET    users          # Manage users
└─ POST   llm/config     # Configure LLM
```

## 🎯 Key Design Patterns

### 1. MVC Pattern (Backend)
- **Models**: Django ORM models (models.py)
- **Views**: DRF API views (views/*.py)
- **Controllers**: Business logic in views

### 2. Component-Based Architecture (Frontend)
- Reusable React components
- Props drilling minimized with Context
- State management with React Hooks

### 3. RAG Pipeline Architecture
- Modular steps (retrieval, processing, generation)
- Step tracking for visualization
- Error handling and fallbacks

### 4. Permission-Based Access Control
- Granular role-based permissions
- Permission classes in views
- Serializer-level filtering

## 🔄 State Management

### Backend State
- SQLite database (persistent)
- Session variables (request scope)
- Cached data (optional Redis)

### Frontend State
- React hooks (useState)
- localStorage (persistence)
- sessionStorage (temporary)

## 📈 Scalability Considerations

### Horizontal Scaling
- Stateless backend (can run multiple instances)
- Load balancer required
- Shared database needed

### Vertical Scaling
- Increase server resources
- Optimize queries
- Implement caching

### Optimization
- Database indexing
- Query pagination
- Lazy loading components
- Image optimization

---

This structure provides a clear separation of concerns and allows for easy maintenance and scalability.

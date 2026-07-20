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
    └────────┘   └──────────┘  └──────────┘  └──────────┘
        │              │             │            │
        └──────────────┼─────────────┴────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    ┌────────────┐ ┌──────────┐ ┌──────────────┐
    │   Django   │ │ Vector   │ │ PostgreSQL/  │
    │  ORM Models│ │   Store  │ │   SQLite     │
    │            │ │ (Chroma) │ │              │
    └────────────┘ └──────────┘ └──────────────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ LLM APIs │  │ Document │  │  Vector  │
    │(OpenAI) │  │ Processing   │  Database│
    │          │  │ (PDF/Text)   │          │
    └──────────┘  └──────────┘  └──────────┘
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
    ├─ Step 2: Search vector store (filtered by department)
    │          Returns: Top-K similar chunks
    │
    ├─ Step 3: Retrieve full document context
    │
    ├─ Step 4: Build prompt with context + query
    │
    ├─ Step 5: Call LLM API (OpenAI GPT-4)
    │
    ├─ Step 6: Stream response back to frontend
    │
    └─ Step 7: Save ChatMessage (assistant role) with sources
    │
    ▼
Response: {
    content: "Answer from LLM",
    sources: [...],
    steps: [...]
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
├─ Query Embedding Generation
├─ Vector Store Search (Chroma)
├─ Document Retrieval
├─ Prompt Construction
├─ LLM API Calls (OpenAI)
└─ Response Processing
```

### Chat Module

```
Chat Service manages:
├─ Session CRUD operations
├─ Message storage
├─ Query routing to RAG
├─ Response formatting
└─ Source attribution
```

### Document Module

```
Document Service handles:
├─ File upload & validation
├─ Text extraction (PDF/Text)
├─ Chunking strategy
├─ Embedding generation
├─ Vector store indexing
└─ Metadata storage
```

### Admin Module

```
Admin Service provides:
├─ User management
├─ Document deletion
├─ Analytics & reporting
├─ LLM configuration
└─ System monitoring
```

---

## 🎨 Frontend Architecture

### Page Components

```
App (Root)
├─ LoginScreen
├─ MainLayout
│  ├─ Sidebar
│  └─ MainContent
│     ├─ QueryPage
│     │  ├─ ChatWindow
│     │  ├─ Visualizer
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

### Backend ↔ LLM (OpenAI)

```
HTTPS API Calls:
├─ POST /v1/embeddings (Generate embeddings)
├─ POST /v1/chat/completions (Get responses)
└─ Authentication: API Key

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
   ├─ Query cache for similar questions
   ├─ Vector search cache
   └─ Document chunk cache

2. Indexing
   ├─ Vector database indexing
   ├─ Full-text search indexing
   └─ Department-based partitioning

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
   ├─ Chunk size: 512 tokens
   ├─ Overlap: 100 tokens
   └─ Max vectors per collection: 1M

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
   └─ Multi-language support

2. Performance
   ├─ Vector store caching
   ├─ Query result caching
   ├─ Batch processing
   └─ Async background jobs

3. Security
   ├─ End-to-end encryption
   ├─ Document watermarking
   ├─ Audit logging
   └─ IP whitelisting

4. Infrastructure
   ├─ Kubernetes deployment
   ├─ Auto-scaling groups
   ├─ Disaster recovery
   └─ Multi-region setup
```

---

## 📚 References

- [Django REST Framework](https://www.django-rest-framework.org/)
- [React Documentation](https://react.dev/)
- [Chroma Vector Store](https://www.trychroma.com/)
- [OpenAI API](https://openai.com/api/)
- [JWT Authentication](https://jwt.io/)

---

**Last Updated**: May 2026
**Version**: 1.0
**Status**: Production Ready

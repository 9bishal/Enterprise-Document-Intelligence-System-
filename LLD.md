# Low-Level Design (LLD) - Document Intelligent System

## 🔧 Detailed Component Design

This document provides detailed technical specifications for each component of the Document Intelligent System.

---

## 📦 Backend Architecture (Django)

### 1. Project Structure

```
backend/
├── manage.py                 # Django CLI entry point
├── run.py                    # Custom server runner
├── requirements.txt          # Python dependencies
├── app/                      # Core RAG application
│   ├── __init__.py
│   ├── database.py           # Database initialization
│   ├── llm_helper.py         # LLM API wrapper (multi-provider, fallback, cost tracking)
│   ├── rag_graph.py          # RAG pipeline orchestration (hybrid, rerank, cache, eval)
│   ├── vector_store.py       # Vector store operations (hybrid search, semantic chunking)
│   ├── main.py               # Main application entry (route registration)
│   ├── analytics.py          # Langfuse tracing integration
│   ├── semantic_chunk.py     # Semantic document chunking
│   ├── evaluation/           # Response evaluation
│   │   ├── __init__.py
│   │   └── evaluator.py      # Heuristic scores + LLM judge
│   └── retrieval/            # Hybrid retrieval pipeline
│       ├── __init__.py
│       ├── hybrid.py         # Dense + BM25 fusion via RRF
│       ├── bm25.py           # BM25 keyword search
│       ├── reranker.py       # Relevance reranking & filtering
│       └── context_builder.py # Token-budget-aware context assembly
├── django_backend/           # Django project config
│   ├── settings.py           # Django settings (Redis, structured logging)
│   ├── urls.py               # URL routing (health, cache, batch)
│   ├── wsgi.py               # WSGI config
│   ├── asgi.py               # ASGI config
│   ├── models.py             # Django ORM models (encrypted keys, cost fields)
│   ├── serializers.py        # DRF serializers (with cost/model fields)
│   ├── permissions.py        # Custom permission classes
│   ├── middleware.py         # Custom middleware
│   ├── migrations/           # Database migrations
│   ├── cache/                # Multi-layer caching
│   │   ├── __init__.py
│   │   ├── base.py           # Cache base class
│   │   ├── config.py         # Cache configuration
│   │   ├── semantic_cache.py # RBAC-aware semantic response cache
│   │   ├── embedding_cache.py # Embedding cache
│   │   ├── domain_caches.py  # Domain-specific caches
│   │   ├── manager.py        # Cache manager
│   │   └── metrics.py        # Cache metrics
│   ├── cost_tracking/        # LLM cost tracking
│   │   ├── __init__.py
│   │   ├── pricing.py        # Provider model pricing tables
│   │   └── tracker.py        # Usage & cost aggregation
│   ├── monitoring/           # System monitoring
│   │   ├── __init__.py
│   │   ├── metrics.py        # Prometheus metrics
│   │   └── health.py         # Health check endpoints
│   └── views/                # API endpoints
│       ├── __init__.py
│       ├── auth.py           # Authentication endpoints
│       ├── rag.py            # RAG/chat endpoints (with fallback, cost tracking)
│       ├── documents.py      # Document endpoints
│       ├── doc_indexing.py   # Document indexing (RQ/ThreadPool)
│       ├── doc_api.py        # Document CRUD (batch upload, pagination)
│       ├── admin.py          # Admin endpoints
│       └── admin_*.py        # Admin specialized endpoints
├── data/                     # Data storage
│   ├── app.db                # SQLite database
│   └── chroma/               # Vector store
└── uploads/                  # User uploaded files
```

### 2. Core Models (Django ORM)

#### User Model

```python
class User(AbstractBaseUser, PermissionsMixin):
    id = UUIDField(primary_key=True, default=uuid4)
    username = CharField(unique=True, max_length=150)
    email = EmailField(unique=True)
    first_name = CharField(max_length=30)
    last_name = CharField(max_length=150)
    
    # Role-based access
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('editor', 'Editor'),
        ('viewer', 'Viewer'),
    ]
    role = CharField(max_length=10, choices=ROLE_CHOICES, default='viewer')
    
    # Department affiliation
    DEPARTMENT_CHOICES = [
        ('HR', 'Human Resources'),
        ('Legal', 'Legal'),
        ('Finance', 'Finance'),
        ('Technical', 'Technical'),
        ('General', 'General'),
    ]
    department = CharField(max_length=50, choices=DEPARTMENT_CHOICES)
    
    is_active = BooleanField(default=True)
    is_staff = BooleanField(default=False)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    
    # Metadata
    profile_picture = ImageField(upload_to='avatars/', null=True, blank=True)
    bio = TextField(blank=True)
    last_login_ip = CharField(max_length=45, null=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [Index(fields=['email']), Index(fields=['department'])]
```

#### Document Model

```python
class Document(Model):
    id = UUIDField(primary_key=True, default=uuid4)
    
    # File information
    title = CharField(max_length=255)
    filename = CharField(max_length=255)
    file_path = FileField(upload_to='documents/')
    file_size = IntegerField()  # in bytes
    file_type = CharField(max_length=10)  # pdf, txt, docx
    
    # Classification & Department
    CLASSIFICATION_CHOICES = [
        ('HR', 'Human Resources'),
        ('Legal', 'Legal'),
        ('Finance', 'Finance'),
        ('Technical', 'Technical'),
        ('General', 'General'),
    ]
    classification = CharField(max_length=50, choices=CLASSIFICATION_CHOICES)
    department = CharField(max_length=50)  # Denormalized for query speed
    
    # Content metadata
    content_hash = CharField(max_length=64, unique=True)  # SHA256
    num_pages = IntegerField(default=1)
    total_chunks = IntegerField(default=0)
    
    # Processing status
    is_indexed = BooleanField(default=False)
    index_status = CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('processing', 'Processing'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )
    
    # Relationships
    uploaded_by = ForeignKey(User, on_delete=CASCADE, related_name='documents')
    
    # Timestamps
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    indexed_at = DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            Index(fields=['department', 'is_indexed']),
            Index(fields=['classification']),
            Index(fields=['content_hash']),
        ]
```

#### ChatSession Model

```python
class ChatSession(Model):
    id = UUIDField(primary_key=True, default=uuid4)
    
    # Session info
    name = CharField(max_length=255)
    description = TextField(blank=True)
    
    # Relationships
    user = ForeignKey(User, on_delete=CASCADE, related_name='chat_sessions')
    
    # Metadata
    message_count = IntegerField(default=0)
    last_query = TextField(blank=True)
    
    # Timestamps
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [Index(fields=['user', 'created_at'])]
```

#### ChatMessage Model

```python
class ChatMessage(Model):
    id = UUIDField(primary_key=True, default=uuid4)
    
    # Message content
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
    ]
    role = CharField(max_length=20, choices=ROLE_CHOICES)
    content = TextField()
    
    # RAG metadata
    sources = JSONField(default=list)  # [{id, title, page, chunk_text}]
    steps = JSONField(default=list)    # [{step_name, status, duration}]
    
    # Processing metadata
    tokens_used = IntegerField(null=True)
    processing_time_ms = IntegerField(null=True)
    
    # Cost & model tracking (added v2.0)
    model_used = CharField(max_length=100, null=True, blank=True)
    input_tokens = IntegerField(null=True)
    output_tokens = IntegerField(null=True)
    estimated_cost_usd = FloatField(null=True)
    latency_ms = FloatField(null=True)
    cache_hit = BooleanField(default=False)
    
    # Relationships
    session = ForeignKey(ChatSession, on_delete=CASCADE, related_name='messages')
    
    # Timestamps
    created_at = DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
        indexes = [Index(fields=['session', 'created_at'])]
```

---

## 🔌 API Endpoints (REST)

### Authentication Endpoints

#### POST /api/auth/login
```
Request:
{
  "username": "user@example.com",
  "password": "password123"
}

Response (200):
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": "uuid",
    "username": "user@example.com",
    "role": "editor",
    "department": "HR"
  }
}

Error (401):
{
  "detail": "Invalid credentials"
}
```

#### POST /api/auth/register
```
Request:
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "securepass123",
  "department": "HR"
}

Response (201):
{
  "id": "uuid",
  "username": "newuser",
  "email": "user@example.com",
  "department": "HR"
}

Error (400):
{
  "detail": "User already exists"
}
```

### Chat Session Endpoints

#### GET /api/chat/sessions
```
Headers: Authorization: Bearer <token>

Response (200):
[
  {
    "id": "uuid",
    "name": "HR Policy Discussion",
    "created_at": "2026-05-23T10:30:00Z",
    "message_count": 5,
    "last_query": "What are the vacation policies?"
  },
  ...
]

Access Control: Viewer+ (all users can see their own sessions)
```

#### POST /api/chat/sessions
```
Headers: Authorization: Bearer <token>
Body:
{
  "name": "New Chat Session"
}

Response (201):
{
  "id": "uuid-new-session",
  "name": "New Chat Session",
  "created_at": "2026-05-23T10:30:00Z",
  "message_count": 0
}

Access Control: Viewer+ (all authenticated users)
```

#### PUT /api/chat/sessions/{id}
```
Headers: Authorization: Bearer <token>
Body:
{
  "name": "Renamed Session"
}

Response (200):
{
  "id": "uuid",
  "name": "Renamed Session",
  "updated_at": "2026-05-23T11:00:00Z"
}

Error (404):
{
  "detail": "Session not found or unauthorized"
}

Access Control: Session owner only
```

#### DELETE /api/chat/sessions/{id}
```
Headers: Authorization: Bearer <token>

Response (204): No Content

Error (404):
{
  "detail": "Session not found or unauthorized"
}

Access Control: Session owner only
```

### Chat Query Endpoints

#### GET /api/chat/sessions/{id}/messages
```
Headers: Authorization: Bearer <token>
Query Params: ?page=1&limit=50

Response (200):
{
  "results": [
    {
      "id": "uuid",
      "role": "user",
      "content": "What are the vacation policies?",
      "created_at": "2026-05-23T10:30:00Z"
    },
    {
      "id": "uuid2",
      "role": "assistant",
      "content": "Based on the HR documents, vacation policies are...",
      "sources": [
        {
          "id": "doc-uuid",
          "title": "HR_Policy_2026.pdf",
          "page": 5,
          "relevance": 0.95
        }
      ],
      "steps": [
        {
          "name": "Query Embedding",
          "status": "completed",
          "duration_ms": 150
        },
        {
          "name": "Vector Search",
          "status": "completed",
          "duration_ms": 200
        },
        {
          "name": "LLM Response",
          "status": "completed",
          "duration_ms": 2500
        }
      ],
      "created_at": "2026-05-23T10:30:05Z"
    }
  ],
  "count": 2,
  "next": null
}

Access Control: Session owner only
```

#### POST /api/chat/query
```
Headers: Authorization: Bearer <token>
Body:
{
  "session_id": "session-uuid",
  "question": "What are the vacation policies?",
  "department": "HR",
  "api_keys": { "openai": "sk-..." },
  "config": {
    "model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 2000
  }
}

Response (200):
{
  "id": "msg-uuid",
  "content": "Based on the HR documents...",
  "sources": [
    {
      "id": "doc-uuid",
      "title": "HR_Policy_2026.pdf",
      "page": 5,
      "relevance": 0.95,
      "chunk_text": "Employees are entitled to 20 days of vacation..."
    }
  ],
  "steps": [
    {
      "name": "Query Embedding",
      "status": "completed",
      "duration_ms": 150,
      "details": "Generated embedding with 1536 dimensions"
    },
    {
      "name": "Hybrid Search",
      "status": "completed",
      "duration_ms": 320,
      "details": "Dense + BM25 search via RRF, found 8 chunks"
    },
    {
      "name": "Reranking",
      "status": "completed",
      "duration_ms": 45,
      "details": "Reranked 8 chunks, filtered to 5 above threshold"
    },
    {
      "name": "Context Assembly",
      "status": "completed",
      "duration_ms": 30,
      "details": "Built context with 3 chunks (within 3000 token budget)"
    },
    {
      "name": "LLM Response",
      "status": "completed",
      "duration_ms": 2500,
      "details": "Generated 450 tokens using llama-3.3-70b-versatile"
    },
    {
      "name": "Evaluation",
      "status": "completed",
      "duration_ms": 120,
      "details": "Heuristic score: 0.85, LLM judge: 4/5"
    }
  ],
  "model_used": "llama-3.3-70b-versatile",
  "input_tokens": 450,
  "output_tokens": 120,
  "estimated_cost_usd": 0.00015,
  "latency_ms": 1250,
  "cache_hit": false,
  "evaluation": {
    "heuristic": 0.85,
    "llm_judge": 4,
    "is_grounded": true
  }
}

Error (400):
{
  "detail": "Invalid query or department"
}

Access Control: Viewer+ (all authenticated users)
```

### Document Endpoints

#### GET /api/documents
```
Headers: Authorization: Bearer <token>
Query Params: ?department=HR&classification=General&page=1

Response (200):
{
  "results": [
    {
      "id": "doc-uuid",
      "title": "HR Policy 2026",
      "filename": "HR_Policy_2026.pdf",
      "file_size": 2048576,
      "classification": "HR",
      "department": "HR",
      "is_indexed": true,
      "num_pages": 12,
      "uploaded_by": "admin@example.com",
      "created_at": "2026-05-20T10:30:00Z"
    }
  ],
  "count": 5,
  "next": "http://api/documents?page=2"
}

Access Control: Viewer+ (can see indexed documents of their department)
```

#### POST /api/documents/upload
```
Headers: Authorization: Bearer <token>
Body: FormData
- file: [Binary PDF/TXT/DOCX]
- classification: "HR"
- department: "HR"

Response (201):
{
  "id": "doc-uuid",
  "title": "New Document",
  "status": "processing",
  "message": "Document uploaded. Indexing in progress..."
}

Error (413):
{
  "detail": "File too large. Max 50MB"
}

Error (415):
{
  "detail": "Unsupported file type"
}

Access Control: Editor+ (only Editors and Admins can upload)
```

#### DELETE /api/documents/{id}
```
Headers: Authorization: Bearer <token>

Response (204): No Content

Error (403):
{
  "detail": "Only admins can delete documents"
}

Access Control: Admin only
```

---

## 🧠 RAG Pipeline Implementation

### rag_graph.py (v2.0 - updated pipeline)

```python
class RAGPipeline:
    def __init__(self, config: Dict):
        self.config = config
        self.llm = LLMHelper(config)
        self.vector_store = VectorStore()
        self.steps = []
    
    def run(self, query: str, department: str, user=None) -> Dict:
        """
        Execute RAG pipeline with hybrid search, reranking, fallback, evaluation.
        
        Returns:
            {
                'content': 'Generated response',
                'sources': [...],
                'steps': [...],
                'model_used': '...',
                'input_tokens': int,
                'output_tokens': int,
                'estimated_cost_usd': float,
                'latency_ms': float,
                'cache_hit': bool,
                'evaluation': {...}
            }
        """
        self.steps = []
        pipeline_start = time.time()
        
        # Step 1: Query Embedding
        step1 = self._embed_query(query)
        self.steps.append(step1)
        
        # Step 2: Hybrid Search (dense + BM25 via RRF)
        step2 = self._hybrid_search(step1['embedding'], query, department)
        self.steps.append(step2)
        
        # Step 3: Rerank results
        step3 = self._rerank(step2['chunks'], query)
        self.steps.append(step3)
        
        # Step 4: Check semantic cache
        cache_result = self._check_cache(query, department, user)
        if cache_result['hit']:
            self.steps.append(cache_result['step'])
            return {**cache_result['response'], 'pipeline_ms': int((time.time()-pipeline_start)*1000)}
        
        # Step 5: Context Assembly
        step5 = self._build_context(step3['chunks'], query)
        self.steps.append(step5)
        
        # Step 6: LLM Generation (with fallback)
        step6 = self._call_llm_with_fallback(step5['prompt'])
        self.steps.append(step6)
        
        # Step 7: Evaluation
        step7 = self._evaluate(query, step6['response'], step3['chunks'])
        self.steps.append(step7)
        
        # Step 8: Cache the result
        self._cache_response(query, department, user, step6, step3['sources'])
        
        return {
            'content': step6['response'],
            'sources': step3['sources'],
            'steps': self.steps,
            'model_used': step6['model_used'],
            'input_tokens': step6.get('input_tokens', 0),
            'output_tokens': step6.get('output_tokens', 0),
            'estimated_cost_usd': step6.get('cost_usd', 0),
            'latency_ms': int((time.time()-pipeline_start)*1000),
            'cache_hit': False,
            'evaluation': step7
        }
    
    def _call_llm_with_fallback(self, prompt: List) -> Dict:
        """Call primary LLM, fallback to secondary on failure"""
        try:
            return self.llm.chat_completion(
                messages=prompt,
                model=self.config.get('model', 'llama-3.3-70b-versatile'),
                temperature=self.config.get('temperature', 0.7),
                max_tokens=self.config.get('max_tokens', 2000)
            )
        except Exception:
            fallback_model = self.config.get('fallback_model', 'llama-3.1-8b-instant')
            return self.llm.chat_completion(
                messages=prompt,
                model=fallback_model,
                temperature=self.config.get('temperature', 0.7)
            )
```

---

## 🔑 Key Algorithms

### Vector Search Algorithm

```python
def vector_search(query_embedding, top_k=5, department=None):
    """
    Similarity search in vector store
    
    Algorithm:
    1. Convert query to embedding (1536-dim vector)
    2. Compute cosine similarity with all document vectors
    3. Filter by department (if specified)
    4. Return top-k most similar vectors
    5. Retrieve original text from database
    
    Complexity:
    - Time: O(n) where n = number of vectors
    - Space: O(k) where k = top_k results
    - With indexing: O(log n) with HNSW index
    """
    results = vector_store.query(
        query_embedding=query_embedding,
        n_results=top_k,
        where_document={"$contains": department} if department else None
    )
    return results
```

### Document Chunking Algorithm

```python
def chunk_document(text, chunk_size=512, overlap=100):
    """
    Split document into overlapping chunks
    
    Algorithm:
    1. Split text by sentences/paragraphs
    2. Combine sentences until reaching chunk_size
    3. Create overlap by including last `overlap` tokens from previous chunk
    4. Generate embedding for each chunk
    5. Store with metadata (page, position, etc)
    
    Example:
    Text: "This is sentence 1. This is sentence 2. This is sentence 3."
    Chunk 1 (tokens 0-512): "This is sentence 1. This is sentence 2..."
    Chunk 2 (tokens 412-924): "This is sentence 2... This is sentence 3..."
    (100 token overlap)
    """
    chunks = []
    words = text.split()
    
    for i in range(0, len(words), chunk_size - overlap):
        chunk_words = words[i:i + chunk_size]
        chunk_text = ' '.join(chunk_words)
        chunks.append(chunk_text)
    
    return chunks
```

---

## 🎨 Frontend Architecture (React/Vite)

### Component Hierarchy

```
App/
├── ErrorBoundary (wraps entire app)
├── ToastProvider (notification context)
├── Router
│  ├── LandingPage (welcome/feature showcase)
│  ├── LoginScreen
│  └── MainLayout
│     ├── Sidebar
│     │  ├── Navigation
│     │  └── UserProfile
│     └── MainContent
│        ├── QueryPage
│        │  ├── ChatWindow
│        │  │  ├── ChatHistory
│        │  │  ├── ChatInput
│        │  │  └── MessageDisplay
│        │  ├── Visualizer
│        │  │  ├── StepsList
│        │  │  ├── FlowGraph
│        │  │  ├── MetricsDisplay (cost, latency, model, cache)
│        │  │  └── EvaluationDisplay
│        │  └── LeftSidebar
│        │     ├── NewChatButton
│        │     ├── DepartmentFilter (SVG icons)
│        │     ├── ChatHistory
│        │     └── ChatMenus (SVG icons)
│        │
│        ├── DocumentsPage
│        │  ├── DocumentUpload (single + batch)
│        │  ├── DocumentList
│        │  ├── DocumentFilters
│        │  ├── DocumentCard (SVG icons)
│        │  └── ProgressBar
│        │
│        ├── SettingsPage
│        │  ├── ModelTiersInfo (read-only for non-admins)
│        │  └── AdminOnlyConfig
│        │
│        └── AdminDashboard
│           ├── UserManagement
│           ├── DocumentAnalytics
│           ├── AdminAnalytics
│           ├── AdminRoster
│           ├── AdminGraph
│           ├── AdminSystemConfig (with tier labels)
│           └── SystemMonitoring
```

### State Management Pattern

```javascript
// QueryPage.jsx state structure (v2.0)
const [sessions, setSessions] = useState([])        // Chat sessions
const [activeSessionId, setActiveSessionId] = useState(null)
const [messages, setMessages] = useState([])        // Chat messages (with cost/metadata)
const [adminActiveDepartment, setAdminActiveDepartment] = useState('All')
const [openMenuId, setOpenMenuId] = useState(null)  // 3-dot menu
const [editingSessionId, setEditingSessionId] = useState(null)
const [executionSteps, setExecutionSteps] = useState([]) // RAG steps
const [showVisualizer, setShowVisualizer] = useState(true)

// Derived state (v2.0)
const lastAssistantMsg = useMemo(
  () => messages.filter(m => m.role === 'assistant').slice(-1)[0],
  [messages]
)
```

### Shared Constants & safeLocalStorage

```javascript
// src/utils/constants.js
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8001/api';

export const MODEL_TIERS = { ECONOMY: 'economy', STANDARD: 'standard', ADVANCED: 'advanced' };

export const TIER_LABELS = {
  [MODEL_TIERS.ECONOMY]: { label: 'Economy', color: '#648F64', bg: 'rgba(100, 143, 100, 0.12)' },
  [MODEL_TIERS.STANDARD]: { label: 'Standard', color: '#6478A0', bg: 'rgba(100, 120, 160, 0.12)' },
  [MODEL_TIERS.ADVANCED]: { label: 'Advanced', color: '#9A7832', bg: 'rgba(154, 120, 50, 0.12)' },
};

export const PROVIDER_MODELS = {
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", tier: MODEL_TIERS.STANDARD },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", tier: MODEL_TIERS.ECONOMY }
  ],
  gemini: [
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", tier: MODEL_TIERS.ECONOMY },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", tier: MODEL_TIERS.ADVANCED }
  ],
  openai: [
    { id: "gpt-4o-mini", name: "GPT-4o Mini", tier: MODEL_TIERS.ECONOMY },
    { id: "gpt-4o", name: "GPT-4o", tier: MODEL_TIERS.ADVANCED }
  ],
  ollama: [
    { id: "llama3", name: "Llama 3", tier: MODEL_TIERS.ECONOMY },
  ]
};

export function safeLocalStorage() {
  const store = {};
  return {
    getItem(key) {
      if (typeof store[key] !== 'undefined') return store[key];
      try { const v = localStorage.getItem(key); store[key] = v; return v; }
      catch { return null; }
    },
    setItem(key, value) {
      store[key] = value;
      try { localStorage.setItem(key, value); } catch {}
    },
    removeItem(key) {
      delete store[key];
      try { localStorage.removeItem(key); } catch {}
    }
  };
}
```

### API Call Patterns

```javascript
// Fetch operations (v2.0 uses safeLocalStorage + shared API_BASE)
import { API_BASE, safeLocalStorage } from './constants';
const storage = safeLocalStorage();

const fetchSessions = async () => {
  const res = await fetch(`${API_BASE}/chat/sessions`, {
    headers: { 'Authorization': `Bearer ${storage.getItem('intradoc_token')}` }
  })
  return res.json()
}

// Create operation
const handleCreateSession = async (name) => {
  const res = await fetch(`${API_BASE}/chat/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name })
  })
  return res.json()
}

// Update operation
const handleEditSessionSave = async (sessionId, name) => {
  const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name })
  })
  return res.json()
}

// Delete operation
const handleDeleteSession = async (sessionId) => {
  const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return res.status === 204
}
```

---

## 🔐 Security Implementation

### Password Security

```python
# Django automatically hashes passwords
user.set_password(password)  # Uses PBKDF2-SHA256
user.save()

# Verification
if user.check_password(provided_password):
    # Password is correct
```

### JWT Token Management

```python
# Token generation
from rest_framework_simplejwt.tokens import RefreshToken

refresh = RefreshToken.for_user(user)
access_token = str(refresh.access_token)
refresh_token = str(refresh)

# Token verification (automatic via decorator)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def protected_view(request):
    # Token is verified before this code runs
```

### Permission Classes

```python
# Custom permission hierarchy
class IsViewerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ['viewer', 'editor', 'admin']

class IsEditorOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ['editor', 'admin']

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'admin'

# Usage
@api_view(['POST'])
@permission_classes([IsEditorOrAbove])
def upload_document(request):
    # Only editors and admins can access
```

### CORS Configuration

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",      # Dev frontend
    "https://yourdomain.com",      # Production
]

CORS_ALLOW_CREDENTIALS = True
```

---

## 📊 Database Schema

### Key Indexes

```sql
-- User queries
CREATE INDEX idx_user_email ON django_backend_user(email);
CREATE INDEX idx_user_department ON django_backend_user(department);

-- Document queries
CREATE INDEX idx_doc_department_indexed ON document(department, is_indexed);
CREATE INDEX idx_doc_classification ON document(classification);
CREATE INDEX idx_doc_content_hash ON document(content_hash);

-- Chat queries
CREATE INDEX idx_session_user_created ON chat_session(user_id, created_at);
CREATE INDEX idx_message_session_created ON chat_message(session_id, created_at);

-- Vector store queries
CREATE INDEX idx_chunk_document ON document_chunk(document_id);
CREATE INDEX idx_chunk_embedding ON document_chunk(embedding_id);
```

---

## ⚡ Performance Optimizations

### Query Optimization

```python
# Use select_related for foreign keys
sessions = ChatSession.objects.select_related('user').filter(user=request.user)

# Use prefetch_related for many-to-many
documents = Document.objects.prefetch_related('chunks').filter(department='HR')

# Use only() to limit fields
users = User.objects.only('id', 'username', 'email')
```

### Caching Strategy

```python
# Cache expensive operations
from django.views.decorators.cache import cache_page

@cache_page(60 * 15)  # Cache for 15 minutes
def get_popular_documents(request):
    return Document.objects.filter(is_indexed=True).order_by('-views')[:10]

# Cache embeddings
embedding_cache = {}

def get_query_embedding(query):
    if query in embedding_cache:
        return embedding_cache[query]
    
    embedding = llm.get_embedding(query)
    embedding_cache[query] = embedding
    return embedding
```

### Pagination

```python
# REST Framework pagination
DEFAULT_PAGINATION_CLASS = 'rest_framework.pagination.PageNumberPagination'
PAGE_SIZE = 20

# Usage
from rest_framework.pagination import PageNumberPagination

class DocumentListView(generics.ListAPIView):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    pagination_class = PageNumberPagination
```

---

## 🧪 Testing Strategy

### Unit Tests

```python
# test_models.py
from django.test import TestCase

class UserModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_user_creation(self):
        self.assertEqual(self.user.username, 'testuser')
        self.assertTrue(self.user.check_password('testpass123'))

# test_rag_pipeline.py
class RAGPipelineTest(TestCase):
    def test_embedding_generation(self):
        pipeline = RAGPipeline(config)
        embedding = pipeline._embed_query("Test query")
        self.assertIsNotNone(embedding['embedding'])
        self.assertEqual(len(embedding['embedding']), 1536)
```

### Integration Tests

```python
# test_api_endpoints.py
from rest_framework.test import APITestCase

class ChatAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser')
        self.token = self._get_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
    
    def test_create_session(self):
        response = self.client.post('/api/chat/sessions', {'name': 'Test'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['name'], 'Test')
```

---

## 📈 Scalability Notes

### Bottlenecks & Solutions

| Bottleneck | Current | Solution |
|-----------|---------|----------|
| Vector search latency | O(n) linear scan | HNSW indexing, Pinecone |
| LLM API calls | Sequential | Batch processing, caching |
| Database queries | Single DB | Read replicas, sharding |
| File processing | Sequential | Celery async tasks |
| Frontend bundle size | Depends on deps | Code splitting, lazy loading |

### Load Testing

```bash
# Apache Bench
ab -n 1000 -c 10 http://localhost:8000/api/chat/sessions

# Locust
locust -f locustfile.py --host=http://localhost:8000
```

---

## 🔄 Deployment Checklist

```
Backend:
□ Set SECRET_KEY to random value
□ Set DEBUG=False
□ Configure ALLOWED_HOSTS
□ Setup PostgreSQL (not SQLite)
□ Run migrations
□ Configure CORS for production domain
□ Setup SSL certificates
□ Configure logging (structured)
□ Setup Redis server (for caching & job queue)
□ Configure REDIS_URL env var
□ Setup monitoring/alerts (Prometheus)
□ Configure Langfuse tracing (optional)
□ Enable structured logging
□ Run RQ worker for async job processing

Frontend:
□ Build with npm run build
□ Set VITE_API_BASE to production API
□ Configure CDN
□ Setup caching headers
□ Enable gzip compression
□ Setup error tracking (Sentry)

Infrastructure:
□ Setup load balancer
□ Configure auto-scaling
□ Setup database backups
□ Configure Redis caching
□ Setup logging aggregation
□ Configure monitoring
```

---

**Last Updated**: July 2026
**Version**: 2.0
**Status**: Production Ready

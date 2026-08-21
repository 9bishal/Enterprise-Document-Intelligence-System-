# Component Architecture Diagram

## High-Level Component Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React + Vite)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │   Login     │  │   Query     │  │  Documents  │  │    Settings     │   │
│  │  Screen     │  │   Page      │  │   Page      │  │    Page         │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘   │
│         │                │                │                 │             │
│         └────────────────┼────────────────┼─────────────────┘             │
│                          ▼                ▼                               │
│                 ┌─────────────────────────────────┐                       │
│                 │      API Client (utils/api)     │                       │
│                 │  • Auth headers • Error handling│                       │
│                 └──────────────┬──────────────────┘                       │
│                                │                                          │
└────────────────────────────────┼──────────────────────────────────────────┘
                                 │ HTTPS/REST + JWT
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Django REST Framework)                    │
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │   Auth Module    │  │  Document Module │  │      Chat Module         │  │
│  │                  │  │                  │  │                          │  │
│  │ • Login/Signup   │  │ • Upload/Parse   │  │ • Session Management     │  │
│  │ • JWT Tokens     │  │ • Chunk/Embed    │  │ • Message History        │  │
│  │ • RBAC/Profiles  │  │ • ChromaDB Store │  │ • RAG Query Endpoint     │  │
│  │ • Invitations    │  │ • Dept/Classify  │  │ • Streaming Support      │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────┬─────────────┘  │
│           │                     │                          │               │
│           └─────────────────────┼──────────────────────────┘               │
│                                 ▼                                           │
│                    ┌────────────────────────┐                              │
│                    │    Admin Module        │                              │
│                    │                        │                              │
│                    │ • User Roster          │                              │
│                    │ • Analytics/Metrics    │                              │
│                    │ • Knowledge Graph      │                              │
│                    │ • System Config (LLM)  │                              │
│                    └───────────┬────────────┘                              │
│                                │                                           │
└────────────────────────────────┼──────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
         ┌─────────────────┐         ┌─────────────────┐
         │   PostgreSQL    │         │    ChromaDB     │
         │   (Metadata)    │         │   (Vectors)     │
         │                 │         │                 │
         │ • Users         │         │ • Embeddings    │
         │ • Profiles      │         │ • Chunks        │
         │ • Documents     │         │ • Metadata      │
         │ • Sessions      │         │ • Dept filters  │
         │ • Messages      │         │                 │
         │ • LLMConfig     │         │                 │
         │ • Invitations   │         │                 │
         └─────────────────┘         └─────────────────┘
```

## Backend Module Structure

```
backend/
├── app/                          # Core RAG Logic (Pure Python)
│   ├── rag_graph.py              # LangGraph workflow definition
│   ├── vector_store.py           # ChromaDB wrapper + embeddings
│   ├── llm_helper.py             # Multi-provider LLM abstraction
│   ├── retrieval/
│   │   ├── reranker.py           # CrossEncoder reranking
│   │   └── context_builder.py    # Context window optimization
│   └── evaluation/
│       └── evaluator.py          # Faithfulness/groundedness metrics
│
├── django_backend/               # Django Application
│   ├── models.py                 # User, Document, Session, Message, LLMConfig
│   ├── views/
│   │   ├── auth.py               # JWT auth endpoints
│   │   ├── rag.py                # Chat/RAG endpoints
│   │   ├── documents.py          # Document CRUD
│   │   └── admin_views.py        # Admin dashboard endpoints
│   ├── permissions.py            # IsViewerOrAbove, IsAdminOrAbove
│   ├── serializers.py            # DRF serializers
│   └── cache/                    # Semantic caching layer
│       ├── semantic_cache.py
│       └── domain_caches.py
│
└── requirements.txt              # Dependencies
```

## Frontend Component Structure

```
frontend/src/
├── components/
│   ├── AdminDashboard.jsx        # Admin console (4 tabs)
│   ├── ChatWindow.jsx            # Chat interface
│   ├── Sidebar.jsx               # Doc upload + model config
│   ├── Visualizer.jsx            # Pipeline step visualization
│   ├── LoginScreen.jsx           # Auth UI
│   └── Icons.jsx                 # SVG icon components
├── pages/
│   ├── QueryPage.jsx             # Main RAG workspace
│   ├── DocumentsPage.jsx         # Document management
│   └── SettingsPage.jsx          # User LLM settings
├── utils/
│   ├── api.js                    # API client with auth
│   ├── constants.js              # PROVIDER_MODELS, API_BASE
│   └── useDepartments.js         # Department hook
└── App.jsx                       # Routing + Auth state + Global config
```

## Key Design Patterns

| Pattern | Location | Purpose |
|---------|----------|---------|
| **Repository Pattern** | `vector_store.py` | Abstracts ChromaDB operations |
| **Strategy Pattern** | `llm_helper.py` | Multi-provider LLM switching |
| **State Machine** | `rag_graph.py` | LangGraph workflow nodes |
| **Context Provider** | `App.jsx` | Global auth + config state |
| **Permission Classes** | `permissions.py` | DRF role-based access |
| **Cached Property** | `models.py` | Encrypted API key accessors |
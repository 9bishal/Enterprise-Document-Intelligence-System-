# Document Intelligent System

A full-stack document intelligence platform that leverages **RAG (Retrieval-Augmented Generation)** to provide smart, context-aware document analysis and querying. Built with Django REST Framework backend, React/Vite frontend, and advanced NLP capabilities.

## 🎯 Overview

The Document Intelligent System is designed to help organizations:
- Upload and index documents with semantic understanding
- Query documents using natural language
- Get AI-powered answers with source attribution
- Manage chat sessions and conversation history
- Control access through role-based permissions
- Filter results by department

## 📁 Project Structure

```
document_intelligent_system/
├── backend/                    # Django REST API + RAG Pipeline
│   ├── app/                   # Core RAG logic & helpers
│   │   ├── rag_graph.py       # RAG execution pipeline with step tracking
│   │   ├── llm_helper.py      # LLM API interactions (with SSL handling)
│   │   ├── vector_store.py    # Vector database (Chroma) operations
│   │   ├── database.py        # Database connection & setup
│   │   └── main.py            # Main application entry
│   ├── django_backend/        # Django configuration & models
│   │   ├── models.py          # Database models (Document, User, ChatSession, etc.)
│   │   ├── views/             # API endpoints
│   │   │   ├── auth.py        # Authentication endpoints
│   │   │   ├── doc_api.py     # Document CRUD operations
│   │   │   ├── doc_indexing.py # Document indexing & classification
│   │   │   ├── rag.py         # RAG query endpoints
│   │   │   ├── admin.py       # Admin operations
│   │   │   └── admin_*.py     # Specialized admin endpoints
│   │   ├── serializers.py     # DRF serializers
│   │   ├── permissions.py     # Custom permission classes
│   │   ├── middleware.py      # Custom middleware
│   │   ├── settings.py        # Django settings
│   │   ├── urls.py            # URL routing
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
│   │   │   ├── SettingsPage.jsx   # Settings & configuration
│   │   │   └── ...
│   │   ├── components/       # Reusable components
│   │   │   ├── ChatWindow.jsx     # Chat UI
│   │   │   ├── Visualizer.jsx     # RAG pipeline visualization
│   │   │   ├── admin/             # Admin components
│   │   │   └── ...
│   │   ├── utils/            # Utility functions
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
- **📊 RAG Pipeline Visualization**: See each step of the retrieval and generation process
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
- **LLM Integration** with configurable API keys
- **Department-based Classification** for documents
- **SSL/TLS Support** for secure LLM API calls
- **Pagination & Filtering** for document queries

### Admin Features
- Document deletion with vector store cleanup
- User management and access control
- LLM configuration management
- System metrics and analytics

## 🛠️ Tech Stack

### Backend
- **Framework**: Django 4.x + Django REST Framework
- **Database**: SQLite (with migration support)
- **Vector DB**: Chroma (for semantic search)
- **LLM**: OpenAI/Anthropic (configurable)
- **Authentication**: JWT tokens
- **Language**: Python 3.10+

### Frontend
- **Framework**: React 18.x
- **Build Tool**: Vite
- **Styling**: CSS-in-JS (styled with JSX)
- **State Management**: React Hooks
- **HTTP Client**: Fetch API
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

### Chat Sessions (CRUD)
- `GET /api/chat/sessions` - List all chat sessions
- `POST /api/chat/sessions` - Create new chat session
- `PUT /api/chat/sessions/{id}` - Update/rename session
- `DELETE /api/chat/sessions/{id}` - Delete session
- `GET /api/chat/sessions/{id}/messages` - Get session messages

### Chat Query
- `POST /api/chat/query` - Send question and get RAG response

### Documents
- `GET /api/documents` - List documents
- `POST /api/documents/upload` - Upload document
- `DELETE /api/documents/{id}` - Delete document (admin only)
- `GET /api/documents/search` - Search documents

### Admin
- `GET /api/admin/metrics` - System metrics
- `DELETE /api/admin/documents/{id}` - Admin document deletion

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

1. **Document Retrieval** - Semantic search finds relevant documents
2. **Context Processing** - Retrieved content is formatted
3. **Prompt Engineering** - Context is added to user query
4. **LLM Generation** - AI generates response
5. **Source Attribution** - Sources are cited in response

Each step is tracked and displayed in real-time.

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Role-Based Access Control (RBAC)**: Admin/Editor/Viewer roles
- **CORS Protection**: Cross-Origin Resource Sharing configured
- **SSL/TLS Support**: Secure LLM API connections
- **Input Validation**: All inputs validated server-side
- **SQL Injection Protection**: ORM-based queries prevent SQL injection
- **Permission Classes**: Custom DRF permission classes

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
- OpenAI/Anthropic for LLM capabilities

---

**Last Updated**: May 2026  
**Version**: 1.0.0

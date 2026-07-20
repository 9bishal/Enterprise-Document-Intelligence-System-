# Quick Start Guide

Get the Document Intelligent System up and running in minutes!

## ⚡ 5-Minute Setup

### 1. Clone & Navigate

```bash
git clone https://github.com/yourusername/document_intelligent_system.git
cd document_intelligent_system
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Run migrations
python manage.py migrate

# Start backend
python run.py
```

Backend available at: `http://localhost:8000`

### 3. Frontend Setup (new terminal)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend available at: `http://localhost:5173`

### 4. Login

1. Open `http://localhost:5173` in your browser
2. Create account or use demo credentials
3. Start chatting!

---

## 🔑 Essential Environment Variables

Create `.env` in the `backend/` directory:

```env
# Django
DEBUG=False
SECRET_KEY=change-me-to-something-secret
DATABASE_URL=sqlite:///data/app.db

# LLM
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4

# Vector DB
CHROMA_HOST=localhost
CHROMA_PORT=8000

# JWT
JWT_SECRET=your-jwt-secret-key
```

---

## 📝 First Steps After Setup

### 1. Create Admin Account

```bash
cd backend
python manage.py createsuperuser
```

### 2. Upload a Document

1. Click "Upload" in DocumentsPage
2. Select a PDF or document
3. Choose a department
4. Click "Upload"

### 3. Start a Chat

1. Click "➕ New Chat" button
2. Enter a question about your documents
3. See the RAG pipeline execute in real-time
4. Read the response with sources cited

### 4. Manage Chat Sessions

Each chat in the sidebar has a **3-dot menu** (⋮) with:
- **✏️ Rename** - Rename the chat session
- **🗑️ Delete** - Delete the chat session

---

## 🐛 Troubleshooting

### Backend Won't Start

```bash
# Check Python version
python3 --version  # Should be 3.10+

# Reinstall dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Check port 8000 is available
lsof -i :8000  # Kill if needed: kill -9 PID
```

### Frontend Won't Load

```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Check port 5173
lsof -i :5173

# Check environment variables
echo $VITE_API_BASE  # Should point to backend
```

### Database Locked

```bash
# Reset database
cd backend
rm data/app.db
python manage.py migrate
```

### LLM API Errors

```bash
# Verify API key
echo $OPENAI_API_KEY

# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

## 🎯 Common Tasks

### Run Tests

```bash
# Backend
cd backend
python manage.py test

# Frontend
cd frontend
npm test
```

### View Database

```bash
cd backend
python manage.py dbshell
sqlite> .tables
sqlite> SELECT * FROM django_backend_user;
```

### Check API Endpoints

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/chat/sessions
```

### Build for Production

```bash
# Backend (no build needed - Django is ready)

# Frontend
cd frontend
npm run build
# Output in dist/ directory
```

---

## 📚 Next Steps

1. **Read the Documentation**
   - See [README.md](./README.md) for full documentation
   - See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for architecture
   - See [backend/README.md](./backend/README.md) for backend details

2. **Explore the Code**
   - Start with `frontend/src/pages/QueryPage.jsx` (main chat interface)
   - Check `backend/app/rag_graph.py` (RAG pipeline)
   - Review `backend/django_backend/views/rag.py` (API endpoints)

3. **Contribute**
   - See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines
   - Pick an issue to work on
   - Submit a pull request

4. **Deploy**
   - Use Docker for containerization
   - Deploy backend to AWS/Heroku/DigitalOcean
   - Deploy frontend to Vercel/Netlify

---

## 💡 Pro Tips

### Development Tips
- Use `django-debug-toolbar` for query optimization
- Use React DevTools browser extension
- Enable verbose logging: `DEBUG=True` in .env

### Testing Tips
- Test with different document types
- Try complex queries to see RAG in action
- Check the pipeline visualization

### Performance Tips
- Use smaller models for testing (GPT-3.5)
- Implement caching for frequently asked questions
- Index important documents first

---

## 🆘 Getting Help

- **Issues**: Open a GitHub issue
- **Discussions**: Check GitHub Discussions
- **Docs**: Read the comprehensive documentation
- **Code**: Check existing implementation

---

## 🎉 You're Ready!

The system is now running. Start uploading documents and asking questions!

Questions? Check the troubleshooting section or open an issue.

Happy documenting! 📄✨

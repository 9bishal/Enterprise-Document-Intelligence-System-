# Contributing to Document Intelligent System

Thank you for your interest in contributing! This guide will help you get started.

## 🤝 Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and adhere to our Code of Conduct.

## 📋 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 16+
- Git
- Basic knowledge of Django and React

### Fork & Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/document_intelligent_system.git
   cd document_intelligent_system
   ```

3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/document_intelligent_system.git
   ```

### Setup Development Environment

#### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python run.py
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 🎯 How to Contribute

### Reporting Bugs

1. Check if the bug already exists in Issues
2. If not, create a new issue with:
   - Clear title describing the bug
   - Detailed description and steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - Environment details (OS, Python/Node version, etc.)

### Suggesting Features

1. Use the Issue tracker with "enhancement" label
2. Describe the feature and why it would be useful
3. Provide examples or mockups if applicable

### Submitting Pull Requests

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make your changes**:
   - Keep commits atomic and well-described
   - Follow the coding standards (see below)
   - Add tests for new features

3. **Test locally**:
   ```bash
   # Backend
   cd backend
   python manage.py test

   # Frontend
   cd frontend
   npm test
   ```

4. **Push to your fork**:
   ```bash
   git push origin feature/amazing-feature
   ```

5. **Create a Pull Request**:
   - Clear title and description
   - Reference related issues
   - Include screenshots for UI changes
   - Ensure CI/CD passes

## 📐 Coding Standards

### Python (Backend)

```python
# PEP 8 compliant
# Use meaningful variable names
user_email = "user@example.com"  # Good
ue = "user@example.com"  # Bad

# Type hints
def fetch_documents(user_id: str, limit: int = 10) -> List[Document]:
    pass

# Docstrings
def authenticate_user(email: str, password: str) -> dict:
    """
    Authenticate user with email and password.
    
    Args:
        email: User email address
        password: User password (will be hashed)
    
    Returns:
        Dictionary with access_token and user info
    
    Raises:
        ValueError: If credentials are invalid
    """
    pass

# Comments for complex logic
# Retrieve documents and calculate relevance scores
documents = vector_store.search(query, k=10)
ranked = sorted(documents, key=lambda x: x.relevance, reverse=True)
```

### JavaScript/React (Frontend)

```javascript
// Use meaningful names
const [chatMessages, setChatMessages] = useState([]);  // Good
const [msgs, setMsgs] = useState([]);  // Bad

// Use arrow functions
const handleSubmit = (event) => {
  event.preventDefault();
  // Handle submission
};

// JSDoc comments
/**
 * Sends a chat message and returns the AI response
 * @param {string} text - The message text
 * @param {string} sessionId - The chat session ID
 * @returns {Promise<Object>} Response object with content and steps
 */
const sendMessage = async (text, sessionId) => {
  // Implementation
};

// Destructuring
const { userId, userName, department } = user;
```

### Naming Conventions

**Backend (Python - snake_case)**
- Variables: `user_id`, `chat_message`
- Functions: `fetch_documents()`, `create_session()`
- Classes: `ChatSession`, `DocumentIndexer`
- Constants: `MAX_RETRIES`, `DEFAULT_TIMEOUT`

**Frontend (JavaScript - camelCase)**
- Variables: `userId`, `chatMessage`
- Functions: `fetchDocuments()`, `createSession()`
- Components: `ChatWindow`, `DocumentList`
- Constants: `MAX_RETRIES`, `DEFAULT_TIMEOUT`

## ✅ Testing

### Backend Tests

```python
from django.test import TestCase
from django_backend.models import User, ChatSession

class ChatSessionTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='test@example.com',
            password='testpass123'
        )
    
    def test_create_session(self):
        session = ChatSession.objects.create(
            user=self.user,
            name='Test Session'
        )
        self.assertEqual(session.user, self.user)
        self.assertEqual(session.name, 'Test Session')
```

### Frontend Tests

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import ChatWindow from '../ChatWindow';

test('renders chat window', () => {
  render(<ChatWindow sessions={[]} />);
  expect(screen.getByText(/chat/i)).toBeInTheDocument();
});

test('sends message on button click', () => {
  const handleSend = jest.fn();
  render(<ChatWindow onSendMessage={handleSend} />);
  
  const input = screen.getByPlaceholderText(/type message/i);
  fireEvent.change(input, { target: { value: 'Hello' } });
  fireEvent.click(screen.getByText(/send/i));
  
  expect(handleSend).toHaveBeenCalledWith('Hello');
});
```

## 📝 Commit Messages

Follow conventional commits format:

```
type(scope): subject

body

footer
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.

**Examples:**
```
feat(chat): add message deletion functionality

Allows users to delete their own messages from chat history.
Add soft delete to preserve audit trail.

Closes #123
```

```
fix(rag): improve context retrieval accuracy

Increase max tokens for context window and improve similarity threshold.

Related to #456
```

## 🔄 Pull Request Process

1. Ensure you have the latest changes from main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. Push to your fork:
   ```bash
   git push -f origin feature/amazing-feature
   ```

3. Create PR on GitHub with:
   - Clear title
   - Description of changes
   - Link to related issues
   - Checklist completion

4. Address review comments promptly

5. Once approved, maintainers will merge

## 🐛 Debugging Tips

### Backend Debugging

```python
# Print debugging
from django.core import serializers
print(serializers.serialize('json', [obj]))

# Django shell
python manage.py shell
>>> from django_backend.models import User
>>> User.objects.all()

# Logging
import logging
logger = logging.getLogger(__name__)
logger.debug("Debug message")
```

### Frontend Debugging

```javascript
// Console logging
console.log('Variable:', variable);
console.table(arrayOfObjects);
console.error('Error:', error);

// Browser DevTools
// F12 or Right-click > Inspect
// Use breakpoints and watch expressions

// React DevTools
// Install React DevTools browser extension
```

## 📚 Documentation

When adding features:

1. Update relevant README files
2. Add code comments for complex logic
3. Update API documentation
4. Add examples in docstrings
5. Create or update issue documentation

## 🚀 Performance Considerations

### Backend

- Use database query optimization (select_related, prefetch_related)
- Implement caching for frequently accessed data
- Use pagination for large result sets
- Profile slow endpoints with Django Debug Toolbar

### Frontend

- Lazy load components
- Memoize expensive calculations
- Use React.memo for pure components
- Minimize bundle size

## ♿ Accessibility

- Use semantic HTML
- Include alt text for images
- Ensure keyboard navigation
- Maintain proper color contrast
- Test with screen readers

## 🎨 Design System

### Colors
- Primary: #30A46C (Green)
- Secondary: #141413 (Dark)
- Neutral: #8E8B82 (Gray)
- Error: #C83232 (Red)

### Typography
- Headings: Bold, 18px-32px
- Body: Regular, 12px-16px
- Code: Monospace, 12px

## 📞 Getting Help

- Check existing issues and discussions
- Read the documentation thoroughly
- Ask questions in GitHub Discussions
- Contact maintainers if needed

## ⭐ Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md
- GitHub contributors page
- Release notes for significant contributions

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to make this project better! 🎉

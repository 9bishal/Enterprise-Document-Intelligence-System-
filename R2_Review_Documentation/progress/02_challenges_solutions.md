# Technical Challenges & Solutions

## Challenge 1: Multi-Provider LLM Abstraction

### Problem
Different LLM providers (Groq, Gemini, OpenAI, Ollama) have:
- Different API signatures
- Different model naming conventions
- Different authentication methods
- Different response formats
- Different rate limits & error codes

### Solution: Strategy Pattern in `llm_helper.py`
```python
def call_llm(prompt, provider, api_key, model_name, temperature):
    provider = provider.lower()
    
    if provider == "groq":
        return _call_groq(prompt, api_key, model_name, temperature)
    elif provider == "gemini":
        return _call_gemini(prompt, api_key, model_name, temperature)
    # ... etc
```

**Fallback Chain**: Configured → Groq → Gemini → OpenAI → Env vars
**Caching**: Prompt-level cache with TTL
**Metrics**: Token counting, cost estimation, latency tracking per provider

---

## Challenge 2: Department-Scoped Vector Search

### Problem
Users must only access documents from their department. Admins need flexible scoping (all, specific, or user's dept). Must work at vector store level for performance.

### Solution: Query-Time Filtering in ChromaDB
```python
# Build where clause based on user role
if admin_all:
    where_clause = {"status": "indexed"}
elif target_dept:
    where_clause = {"status": "indexed", "department": target_dept}
else:
    where_clause = {"status": "indexed", "department": user_department}

results = chroma.query(query_embedding, n_results, where=where_clause)
```

**Verification**: Unit tests for each role/dept combination. Integration tests with multi-dept corpus.

---

## Challenge 3: macOS PyTorch MPS Crashes

### Problem
`sentence-transformers` uses PyTorch. On macOS, MPS (Metal) backend crashes with:
```
MPSLibrary::MPSKey_Create internal error: Unable to reach MTLCompilerService
```

### Solution: Environment Variable Fallback
```bash
PYTORCH_ENABLE_MPS_FALLBACK=1 gunicorn ...
```
This allows PyTorch to fall back to CPU when MPS fails, preventing worker crashes.

**Alternative**: `PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.0` to disable MPS entirely.

---

## Challenge 4: Groq Free Tier Rate Limits

### Problem
Free tier has strict limits:
- `llama-3.3-70b`: 100K tokens/day, 30 req/min
- `gpt-oss-20b`: 200K tokens/day, 8K tokens/min
- `allam-2-7b`: 500K tokens/day, 6K tokens/min
- Compound models route to other models unpredictably

### Solution: Model Selection Strategy
1. **Default**: `allam-2-7b` - highest daily quota (500K tokens), dedicated model
2. **Fallback**: `allam-2-7b` (not compound models that route to limited ones)
3. **Frontend**: Show token limits in model names for user awareness
4. **Long-term**: Add Gemini/OpenAI keys for production

---

## Challenge 5: Global Config vs User Preferences

### Problem
Admin sets global LLM config. Users have local preferences. When `enforce_globally=True`, user settings must be ignored. When `False`, user settings override defaults but API keys always come from admin.

### Solution: Configuration Resolution in Backend
```python
# In rag.py query_rag()
if llm_config.enforce_globally:
    # Ignore frontend config entirely
    model_config = {
        "provider": llm_config.provider,
        "model": llm_config.model,
        "temperature": llm_config.temperature,
        "k": llm_config.k
    }
else:
    # Merge: DB defaults + user overrides
    model_config = {
        "provider": config_payload.get("provider", llm_config.provider),
        "model": config_payload.get("model", llm_config.model),
        # ...
    }

# ALWAYS use DB API keys (decrypted)
api_keys = {
    "groq": llm_config.get_groq_key(),
    "gemini": llm_config.get_gemini_key(),
    "openai": llm_config.get_openai_key(),
}
```

**Frontend**: Settings UI disabled when `isGlobalConfigEnforced=True` with shield badge.

---

## Challenge 6: Real-Time Pipeline Visualization

### Problem
Frontend needs to show RAG pipeline steps (retrieve → grade → generate → grade → critique) as they execute, with timing and source mapping.

### Solution: Step Accumulation in LangGraph + Frontend State
```python
# Backend: Each node returns steps
return {"steps": ["retrieve"], "documents": chunks}

# Frontend: Poll or SSE for progress (currently full response)
# Visualizer component renders steps with timing
```

**Current**: Full response with all steps, frontend animates them sequentially.
**Future**: Server-Sent Events for true streaming.

---

## Challenge 7: Encrypted API Key Storage

### Problem
Admin-entered API keys must be encrypted at rest in database, decrypted only at runtime for LLM calls.

### Solution: Fernet Encryption in Model
```python
# models.py
class LLMConfig(models.Model):
    _fernet = None
    
    groq_api_key_encrypted = models.TextField(blank=True)
    
    def set_groq_key(self, plain_key):
        self.groq_api_key_encrypted = self._get_fernet().encrypt(plain_key.encode()).decode()
    
    def get_groq_key(self):
        if not self.groq_api_key_encrypted:
            return ""
        return self._get_fernet().decrypt(
            self.groq_api_key_encrypted.encode()
        ).decode()
    
    @classmethod
    def _get_fernet(cls):
        if cls._fernet is None:
            key = base64.urlsafe_b64encode(
                hashlib.sha256(settings.SECRET_KEY.encode()).digest()
            )
            cls._fernet = Fernet(key)
        return cls._fernet
```

**Key Derivation**: Django SECRET_KEY → SHA256 → base64 → Fernet key

---

## Challenge 8: First-User Bootstrap Admin

### Problem
First user to sign up should automatically become Admin. Subsequent users need invitation with OTP.

### Solution: Count-Based Logic in Auth View
```python
# auth.py signup
if User.objects.count() == 0:
    # First user → Auto Admin
    user = User.objects.create_user(...)
    UserProfile.objects.create(user=user, role='Admin', department='General')
else:
    # Require valid invitation with OTP
    invitation = UserInvitation.objects.filter(email=email, otp=otp).first()
    # ... role from invitation
```

**Security**: Invitation OTP expires, single-use, admin-created.

---

## Challenge 9: Hybrid Search (Vector + Keyword)

### Problem
Pure vector search misses exact keyword matches. Pure keyword search misses semantic matches. Need both.

### Solution: Reciprocal Rank Fusion (RRF)
```python
def reciprocal_rank_fusion(vector_results, keyword_results, k=60):
    scores = defaultdict(float)
    for results in [vector_results, keyword_results]:
        for rank, doc_id in enumerate(results):
            scores[doc_id] += 1 / (k + rank + 1)
    return sorted(scores.keys(), key=scores.get, reverse=True)
```

**Why RRF**: No score normalization needed, theoretically sound, works across heterogeneous retrievers.

---

## Challenge 10: Streaming vs Batch Response

### Problem
RAG pipeline takes 3-5 seconds. Users want progressive feedback. But LangGraph is synchronous.

### Solution: Progressive Frontend Animation (Current)
- Backend returns full response with all steps
- Frontend animates steps with staggered delays (250ms each)
- Visualizer shows active step highlighting

**Planned**: True SSE Streaming
- LangGraph `astream()` for async iteration
- Django `StreamingHttpResponse`
- Frontend `EventSource` consumption

---

## Summary Table

| # | Challenge | Solution Pattern | Files Modified |
|---|-----------|------------------|----------------|
| 1 | Multi-provider LLM | Strategy + Fallback | `llm_helper.py` |
| 2 | Dept-scoped search | Query-time filtering | `rag.py`, `vector_store.py` |
| 3 | MPS crashes | Env var fallback | Deployment config |
| 4 | Groq rate limits | Model selection + fallback | `llm_helper.py`, `constants.js` |
| 5 | Global vs user config | Merge logic + UI toggle | `rag.py`, `SettingsPage.jsx` |
| 6 | Pipeline visualization | Step accumulation + animation | `rag_graph.py`, `Visualizer.jsx` |
| 7 | Encrypted keys | Fernet in model | `models.py` |
| 8 | First-user admin | Count-based bootstrap | `auth.py` |
| 9 | Hybrid search | RRF | `vector_store.py` |
| 10 | Streaming UX | Staggered animation | `QueryPage.jsx`, `Visualizer.jsx` |
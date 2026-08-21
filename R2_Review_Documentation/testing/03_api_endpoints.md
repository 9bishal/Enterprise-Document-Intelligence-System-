# API Endpoints Reference for Testing (Hoppscotch / Manual)

**Base URL**: `http://localhost:8001/api` (use `http://localhost:8000/api` if the backend was started on 8000)  
**Auth**: JWT Bearer Token (except login/signup/health)  
**Content-Type**: `application/json` (multipart for upload)  
**Manual test client**: [Hoppscotch](https://hoppscotch.io) (open-source REST platform)

---

## Authentication Endpoints (No Auth Required)

### 1. User Login
```
POST /auth/login
```
**Request Body:**
```json
{
  "username": "admin_intradoc",
  "password": "admin@123"
}
```
**Response (200):**
```json
{
  "username": "admin_intradoc",
  "role": "Admin",
  "department": "General",
  "access": "eyJhbGciOiJIUzI1NiIs...",
  "refresh": "eyJhbGciOiJIUzI1NiIs...",
  "detail": "Login successful."
}
```
**Postman Test:** Save `access` token to variable `{{token}}`

---

### 2. User Signup (First User → Auto Admin)
```
POST /auth/signup
```
**Request Body:**
```json
{
  "username": "newadmin",
  "password": "password123",
  "email": "admin@company.com"
}
```
**Response (201):** Same as login with `"detail": "First user registered as Admin successfully."`

---

### 3. User Signup (Invited User - Requires OTP)
```
POST /auth/signup
```
**Request Body:**
```json
{
  "username": "hr_editor",
  "password": "password123",
  "email": "hr@company.com",
  "otp": "123456"
}
```
**Response (201):** Role/department from invitation

---

### 4. Get Current User Profile
```
GET /auth/me
```
**Headers:** `Authorization: Bearer {{token}}`
**Response (200):**
```json
{
  "username": "admin_intradoc",
  "role": "Admin",
  "department": "General",
  "authenticated": true
}
```

---

### 5. Refresh Access Token
```
POST /auth/token/refresh
```
**Request Body:**
```json
{
  "refresh": "{{refresh_token}}"
}
```
**Response (200):** New `access` token

---

### 6. Logout (Blacklist Refresh Token)
```
POST /auth/logout
```
**Headers:** `Authorization: Bearer {{token}}`
**Request Body:**
```json
{
  "refresh": "{{refresh_token}}"
}
```
**Response (200):** `{"detail": "Logout successful."}`

---

### 7. Forgot Password (Request OTP)
```
POST /auth/forgot-password
```
**Request Body:**
```json
{
  "email": "user@company.com"
}
```
**Response (200):** OTP printed to backend console

---

### 8. Reset Password (With OTP)
```
POST /auth/reset-password
```
**Request Body:**
```json
{
  "email": "user@company.com",
  "otp": "123456",
  "new_password": "newpassword123"
}
```
**Response (200):** `{"message": "Password reset successfully."}`

---

## Chat / RAG Endpoints (Auth Required)

### 9. Create Chat Session
```
POST /chat/sessions
```
**Headers:** `Authorization: Bearer {{token}}`
**Request Body:**
```json
{
  "name": "Technical Discussion"
}
```
**Response (201):**
```json
{
  "id": "uuid-session-id",
  "name": "Technical Discussion",
  "created_at": "2026-08-21T10:30:00Z"
}
```

---

### 10. List Chat Sessions
```
GET /chat/sessions
```
**Headers:** `Authorization: Bearer {{token}}`
**Response (200):**
```json
[
  {"id": "uuid", "name": "Session 1", "created_at": "..."},
  {"id": "uuid", "name": "Session 2", "created_at": "..."}
]
```

---

### 11. Get Session Messages
```
GET /chat/sessions/{session_id}/messages
```
**Headers:** `Authorization: Bearer {{token}}`
**Response (200):**
```json
[
  {
    "id": "msg-uuid",
    "role": "user",
    "content": "What is Bishal's education?",
    "created_at": "2026-08-21T10:31:00Z"
  },
  {
    "id": "msg-uuid",
    "role": "assistant",
    "content": "Bishal Shah is pursuing...",
    "created_at": "2026-08-21T10:31:05Z",
    "sources": [...],
    "steps": ["retrieve", "grade_documents", "generate", ...],
    "model_used": "openai/gpt-oss-20b",
    "input_tokens": 1200,
    "output_tokens": 450,
    "estimated_cost_usd": 0.0001,
    "latency_ms": 3200,
    "cache_hit": false,
    "evaluation": {...}
  }
]
```

---

### 12. Execute RAG Query (Core Endpoint)
```
POST /chat/query
```
**Headers:** `Authorization: Bearer {{token}}`
**Request Body:**
```json
{
  "session_id": "uuid-session-id",
  "question": "What is Bishal Shah's education?",
  "api_keys": {},
  "config": {},
  "department": "All Departments"
}
```
**Notes:**
- `api_keys` and `config` optional (use admin global config if enforced)
- `department`: Admin can use "All Departments" or specific; users locked to their dept

**Response (200):**
```json
{
  "id": "msg-uuid",
  "role": "assistant",
  "content": "Bishal Shah is pursuing...",
  "sources": [
    {
      "id": "doc-uuid_chunk_0",
      "text": "EDUCATIONAL QUALIFICATION...",
      "filename": "1CR23AI020_BISHAL KUMAR SHAH_RESUME.pdf",
      "doc_id": "doc-uuid",
      "page": 1,
      "chunk_index": 0,
      "similarity": 95.5
    }
  ],
  "steps": ["retrieve", "grade_documents", "generate", "grade_generation", "critique"],
  "success": true,
  "cache_hit": false,
  "model_used": "openai/gpt-oss-20b",
  "estimated_cost_usd": 0.0001,
  "latency_ms": 3200,
  "input_tokens": 1200,
  "output_tokens": 450,
  "evaluation": {
    "faithfulness": 0.92,
    "context_utilization": 0.85,
    "answer_length_chars": 520,
    "estimated_tokens": 130
  }
}
```

---

### 13. Update Session Name
```
PUT /chat/sessions/{session_id}
```
**Headers:** `Authorization: Bearer {{token}}`
**Request Body:**
```json
{
  "name": "Updated Session Name"
}
```

---

### 14. Delete Chat Session
```
DELETE /chat/sessions/{session_id}
```
**Headers:** `Authorization: Bearer {{token}}`
**Response (200):** `{"status": "success", "message": "Session deleted successfully."}`

---

## Document Management Endpoints (Auth + Role Required)

### 15. Upload Document (Editor+ Only)
```
POST /documents/upload
```
**Headers:** `Authorization: Bearer {{token}}`
**Content-Type:** `multipart/form-data`
**Form Data:**
| Key | Type | Value |
|-----|------|-------|
| file | File | (select PDF/DOCX/TXT/MD) |
| department | Text | "HR" |
| classification | Text | "Confidential" |

**Response (201):**
```json
{
  "id": "doc-uuid",
  "filename": "policy.pdf",
  "status": "processing",
  "department": "HR",
  "classification": "Confidential",
  "file_size": 248400,
  "created_at": "2026-08-21T10:35:00Z"
}
```
**Note:** Status changes to `indexed` after processing (check via GET /documents)

---

### 16. List Documents
```
GET /documents
```
**Headers:** `Authorization: Bearer {{token}}`
**Query Params (Optional):**
- `department=HR` (Admin only; users see only their dept)
- `status=indexed`
- `page=1&page_size=20`

**Response (200):**
```json
[
  {
    "id": "doc-uuid",
    "filename": "policy.pdf",
    "status": "indexed",
    "department": "HR",
    "classification": "Confidential",
    "file_size": 248400,
    "created_at": "2026-08-21T10:35:00Z"
  }
]
```

---

### 17. Delete Document (Editor+ Only)
```
DELETE /documents/{document_id}
```
**Headers:** `Authorization: Bearer {{token}}`
**Response (200):** `{"status": "success", "message": "Document deleted successfully."}`

---

## Admin Endpoints (Admin Only)

### 18. List All Users
```
GET /admin/users
```
**Headers:** `Authorization: Bearer {{token}}` (Admin)
**Query Params:** `role=Editor&department=HR&page=1&page_size=20`
**Response (200):**
```json
[
  {
    "id": 1,
    "username": "admin_intradoc",
    "email": "admin@company.com",
    "role": "Admin",
    "department": "General",
    "is_active": true,
    "date_joined": "2026-08-21T10:00:00Z"
  }
]
```

---

### 19. Update User (Role/Department/Active)
```
PUT /admin/users/{user_id}
```
**Headers:** `Authorization: Bearer {{token}}` (Admin)
**Request Body:**
```json
{
  "role": "Editor",
  "department": "Legal",
  "is_active": true
}
```

---

### 20. Get System Metrics
```
GET /admin/metrics
```
**Headers:** `Authorization: Bearer {{token}}` (Admin)
**Response (200):**
```json
{
  "total_users": 5,
  "total_documents": 12,
  "total_queries": 150,
  "total_tokens": 450000,
  "total_cost_usd": 0.045,
  "queries_today": 12,
  "tokens_today": 35000
}
```

---

### 21. Get Knowledge Graph Data
```
GET /admin/knowledge-graph
```
**Headers:** `Authorization: Bearer {{token}}` (Admin)
**Response (200):**
```json
{
  "departments": ["HR", "Legal", "Finance", "Technical", "General"],
  "documents": [
    {"id": "doc-uuid", "name": "policy.pdf", "department": "HR", "chunks": 8}
  ],
  "connections": [
    {"source": "HR", "target": "Legal", "weight": 3}
  ]
}
```

---

### 22. Get Global LLM Configuration
```
GET /admin/llm-config
```
**Headers:** `Authorization: Bearer {{token}}` (Admin)
**Response (200):**
```json
{
  "enforce_globally": true,
  "config": {
    "provider": "groq",
    "model": "openai/gpt-oss-20b",
    "temperature": 0.3,
    "k": 4
  },
  "api_keys": {
    "groq": "gsk_***",
    "gemini": "",
    "openai": ""
  }
}
```

---

### 23. Update Global LLM Configuration
```
PUT /admin/llm-config/update
```
**Headers:** `Authorization: Bearer {{token}}` (Admin)
**Request Body:**
```json
{
  "enforce_globally": true,
  "config": {
    "provider": "groq",
    "model": "allam-2-7b",
    "temperature": 0.3,
    "k": 4
  },
  "api_keys": {
    "groq": "gsk_NewValidKey...",
    "gemini": "",
    "openai": ""
  }
}
```
**Notes:**
- API keys encrypted server-side (Fernet)
- `enforce_globally=true` locks user settings
- `enforce_globally=false` allows user overrides (except API keys)

---

## Hoppscotch Manual Testing Guide

This section is the **manual API validation playbook** used for evaluation. It covers a **comprehensive testing approach**, a **thorough validation strategy**, and a **result-verification checklist** so every response is checked — not just “it returned 200”.

Hoppscotch is used because it is open-source, has collections + environments + test scripts, and produces screenshot/export evidence suitable for a viva or review demo.

---

### 0. Evaluation mapping (why this guide exists)

| Evaluation criterion | How this guide satisfies it |
|----------------------|-----------------------------|
| **Comprehensive testing approach** | Happy path + negative tests + RBAC + department isolation + health/readiness + RAG field checks, across Auth, Chat, Documents, Admin |
| **Thorough validation strategy** | Every request has expected status, required JSON fields, and a pass/fail rule. Tokens and IDs are chained via environment variables so later tests cannot “accidentally” pass |
| **All results properly verified** | Per-request checklist + collection-level results table + evidence capture (status, body, latency, test-script pass/fail) |

---

### 1. Prerequisites

1. Backend is running (`python run.py` → `http://localhost:8001`, or gunicorn on `8000`).
2. Confirm the live port before testing:

```bash
curl -s http://localhost:8001/api/health/live
# Expected: {"status":"ok"}
```

If that fails, retry on `8000` and set `base_url` accordingly.

3. Demo admin (if already bootstrapped): `admin_intradoc` / `admin@123`.

---

### 2. Install / open Hoppscotch (localhost access)

The cloud site `https://hoppscotch.io` **cannot reach `localhost`** from the browser by itself. Use one of these:

| Option | When to use |
|--------|-------------|
| **Hoppscotch Desktop** (recommended) | Local review/demo. Download from [hoppscotch.io](https://hoppscotch.io) |
| **Web + Hoppscotch Browser Interceptor / Agent** | If staying in the browser |
| **Self-hosted Hoppscotch** | If the team already runs an instance |

Confirm Interceptor/Agent is **connected** (green) before sending any request.

---

### 3. Create the workspace, environment, and collection

1. Open Hoppscotch → **REST**.
2. **Environments** → New environment → name it `Intradoc Local`.
3. Add these variables (empty values are filled by test scripts after login/upload):

| Variable | Initial value | Filled by |
|----------|---------------|-----------|
| `base_url` | `http://localhost:8001/api` | Manual (change port if needed) |
| `token` | *(empty)* | Login / Signup script |
| `refresh_token` | *(empty)* | Login / Signup script |
| `user_role` | *(empty)* | Login script |
| `user_department` | *(empty)* | Login script |
| `session_id` | *(empty)* | Create session script |
| `doc_id` | *(empty)* | Upload script |
| `user_id` | *(empty)* | List users script (admin) |

4. Select **Intradoc Local** as the active environment (top of the request bar).
5. **Collections** → New collection → `Intradoc AI API`.
6. Create folders (this is the comprehensive suite):

```
Intradoc AI API
├── 01 Health
├── 02 Auth (happy path)
├── 03 Auth (negative)
├── 04 Chat / RAG
├── 05 Documents
├── 06 Admin
└── 07 RBAC & isolation
```

Use `<<variable>>` syntax in URLs, headers, and bodies (Hoppscotch environment interpolation).

---

### 4. Global authorization

For every request **except** Health, Login, Signup, Forgot Password, Reset Password, and Token Refresh:

1. Open the request → **Authorization** tab.
2. Type: **Bearer**.
3. Token: `<<token>>`.

Do **not** hard-code JWTs. Login writes `token`; later requests read it.

Optional collection-level header (same effect):

```
Authorization: Bearer <<token>>
Content-Type: application/json
```

---

### 5. Hoppscotch test scripts (result verification)

Hoppscotch uses the `pw` (Postwoman) test API. Paste these into the **Tests** tab of the matching request. Green ticks in the Test Results panel are the **verified** evidence.

**Login / Signup — capture tokens + role**

```javascript
pw.test("Status is 200 or 201", () => {
  pw.expect([200, 201]).toInclude(pw.response.status);
});

pw.test("Returns JWT access + refresh", () => {
  const json = pw.response.body;
  pw.expect(json.access).toBeTruthy();
  pw.expect(json.refresh).toBeTruthy();
  pw.env.set("token", json.access);
  pw.env.set("refresh_token", json.refresh);
  pw.env.set("user_role", json.role);
  pw.env.set("user_department", json.department);
});
```

**Protected JSON endpoints**

```javascript
pw.test("Status is 200 or 201", () => {
  pw.expect([200, 201]).toInclude(pw.response.status);
});

pw.test("Body is JSON object or array", () => {
  pw.expect(pw.response.body).not.toBe(null);
});
```

**Create session — capture `session_id`**

```javascript
pw.test("Session created (201)", () => {
  pw.expect(pw.response.status).toBe(201);
  const json = pw.response.body;
  pw.expect(json.id).toBeTruthy();
  pw.env.set("session_id", json.id);
});
```

**Upload — capture `doc_id`**

```javascript
pw.test("Document accepted (201)", () => {
  pw.expect(pw.response.status).toBe(201);
  const json = pw.response.body;
  pw.expect(json.id).toBeTruthy();
  pw.env.set("doc_id", json.id);
});
```

**RAG query — verify answer quality fields**

```javascript
pw.test("Query succeeded", () => {
  pw.expect(pw.response.status).toBe(200);
  const json = pw.response.body;
  pw.expect(json.success).toBe(true);
  pw.expect(json.content).toBeTruthy();
  pw.expect(json.model_used).toBeTruthy();
  pw.expect(json.steps.length).toBeGreaterThan(0);
});
```

**Negative / unauthorized**

```javascript
pw.test("Rejected as expected", () => {
  pw.expect([400, 401, 403, 404]).toInclude(pw.response.status);
  pw.expect(pw.response.body.detail).toBeTruthy();
});
```

**Viewer must not reach admin**

```javascript
pw.test("Admin route blocked for non-admin", () => {
  pw.expect(pw.response.status).toBe(403);
});
```

A request is **verified** only when: HTTP status matches, required fields exist, and the Tests panel shows all scripts passing.

---

### 6. Execution order (run in this sequence)

Later requests depend on IDs captured earlier. Do not skip steps.

#### Folder 01 — Health (no auth)

| # | Method | URL | Expected | Verify |
|---|--------|-----|----------|--------|
| H1 | `GET` | `<<base_url>>/health/live` | `200` | `{"status":"ok"}` |
| H2 | `GET` | `<<base_url>>/health/ready` | `200` or `503` | Body has `dependencies.redis`, `chromadb`, `database`. `200` only if all true |
| H3 | `GET` | `<<base_url>>/departments` | `200` | Array includes HR, Legal, Finance, Technical, General |

#### Folder 02 — Auth happy path

| # | Method | URL | Body | Expected | Verify |
|---|--------|-----|------|----------|--------|
| A1 | `POST` | `<<base_url>>/auth/login` | `{"username":"admin_intradoc","password":"admin@123"}` | `200` | `access`, `refresh`, `role=Admin`. Token saved to `<<token>>` |
| A2 | `GET` | `<<base_url>>/auth/me` | — | `200` | `authenticated=true`, username matches login |
| A3 | `POST` | `<<base_url>>/auth/token/refresh` | `{"refresh":"<<refresh_token>>"}` | `200` | New `access`. Save it over `token` |
| A4 | `GET` | `<<base_url>>/auth/me` | — | `200` | Still works with the **refreshed** token |

Re-run **A1** after A3 if you want a clean admin token for the rest of the suite.

#### Folder 03 — Auth negative (must fail)

| # | Request | Expected | Verify |
|---|---------|----------|--------|
| N1 | Login with wrong password | `400` | `detail` mentions invalid credentials |
| N2 | Login with empty body `{}` | `400` | Username/password required |
| N3 | `GET /auth/me` with **no** Authorization header | `401` | Unauthenticated |
| N4 | `GET /auth/me` with `Bearer not-a-jwt` | `401` | Invalid token |
| N5 | Signup without invitation OTP (when users already exist) | `400` | Email + OTP required |

Negative tests are part of the **thorough** strategy — a 200 on these is a **fail**.

#### Folder 04 — Chat / RAG

| # | Method | URL | Body / notes | Expected | Verify |
|---|--------|-----|--------------|----------|--------|
| C1 | `POST` | `<<base_url>>/chat/sessions` | `{"name":"Hoppscotch RAG Test"}` | `201` | `id` saved as `session_id` |
| C2 | `GET` | `<<base_url>>/chat/sessions` | — | `200` | Array; includes the session from C1 |
| C3 | `POST` | `<<base_url>>/chat/query` | See body below | `200` | See RAG verification block |
| C4 | `GET` | `<<base_url>>/chat/sessions/<<session_id>>/messages` | — | `200` | At least one `user` + one `assistant` message |
| C5 | `DELETE` | `<<base_url>>/chat/sessions/<<session_id>>` | Run **last** in this folder (after C3–C4) | `200` | `status=success` |

**C3 request body** (`application/json`):

```json
{
  "session_id": "<<session_id>>",
  "question": "What is Bishal Shah's education?",
  "api_keys": {},
  "config": {},
  "department": "All Departments"
}
```

**RAG verification (must all be true):**

- `success === true`
- `content` is non-empty prose (not an error string)
- `sources` is an array (may be empty if corpus has no match — then content should say so)
- If sources exist: each item has `filename`, `text` / chunk, `similarity`
- `steps` includes retrieval/generation nodes (e.g. `retrieve`, `generate`)
- `model_used` is a real model id (e.g. `openai/gpt-oss-20b` or `allam-2-7b`)
- `latency_ms` > 0
- `input_tokens` / `output_tokens` present
- `cache_hit` is boolean
- Optional: `evaluation.faithfulness` present and ≥ 0.7 on a grounded question

Create a **new** session (repeat C1) if you deleted it before finishing C3–C4.

#### Folder 05 — Documents (Editor+)

Use the **admin** token from A1. Body type: **Multipart form**.

| # | Method | URL | Form fields | Expected | Verify |
|---|--------|-----|-------------|----------|--------|
| D1 | `POST` | `<<base_url>>/documents/upload` | `file` = PDF/DOCX/TXT/MD; `department` = `HR`; `classification` = `Confidential` | `201` | `id` → `doc_id`; `status` is `processing` or `indexed` |
| D2 | `GET` | `<<base_url>>/documents` | Query: `department=HR` (optional) | `200` | Array; uploaded file appears |
| D3 | `GET` | `<<base_url>>/documents?status=indexed` | Wait a few seconds after D1 | `200` | Same doc eventually `indexed` |
| D4 | `DELETE` | `<<base_url>>/documents/<<doc_id>>` | Run only after RAG tests that need the file | `200` | `status=success` |

**Multipart in Hoppscotch:** Body → **Multipart** → add key `file` as File, other keys as Text. Do not send JSON for upload.

#### Folder 06 — Admin (Admin token only)

| # | Method | URL | Body | Expected | Verify |
|---|--------|-----|------|----------|--------|
| M1 | `GET` | `<<base_url>>/admin/users` | — | `200` | Array of users; each has `username`, `role`, `department` |
| M2 | `GET` | `<<base_url>>/admin/metrics` | — | `200` | Numeric `total_users`, `total_documents`, `total_queries` (field names as returned) |
| M3 | `GET` | `<<base_url>>/admin/knowledge-graph` | — | `200` | Has department/document structure (not an error) |
| M4 | `GET` | `<<base_url>>/admin/llm-config` | — | `200` | `enforce_globally`, `config.provider`, `config.model`; keys masked |
| M5 | `PUT` | `<<base_url>>/admin/llm-config/update` | See body below | `200` | `message` confirms update. Re-GET M4 to confirm persistence |
| M6 | `POST` | `<<base_url>>/admin/invite` | `{"email":"hr.editor@example.com","role":"Editor","department":"HR"}` | `200` | OTP issued (email or backend console) |

**M5 body** (do not paste real production keys into screenshots):

```json
{
  "enforce_globally": true,
  "config": {
    "provider": "groq",
    "model": "allam-2-7b",
    "temperature": 0.3,
    "k": 4
  },
  "api_keys": {
    "groq": "",
    "gemini": "",
    "openai": ""
  }
}
```

Leave `api_keys` empty (or masked) unless you intend to rotate a key. Re-run M4 after M5 and confirm `config.model` matches.

#### Folder 07 — RBAC & department isolation

These prove authorization is enforced, not just that admin works.

| # | Setup | Request | Expected | Verify |
|---|-------|---------|----------|--------|
| R1 | Clear Authorization header | `GET <<base_url>>/admin/metrics` | `401` | No token → rejected |
| R2 | Login as **Viewer** (invited user). Save viewer `token` | `GET <<base_url>>/admin/llm-config` | `403` | Viewer cannot read admin config |
| R3 | Viewer token | `POST <<base_url>>/documents/upload` | `403` | Viewer cannot upload |
| R4 | Viewer token | `GET <<base_url>>/documents` | `200` | Every item’s `department` equals `<<user_department>>` |
| R5 | Viewer in HR, query a Legal-only fact | `POST <<base_url>>/chat/query` | `200` | Answer does **not** cite Legal docs; typically “no matching information” |
| R6 | Admin token, `department: "All Departments"` | Same question as R5 | `200` | May cite the Legal document |

Switch users by re-running login and overwriting `token` / `user_role` / `user_department`.

---

### 7. Additional live routes (include in collection if demoing ops)

These exist on the running Django app and should be in a complete suite:

| Method | Path | Auth | What to verify |
|--------|------|------|----------------|
| `POST` | `/api/auth/logout` | Bearer + `{"refresh":"<<refresh_token>>"}` | `200`, then refresh token no longer works |
| `POST` | `/api/auth/forgot-password` | None, `{"email":"..."}` | `200`; OTP in backend console |
| `POST` | `/api/auth/reset-password` | None, email + OTP + new password | `200`; old password fails login |
| `POST` | `/api/documents/upload/batch` | Editor+ | Multiple files accepted |
| `GET` | `/api/llm-config` | Authenticated | Public config **without** raw API keys |
| `GET` | `/api/cache/stats` | As deployed | Cache hit/miss counters (or explicit error if Redis down) |
| `DELETE` | `/api/admin/documents/<doc_id>/delete` | Admin | Admin can remove any department’s file |

---

### 8. Validation strategy (what “pass” means)

Do not mark a request passed on status code alone. Apply this three-layer check:

1. **Transport** — status code in the expected set; latency recorded (Hoppscotch shows time under the response).
2. **Contract** — JSON parses; required keys present; types match (string token, array sources, boolean `cache_hit`).
3. **Behaviour** — business rule holds (admin-only routes 403 for Viewer; department filter; RAG `model_used` matches global config when `enforce_globally` is true; upload becomes `indexed`).

Record the outcome in the table in section 10. A row is **verified** only when all three layers pass and a screenshot or exported response is kept.

---

### 9. How to capture evidence in Hoppscotch

For the review / viva:

1. Keep the **Tests** panel visible — green ticks are the automated verification.
2. Screenshot: URL + method, status badge, response JSON, test results.
3. Export the collection: Collection menu → **Export** (Hoppscotch JSON). Store it with the review docs.
4. Optional: copy response into the results log with timestamp and latency.
5. For RAG, screenshot `sources`, `steps`, `model_used`, `estimated_cost_usd`, `cache_hit` together — that is the pipeline proof.

Do not screenshot live API keys. Admin `llm-config` already returns masked keys (`gsk_***`).

---

### 10. Expected results summary (fill during the run)

Mark each cell after executing. Target: **all happy-path pass, all negative-path correctly rejected**.

| Suite | Requests | Happy path | Negative / RBAC | Verified |
|-------|----------|------------|-----------------|----------|
| Health | 3 | H1–H3 | Ready may be `503` if Redis/Chroma down — still verified if body matches | ☐ |
| Auth | 5+ | A1–A4 | N1–N5 | ☐ |
| Chat / RAG | 5 | C1–C5 | Missing `session_id` → `400`; foreign session → `404` | ☐ |
| Documents | 3+ | D1–D3 | Viewer upload → `403`; bad file type → `400` | ☐ |
| Admin | 6 | M1–M6 | Viewer → `403`; no token → `401` | ☐ |
| Isolation | 6 | R4, R6 | R1–R3, R5 | ☐ |

**Collection totals (typical full run):** 23+ happy-path requests + 10+ negative/RBAC requests. Every row needs status + contract + behaviour checked.

---

### 11. Demo script for the guide (Hoppscotch)

> “This is our comprehensive API testing approach on Hoppscotch — same REST surface the UI uses.”

1. Show the **Intradoc AI API** collection folders (Health → Auth → Chat → Docs → Admin → RBAC).
2. Show the **Intradoc Local** environment (`base_url`, empty `token`).
3. Run **H1** live probe — backend is up.
4. Run **A1 login** — Tests tab saves `token`; show Authorization: Bearer `<<token>>`.
5. Run **C1 + C3** — RAG response with `sources`, `steps`, `model_used`, cost, latency. Point at the test scripts that assert those fields.
6. Run **N1 / R2** — wrong password `400`, Viewer hitting admin `403`. That is the validation strategy, not only the happy path.
7. Show **M4 llm-config** — masked keys, `enforce_globally`.
8. Open the **results table** (section 10) and the exported collection as evidence that results were verified, not assumed.

---

### 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Network error / failed to fetch | Cloud Hoppscotch cannot see localhost | Use Desktop app or enable Interceptor/Agent |
| CORS error | Interceptor off, or backend not running | Start backend; enable interceptor |
| `401` on every protected call | Token not saved or environment not selected | Re-run login; confirm `Intradoc Local` is active; Tests tab must `pw.env.set("token", ...)` |
| Upload `400` / empty body | Sent JSON instead of multipart | Body → Multipart; `file` as File |
| RAG `404` session | `session_id` empty or deleted | Re-run C1; confirm `<<session_id>>` in environment |
| RAG slow / 500 | Missing Groq/Gemini key in admin config | Set keys via M5 (do not screenshot secrets) |
| Ready = `503` | Redis or Chroma down | Still valid: document `dependencies` flags; live check H1 should remain `200` |

---

## Alternative: Postman Collection Setup

Hoppscotch is the primary manual client. Postman can run the same URLs if needed.

### Environment Variables
| Variable | Value | Source |
|----------|-------|--------|
| `base_url` | `http://localhost:8001/api` | Manual |
| `token` | (auto from login) | `pm.collectionVariables.set('token', json.access)` |
| `refresh_token` | (auto from login) | `pm.collectionVariables.set('refresh_token', json.refresh)` |
| `session_id` | (auto from create session) | `pm.collectionVariables.set('session_id', json.id)` |
| `doc_id` | (auto from upload) | `pm.collectionVariables.set('doc_id', json.id)` |

### Pre-request Script (Add to Collection)
```javascript
// Auto-add Authorization header if token exists
if (pm.collectionVariables.has('token')) {
    pm.request.headers.add({key: 'Authorization', value: 'Bearer ' + pm.collectionVariables.get('token')});
}
```

### Test Scripts (Add to Each Request)

**Login/Signup:**
```javascript
pm.test("Status 200/201", () => pm.response.to.have.status(200));
pm.test("Has access token", () => {
    const json = pm.response.json();
    pm.expect(json).to.have.property('access');
    pm.collectionVariables.set('token', json.access);
    pm.collectionVariables.set('refresh_token', json.refresh);
    pm.collectionVariables.set('userRole', json.role);
});
```

**Protected Endpoints:**
```javascript
pm.test("Status 200/201", () => pm.response.to.have.status(200));
pm.test("Response is JSON", () => pm.response.to.be.json);
```

**Admin Endpoints (Verify Role):**
```javascript
pm.test("Admin access granted", () => {
    pm.expect(pm.collectionVariables.get('userRole')).to.equal('Admin');
});
```

**Department Isolation (For Viewer):**
```javascript
pm.test("Dept isolation enforced", () => {
    if (pm.collectionVariables.get('userRole') === 'Viewer') {
        const data = pm.response.json();
        if (Array.isArray(data)) {
            data.forEach(item => {
                pm.expect(item.department).to.equal(pm.collectionVariables.get('userDepartment'));
            });
        }
    }
});
```

Run order: Auth → Chat → Documents → Admin → RBAC. Use the Hoppscotch results table (section 10) as the verification log regardless of client.
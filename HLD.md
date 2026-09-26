# High-Level Design — Document Intelligent System

## Overview
RAG app: upload docs → chunk & index (Chroma) → query with LLM. Roles: Admin / Editor / Viewer. Department isolation.

## Architecture
```mermaid
graph TB
    U[User] --> FE[React Vite - 5173]
    FE --> BE[Django REST - 8000]
    BE --> DB[(SQLite)]
    BE --> VS[(Chroma)]
    BE --> RC[(Redis + RediSearch)]
    BE --> LLM[Groq / Gemini / OpenAI]
    BE --> SMTP[SMTP Email]
```

## Components
```mermaid
graph LR
    BE --> Auth[Auth + JWT]
    BE --> Chat[Chat / RAG]
    BE --> Docs[Documents]
    BE --> Admin[Admin Metrics]
    Chat --> RAG[RAG Pipeline]
    Docs --> Index[Chunk + Embed]
```

## Data Flows

**Upload (single or batch up to 1000 files)**
```mermaid
sequenceDiagram
    User->>FE: Upload PDF(s)
    FE->>BE: POST /documents/upload[/batch]
    BE->>BE: Version check (same name) + content dedupe (same info)
    BE->>VS: Chunk + Embed + Store (2-worker pool)
    BE->>DB: Save metadata
    BE-->>FE: ingesting / duplicate / superseded
```

**Query (streamed, single LLM call)**
```mermaid
sequenceDiagram
    User->>FE: Question
    FE->>BE: POST /chat/query/stream (SSE)
    BE->>RC: Semantic cache lookup
    RC-->>BE: Hit? instant answer, zero LLM
    BE->>VS: Hybrid search (dense + BM25 + RRF) + rerank
    BE->>BE: Guards: greeting / weak grounding (<20% cosine)
    BE->>LLM: 1 streamed call, max 5 pointed sentences
    LLM-->>BE: Token deltas + billed usage
    BE->>DB: Save messages + real tokens/cost
    BE-->>FE: token / citations / done events
```

**Invite**
```mermaid
sequenceDiagram
    Admin->>BE: POST /admin/invite
    BE->>SMTP: Send OTP
    BE->>DB: UserInvitation
    User->>BE: POST /auth/signup + OTP
    BE->>DB: Create User
```

## Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React, Vite, 5173 |
| Backend | Django REST, 8000 |
| DB | SQLite |
| Vector | Chroma (Persistent, dept collections) |
| Cache | Redis + RediSearch (semantic/embedding/retrieval/rerank/prompt) |
| LLM | Groq / Gemini / OpenAI |
| Auth | JWT |

## Roles
```mermaid
graph TD
    Admin -->|all| Editor
    Editor -->|upload + query| Viewer
    Viewer -->|query only| Guest
```

## Deployment
```mermaid
graph LR
    Dev[Local] --> BE2[8000] & FE2[5173] & DB2[SQLite] & VS2[Chroma] & RC2[Redis]
```

*Port 8000 only. No 8001.*

## Tuning Flags

`INTRADOC_FAST_PATH=1`, `INTRADOC_SHORT_ANSWERS=1`, `INTRADOC_MAX_TOKENS=512`,
`INTRADOC_MIN_SIMILARITY=20` (true cosine %), `INTRADOC_INDEX_WORKERS=2`,
`INTRADOC_DUP_SIM_THRESHOLD=0.85`. Redis must load the RediSearch module
(`./start_redis.sh` handles it) or the semantic cache stays disabled.

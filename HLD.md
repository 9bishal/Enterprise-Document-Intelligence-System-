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

**Upload**
```mermaid
sequenceDiagram
    User->>FE: Upload PDF
    FE->>BE: POST /documents/upload
    BE->>VS: Chunk + Embed + Store
    BE->>DB: Save metadata
    BE-->>FE: indexed
```

**Query**
```mermaid
sequenceDiagram
    User->>FE: Question
    FE->>BE: POST /chat/query
    BE->>VS: Vector search (dept filter)
    BE->>LLM: Prompt + Context
    LLM-->>BE: Answer
    BE->>DB: Save messages
    BE-->>FE: content + sources
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
| Vector | Chroma (Persistent) |
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
    Dev[Local] --> BE2[8000] & FE2[5173] & DB2[SQLite] & VS2[Chroma]
```

*Port 8000 only. No 8001.*

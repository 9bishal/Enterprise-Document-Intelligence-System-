# Deployment Status

## Current Deployment (Development)

### Running Services
```bash
# Backend (Gunicorn)
gunicorn django_backend.wsgi:application --bind 0.0.0.0:8000 --workers 1
# PID: 72804, Port: 8000
# Env: PYTORCH_ENABLE_MPS_FALLBACK=1

# Frontend (Vite Dev Server)
npm run dev
# Port: 5173, Proxy: /api → localhost:8000

# Database
SQLite: ./backend/db.sqlite3

# Vector Store
ChromaDB: ./backend/data/chroma/
```

### Verified Endpoints
| Service | URL | Status |
|---------|-----|--------|
| Backend API | http://localhost:8000/api/ | ✅ Running |
| Admin Console | http://localhost:5173/admin | ✅ Running |
| RAG Workspace | http://localhost:5173/query | ✅ Running |
| Health Check | http://localhost:8000/health/ | ✅ 200 OK |

---

## Production Deployment Checklist

### Infrastructure
- [ ] PostgreSQL 15+ (managed: RDS, CloudSQL, or self-hosted)
- [ ] ChromaDB persistent volume (or managed vector DB)
- [ ] Redis (for caching, Celery if async tasks added)
- [ ] Load balancer (nginx, ALB, Cloudflare)
- [ ] SSL certificates (Let's Encrypt or managed)
- [ ] Domain + DNS configuration

### Backend Configuration
- [ ] `DEBUG=False`
- [ ] `SECRET_KEY` from secure vault
- [ ] `ALLOWED_HOSTS` = production domain
- [ ] `DATABASE_URL` = PostgreSQL connection string
- [ ] `CHROMA_HOST` = ChromaDB service name
- [ ] `FERNET_KEY` = generated and stored securely
- [ ] `CORS_ALLOWED_ORIGINS` = frontend domain only
- [ ] Static files → `collectstatic` → CDN/S3
- [ ] Media files → S3/GCS + signed URLs

### Frontend Build
```bash
cd frontend
npm run build
# Output: dist/ (static files)
# Deploy to: nginx, Vercel, Netlify, S3+CloudFront
```

### Docker Images (Ready for Build)
```dockerfile
# Backend Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python manage.py collectstatic --noinput
EXPOSE 8000
CMD ["gunicorn", "django_backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4"]
```

```dockerfile
# Frontend Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### CI/CD Pipeline (GitHub Actions Example)
```yaml
# .github/workflows/deploy.yml
on: [push to main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Backend tests
        run: cd backend && pytest
      - name: Frontend tests
        run: cd frontend && npm test
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build & push backend
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ghcr.io/user/intradoc-backend:${{ github.sha }}
      - name: Build & push frontend
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ghcr.io/user/intradoc-frontend:${{ github.sha }}
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: kubectl set image deployment/intradoc-backend backend=ghcr.io/user/intradoc-backend:${{ github.sha }}
```

---

## Scaling Considerations

### Horizontal Scaling
| Component | Strategy |
|-----------|----------|
| Backend API | Stateless → Multiple Gunicorn workers + replicas |
| ChromaDB | Single writer, multiple readers → Read replicas |
| PostgreSQL | Read replicas for queries, primary for writes |
| Frontend | Static CDN + multiple origin servers |

### Bottleneck Analysis
| Operation | Current | Scaled |
|-----------|---------|--------|
| Embedding generation | CPU-bound, sync | Batch async + worker pool |
| LLM calls | Network-bound | Async + connection pooling |
| Vector search | ChromaDB single-node | ChromaDB cluster / Pinecone |
| File processing | Sync in request | Celery + Redis queue |

### Resource Estimates (1000 users, 10K docs)
| Resource | Development | Production |
|----------|-------------|------------|
| Backend CPU | 1 core | 4-8 cores |
| Backend RAM | 2 GB | 8-16 GB |
| PostgreSQL | SQLite | 4 cores, 16 GB |
| ChromaDB | Local | 4 cores, 32 GB |
| Storage | 1 GB | 100 GB + backups |

---

## Backup & Disaster Recovery

### Automated Backups
```bash
# PostgreSQL (daily)
pg_dump intradoc > backup_$(date +%Y%m%d).sql

# ChromaDB (weekly)
tar -czf chroma_backup_$(date +%Y%m%d).tar.gz ./data/chroma/

# Media files (daily)
aws s3 sync ./media s3://bucket/intradoc/media/
```

### Recovery Time Objectives
| Scenario | RTO | RPO |
|----------|-----|-----|
| Backend pod crash | < 30s | 0 (stateless) |
| Database failure | < 15 min | 24 hr (daily backup) |
| ChromaDB corruption | < 30 min | 1 week (weekly backup) |
| Full region outage | < 2 hr | 24 hr |

---

## Rollback Procedure
```bash
# Kubernetes rollback
kubectl rollout undo deployment/intradoc-backend
kubectl rollout undo deployment/intradoc-frontend

# Database migration rollback
python manage.py migrate django_backend 0006_previous_migration

# Frontend rollback (Vercel/Netlify)
vercel rollback [deployment-url]
```
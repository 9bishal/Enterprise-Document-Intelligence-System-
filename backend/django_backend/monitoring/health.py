from django.http import JsonResponse
from django.views.decorators.http import require_GET

@require_GET
def health_live(request):
    return JsonResponse({"status": "ok"})

@require_GET
def health_ready(request):
    deps = {"redis": False, "chromadb": False, "database": False}
    try:
        from django_backend.cache.base import get_redis
        r = get_redis()
        r.ping()
        deps["redis"] = True
    except Exception:
        pass
    try:
        import chromadb
        client = chromadb.HttpClient(host="localhost", port=8001)
        client.heartbeat()
        deps["chromadb"] = True
    except Exception:
        # Fallback: backend uses PersistentClient (file-based), not HttpClient
        # If PersistentClient path exists, consider chromadb healthy for degraded check
        try:
            import os
            chroma_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "chroma")
            if os.path.exists(chroma_path):
                deps["chromadb"] = True
        except Exception:
            pass
    try:
        from django.db import connection
        connection.ensure_connection()
        deps["database"] = True
    except Exception:
        pass
    all_ok = all(deps.values())
    status_code = 200 if all_ok else 503
    return JsonResponse({"status": "ok" if all_ok else "degraded", "dependencies": deps}, status=status_code)

@require_GET
def cache_stats(request):
    try:
        from ..cache.manager import CacheManager
        cm = CacheManager()
        stats = cm.stats()
        return JsonResponse(stats)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

import os
import time
from typing import Optional

from redisvl.extensions.cache.llm import SemanticCache

from .config import CACHE_SPECS, REDIS_URL, SEMANTIC_SIMILARITY_THRESHOLD, CacheType
from .metrics import CACHE_HITS, CACHE_LATENCY, CACHE_MISSES, CACHE_SET_TOTAL

EMBEDDING_MODEL_NAME = os.getenv("INTRADOC_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

def _shared_vectorizer():
    """Reuse the single embedding model from app.vector_store so we never load
    a second copy of the model in the same process (avoids OOM crashes)."""
    from app.vector_store import embeddings_model as _shared_model

    class _SharedVectorizer:
        def embed(self, text, **kwargs):
            return _shared_model.embed_query(text)

        def embed_many(self, texts, **kwargs):
            return _shared_model.embed_documents(texts)

    return _SharedVectorizer()

def _build_backend():
    ttl = CACHE_SPECS[CacheType.SEMANTIC_RESPONSE].ttl_seconds or None
    distance_threshold = round(1 - SEMANTIC_SIMILARITY_THRESHOLD, 4)
    vectorizer = _shared_vectorizer()
    return SemanticCache(
        name="intradoc_semantic_cache",
        redis_url=REDIS_URL,
        vectorizer=vectorizer,
        distance_threshold=distance_threshold,
        ttl=ttl,
    )

class SemanticResponseCache:
    def __init__(self):
        self.cache_type = CacheType.SEMANTIC_RESPONSE
        self._backend = _build_backend()

    def lookup(self, query_text: str) -> Optional[dict]:
        start = time.perf_counter()
        hits = self._backend.check(prompt=query_text)
        CACHE_LATENCY.labels(self.cache_type.value, "get").observe(time.perf_counter() - start)
        if not hits:
            CACHE_MISSES.labels(self.cache_type.value).inc()
            return None
        CACHE_HITS.labels(self.cache_type.value).inc()
        top = hits[0]
        return {
            "response": top.get("response"),
            "similarity": 1 - float(top.get("vector_distance", 0.0)),
            "metadata": top.get("metadata"),
        }

    def store(self, query_text: str, response: str, doc_ids: Optional[list[str]] = None) -> None:
        start = time.perf_counter()
        self._backend.store(
            prompt=query_text,
            response=response,
            metadata={"doc_ids": doc_ids or []},
        )
        CACHE_SET_TOTAL.labels(self.cache_type.value).inc()
        CACHE_LATENCY.labels(self.cache_type.value, "set").observe(time.perf_counter() - start)

    def invalidate_for_document(self, doc_id: str, reason: str = "document_updated") -> int:
        self._backend.clear()
        return -1

    def flush_type(self, reason: str = "manual") -> int:
        self._backend.clear()
        return -1

import hashlib
import json
import time
from typing import Any, Optional

import redis

from .config import CACHE_SPECS, REDIS_URL, CacheType
from .metrics import CACHE_HITS, CACHE_INVALIDATIONS, CACHE_LATENCY, CACHE_MISSES, CACHE_SET_TOTAL

_redis_client: Optional[redis.Redis] = None

def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client

def make_hash(*parts: Any) -> str:
    raw = "||".join(json.dumps(p, sort_keys=True, default=str) for p in parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:32]

class RedisCacheBase:
    cache_type: CacheType

    def __init__(self, cache_type: CacheType):
        self.cache_type = cache_type
        self.spec = CACHE_SPECS[cache_type]
        self.r = get_redis()

    def _key(self, key: str) -> str:
        return f"{self.spec.key_prefix}:{key}"

    def _doc_index_key(self, doc_id: str) -> str:
        return f"docidx:{doc_id}"

    def get(self, key: str) -> Optional[dict]:
        start = time.perf_counter()
        raw = self.r.get(self._key(key))
        CACHE_LATENCY.labels(self.cache_type.value, "get").observe(time.perf_counter() - start)
        if raw is None:
            CACHE_MISSES.labels(self.cache_type.value).inc()
            return None
        CACHE_HITS.labels(self.cache_type.value).inc()
        return json.loads(raw)

    def set(self, key: str, value: dict, doc_ids: Optional[list[str]] = None, ttl_override: Optional[int] = None) -> None:
        start = time.perf_counter()
        full_key = self._key(key)
        ttl = ttl_override if ttl_override is not None else self.spec.ttl_seconds
        payload = json.dumps(value, default=str)
        if ttl > 0:
            self.r.set(full_key, payload, ex=ttl)
        else:
            self.r.set(full_key, payload)

        if self.spec.doc_scoped and doc_ids:
            for doc_id in doc_ids:
                self.r.sadd(self._doc_index_key(doc_id), full_key)

        CACHE_SET_TOTAL.labels(self.cache_type.value).inc()
        CACHE_LATENCY.labels(self.cache_type.value, "set").observe(time.perf_counter() - start)

    def delete(self, key: str) -> None:
        self.r.delete(self._key(key))

    def invalidate_for_document(self, doc_id: str, reason: str = "document_updated") -> int:
        idx_key = self._doc_index_key(doc_id)
        members = self.r.smembers(idx_key)
        if not members:
            return 0
        self.r.delete(*members)
        self.r.delete(idx_key)
        CACHE_INVALIDATIONS.labels(self.cache_type.value, reason).inc(len(members))
        return len(members)

    def flush_type(self, reason: str = "manual") -> int:
        pattern = f"{self.spec.key_prefix}:*"
        cursor = 0
        keys = []
        while True:
            cursor, batch = self.r.scan(cursor=cursor, match=pattern, count=500)
            keys.extend(batch)
            if cursor == 0:
                break
        if keys:
            self.r.delete(*keys)
        CACHE_INVALIDATIONS.labels(self.cache_type.value, reason).inc(len(keys))
        return len(keys)

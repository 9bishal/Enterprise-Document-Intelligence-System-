from typing import Optional

from .base import RedisCacheBase, make_hash
from .config import CacheType

class EmbeddingCache(RedisCacheBase):
    def __init__(self):
        super().__init__(CacheType.EMBEDDING)

    def key_for(self, text: str, model_name: str) -> str:
        return make_hash(text, model_name)

    def get_embedding(self, text: str, model_name: str) -> Optional[list[float]]:
        cached = self.get(self.key_for(text, model_name))
        return cached["vector"] if cached else None

    def set_embedding(self, text: str, model_name: str, vector: list[float]) -> None:
        self.set(self.key_for(text, model_name), {"vector": vector, "model": model_name})

    def invalidate_model(self, model_name: str) -> int:
        pattern = f"{self.spec.key_prefix}:*"
        cursor = 0
        deleted = 0
        while True:
            cursor, keys = self.r.scan(cursor=cursor, match=pattern, count=500)
            for k in keys:
                raw = self.r.get(k)
                if raw and f'"model": "{model_name}"' in raw:
                    self.r.delete(k)
                    deleted += 1
            if cursor == 0:
                break
        return deleted

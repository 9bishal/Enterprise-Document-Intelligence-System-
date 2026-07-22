from typing import Optional

from .base import RedisCacheBase, make_hash
from .config import CacheType

class PromptCache(RedisCacheBase):
    def __init__(self):
        super().__init__(CacheType.PROMPT)

    def get_rendered(self, template_id: str, variables: dict) -> Optional[str]:
        cached = self.get(make_hash(template_id, variables))
        return cached["rendered"] if cached else None

    def set_rendered(self, template_id: str, variables: dict, rendered: str) -> None:
        self.set(make_hash(template_id, variables), {"rendered": rendered})

class RetrievalCache(RedisCacheBase):
    def __init__(self):
        super().__init__(CacheType.RETRIEVAL)

    def get_results(self, query: str, filters: dict) -> Optional[list[dict]]:
        cached = self.get(make_hash(query, filters))
        return cached["chunks"] if cached else None

    def set_results(self, query: str, filters: dict, chunks: list[dict], doc_ids: list[str]) -> None:
        self.set(make_hash(query, filters), {"chunks": chunks}, doc_ids=doc_ids)

class RerankingCache(RedisCacheBase):
    def __init__(self):
        super().__init__(CacheType.RERANKING)

    def get_scores(self, query: str, chunk_ids: list[str]) -> Optional[list[float]]:
        cached = self.get(make_hash(query, sorted(chunk_ids)))
        return cached["scores"] if cached else None

    def set_scores(self, query: str, chunk_ids: list[str], scores: list[float], doc_ids: list[str]) -> None:
        self.set(make_hash(query, sorted(chunk_ids)), {"scores": scores}, doc_ids=doc_ids)

class DocumentFingerprintCache(RedisCacheBase):
    def __init__(self):
        super().__init__(CacheType.DOC_FINGERPRINT)

    def get_fingerprint(self, doc_id: str) -> Optional[str]:
        cached = self.get(doc_id)
        return cached["fingerprint"] if cached else None

    def set_fingerprint(self, doc_id: str, content_hash: str) -> None:
        self.set(doc_id, {"fingerprint": content_hash})

    def is_duplicate(self, doc_id: str, content_hash: str) -> bool:
        existing = self.get_fingerprint(doc_id)
        return existing == content_hash

class EvaluationCache(RedisCacheBase):
    def __init__(self):
        super().__init__(CacheType.EVALUATION)

    def get_scores(self, query: str, response: str, context_hash: str) -> Optional[dict]:
        return self.get(make_hash(query, response, context_hash))

    def set_scores(self, query: str, response: str, context_hash: str, scores: dict) -> None:
        self.set(make_hash(query, response, context_hash), scores)

class MetadataCache(RedisCacheBase):
    def __init__(self):
        super().__init__(CacheType.METADATA)

    def get_metadata(self, doc_id: str) -> Optional[dict]:
        return self.get(doc_id)

    def set_metadata(self, doc_id: str, metadata: dict) -> None:
        self.set(doc_id, metadata, doc_ids=[doc_id])

class ResponseRepairCache(RedisCacheBase):
    def __init__(self):
        super().__init__(CacheType.RESPONSE_REPAIR)

    def get_repair(self, original_segment: str, violation_type: str) -> Optional[str]:
        cached = self.get(make_hash(original_segment, violation_type))
        return cached["repaired"] if cached else None

    def set_repair(self, original_segment: str, violation_type: str, repaired: str) -> None:
        self.set(make_hash(original_segment, violation_type), {"repaired": repaired})

class ModelRoutingCache(RedisCacheBase):
    def __init__(self):
        super().__init__(CacheType.MODEL_ROUTING)

    def get_route(self, query_class: str) -> Optional[dict]:
        return self.get(query_class)

    def set_route(self, query_class: str, route: dict) -> None:
        self.set(query_class, route)

class ConfigurationCache(RedisCacheBase):
    def __init__(self):
        super().__init__(CacheType.CONFIGURATION)

    def get_config(self, config_key: str) -> Optional[dict]:
        return self.get(config_key)

    def set_config(self, config_key: str, value: dict) -> None:
        self.set(config_key, value)

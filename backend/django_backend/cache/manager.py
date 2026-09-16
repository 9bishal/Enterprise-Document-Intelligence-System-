from .config import CacheType
from .domain_caches import (
    ConfigurationCache,
    DocumentFingerprintCache,
    EvaluationCache,
    MetadataCache,
    ModelRoutingCache,
    PromptCache,
    RerankingCache,
    ResponseRepairCache,
    RetrievalCache,
)
from .embedding_cache import EmbeddingCache

class CacheManager:
    def __init__(self):
        self._semantic_response = None
        self.prompt = PromptCache()
        self.embedding = EmbeddingCache()
        self.retrieval = RetrievalCache()
        self.reranking = RerankingCache()
        self.doc_fingerprint = DocumentFingerprintCache()
        self.evaluation = EvaluationCache()
        self.metadata = MetadataCache()
        self.response_repair = ResponseRepairCache()
        self.model_routing = ModelRoutingCache()
        self.configuration = ConfigurationCache()

    @property
    def semantic_response(self):
        if self._semantic_response is None:
            from .semantic_cache import SemanticResponseCache
            self._semantic_response = SemanticResponseCache()
        return self._semantic_response

    def on_document_updated(self, doc_id: str) -> dict[str, int]:
        results = {}
        for cache in (self.retrieval, self.reranking, self.metadata):
            results[cache.cache_type.value] = cache.invalidate_for_document(doc_id, reason="document_updated")
        if self._semantic_response is not None:
            results[self._semantic_response.cache_type.value] = self._semantic_response.invalidate_for_document(doc_id)
        return results

    def on_embeddings_regenerated(self, model_name: str) -> dict[str, int]:
        results = {"embedding": self.embedding.invalidate_model(model_name)}
        for cache in (self.retrieval, self.reranking):
            results[cache.cache_type.value] = cache.flush_type(reason="embeddings_regenerated")
        if self._semantic_response is not None:
            results[self._semantic_response.cache_type.value] = self._semantic_response.flush_type(reason="embeddings_regenerated")
        return results

    def stats(self) -> dict:
        r = self.configuration.r
        info = r.info("memory")
        return {
            "used_memory_human": info.get("used_memory_human"),
            "cache_types": [c.value for c in CacheType],
        }

cache_manager = CacheManager()

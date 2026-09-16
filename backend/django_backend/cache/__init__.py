from .config import CacheType, CacheSpec, CACHE_SPECS

__all__ = ["CacheType", "CacheSpec", "CACHE_SPECS"]

def get_cache_manager():
    from .manager import cache_manager
    return cache_manager

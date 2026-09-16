from prometheus_client import Counter, Histogram

CACHE_HITS = Counter(
    "intradoc_cache_hits_total",
    "Total cache hits",
    ["cache_type"],
)

CACHE_MISSES = Counter(
    "intradoc_cache_misses_total",
    "Total cache misses",
    ["cache_type"],
)

CACHE_SET_TOTAL = Counter(
    "intradoc_cache_sets_total",
    "Total cache writes",
    ["cache_type"],
)

CACHE_INVALIDATIONS = Counter(
    "intradoc_cache_invalidations_total",
    "Total cache invalidations",
    ["cache_type", "reason"],
)

CACHE_LATENCY = Histogram(
    "intradoc_cache_operation_seconds",
    "Cache operation latency",
    ["cache_type", "operation"],
    buckets=(0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1),
)

CACHE_LATENCY_SAVED = Histogram(
    "intradoc_cache_latency_saved_seconds",
    "Estimated latency saved on cache hit vs recompute",
    ["cache_type"],
)

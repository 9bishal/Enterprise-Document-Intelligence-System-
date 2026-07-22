from prometheus_client import Counter, Histogram, Gauge

REQUESTS_TOTAL = Counter(
    "intradoc_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)

REQUESTS_LATENCY = Histogram(
    "intradoc_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)

RAG_QUERIES_TOTAL = Counter(
    "intradoc_rag_queries_total",
    "Total RAG queries",
    ["model", "cache_hit", "success"],
)

RAG_LATENCY = Histogram(
    "intradoc_rag_query_duration_seconds",
    "RAG query latency",
    ["model"],
    buckets=(0.1, 0.5, 1, 2.5, 5, 10, 30, 60),
)

RAG_COST_TOTAL = Counter(
    "intradoc_rag_cost_total_usd",
    "Total estimated cost of RAG queries in USD",
    ["model"],
)

LLM_CALLS_TOTAL = Counter(
    "intradoc_llm_calls_total",
    "Total LLM API calls",
    ["provider", "model"],
)

LLM_LATENCY = Histogram(
    "intradoc_llm_call_duration_seconds",
    "LLM API call latency",
    ["provider", "model"],
    buckets=(0.1, 0.5, 1, 2.5, 5, 10, 30, 60),
)

DOCUMENTS_INDEXED = Counter(
    "intradoc_documents_indexed_total",
    "Total documents indexed",
    ["department", "status"],
)

ACTIVE_SESSIONS = Gauge(
    "intradoc_active_sessions",
    "Number of active chat sessions",
)

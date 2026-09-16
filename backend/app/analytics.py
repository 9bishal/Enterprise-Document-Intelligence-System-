import os
from functools import lru_cache
from typing import Optional

@lru_cache(maxsize=1)
def _langfuse():
    pk = os.getenv("LANGFUSE_PUBLIC_KEY")
    sk = os.getenv("LANGFUSE_SECRET_KEY")
    if not pk or not sk:
        return None
    try:
        from langfuse import Langfuse
        return Langfuse(public_key=pk, secret_key=sk, host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"))
    except Exception:
        return None

def trace_chat_turn(
    session_id: str,
    question: str,
    answer: str,
    retrieved_chunks: Optional[list] = None,
    model: str = "",
    latency_ms: float = 0,
    cost_usd: float = 0,
    cache_hit: bool = False,
    evaluation: Optional[dict] = None,
    guardrail_actions: Optional[list] = None,
):
    client = _langfuse()
    if client is None:
        return
    try:
        trace = client.trace(
            name="chat_turn",
            session_id=session_id,
            input={"question": question},
            output={"answer": answer},
            metadata={
                "model": model,
                "latency_ms": latency_ms,
                "cost_usd": cost_usd,
                "cache_hit": cache_hit,
                "evaluation": evaluation,
                "guardrail_actions": guardrail_actions or [],
                "num_chunks": len(retrieved_chunks) if retrieved_chunks else 0,
            },
        )
        trace.span(name="generation", output=answer)
        client.flush()
    except Exception:
        pass

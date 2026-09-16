import time
from collections import deque
from dataclasses import dataclass, asdict

from .pricing import count_tokens, estimate_cost

MAX_ENTRIES = 10000

@dataclass
class CostEntry:
    query: str
    response: str
    model: str
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float
    latency_seconds: float
    cache_hit: bool
    timestamp: float

class CostTracker:
    def __init__(self, maxlen=MAX_ENTRIES):
        self._entries: deque[CostEntry] = deque(maxlen=maxlen)

    def record(
        self,
        query: str,
        response: str,
        model: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_seconds: float = 0.0,
        cache_hit: bool = False,
    ) -> CostEntry:
        if input_tokens == 0:
            input_tokens = count_tokens(query)
        if output_tokens == 0:
            output_tokens = count_tokens(response)
        cost = estimate_cost(model, input_tokens, output_tokens)
        entry = CostEntry(
            query=query,
            response=response,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=cost,
            latency_seconds=latency_seconds,
            cache_hit=cache_hit,
            timestamp=time.time(),
        )
        self._entries.append(entry)
        return entry

    def total_cost(self) -> float:
        return sum(e.estimated_cost_usd for e in self._entries)

    def recent(self, n: int = 10) -> list[dict]:
        return [asdict(e) for e in self._entries[-n:]]

cost_tracker = CostTracker()

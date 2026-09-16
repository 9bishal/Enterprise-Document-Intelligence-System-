CHARS_PER_TOKEN = 4

def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // CHARS_PER_TOKEN)

def build_context(chunks: list[dict], max_context_tokens: int = 3000) -> tuple[str, list[dict]]:
    lines: list[str] = []
    used: list[dict] = []
    budget = max_context_tokens
    for i, chunk in enumerate(chunks, start=1):
        text = chunk.get("text", "").strip()
        if not text:
            continue
        cost = _estimate_tokens(text)
        if cost > budget:
            continue
        lines.append(f"[{i}] {text}")
        used.append(chunk)
        budget -= cost
        if budget <= 0:
            break
    return "\n\n".join(lines), used

def estimate_savings(chunks_before: int, chunks_after: int, tokens_before: int, tokens_after: int) -> dict:
    return {
        "chunks_dropped": chunks_before - chunks_after,
        "tokens_saved": tokens_before - tokens_after,
        "percent_saved": round((1 - tokens_after / max(tokens_before, 1)) * 100, 1),
    }

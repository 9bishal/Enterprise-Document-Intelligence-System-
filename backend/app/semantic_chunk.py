import re

SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
CHARS_PER_TOKEN = 4

def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // CHARS_PER_TOKEN)

def semantic_chunk(text: str, target_tokens: int = 300, overlap_sentences: int = 2) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    sentences: list[str] = []
    for para in paragraphs:
        sentences.extend(s.strip() for s in SENTENCE_SPLIT.split(para) if s.strip())
    chunks: list[str] = []
    current: list[str] = []
    current_tokens = 0
    for sentence in sentences:
        sentence_tokens = _estimate_tokens(sentence)
        if current and current_tokens + sentence_tokens > target_tokens:
            chunks.append(" ".join(current))
            current = current[-overlap_sentences:] if overlap_sentences else []
            current_tokens = sum(_estimate_tokens(s) for s in current)
        current.append(sentence)
        current_tokens += sentence_tokens
    if current:
        chunks.append(" ".join(current))
    return chunks

import re
import hashlib
# pyrefly: ignore [missing-import]
from rank_bm25 import BM25Okapi

_WORD_PATTERN = re.compile(r"\w+")
_bm25_cache = {}

def _corpus_hash(chunks: list[dict]) -> str:
    return hashlib.md5("".join(c["text"] for c in chunks).encode()).hexdigest()

def _tokenize(text: str) -> list[str]:
    return _WORD_PATTERN.findall(text.lower())

def bm25_search(chunks: list[dict], query: str, top_k: int) -> list[dict]:
    if not chunks:
        return []
    h = _corpus_hash(chunks)
    if h not in _bm25_cache:
        corpus = [_tokenize(c["text"]) for c in chunks]
        _bm25_cache[h] = BM25Okapi(corpus)
    bm25 = _bm25_cache[h]
    scores = bm25.get_scores(_tokenize(query))
    ranked = sorted(
        range(len(scores)),
        key=lambda i: scores[i],
        reverse=True,
    )[:top_k]
    results = []
    for i in ranked:
        chunk = dict(chunks[i])
        chunk["bm25_score"] = round(float(scores[i]), 4)
        results.append(chunk)
    return results

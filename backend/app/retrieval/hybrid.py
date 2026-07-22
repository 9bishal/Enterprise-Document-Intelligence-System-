RRF_K = 60

def reciprocal_rank_fusion(dense_ranked: list[dict], bm25_ranked: list[dict]) -> list[dict]:
    scores: dict[str, float] = {}
    chunks_by_id: dict[str, dict] = {}
    for rank, chunk in enumerate(dense_ranked):
        cid = chunk["id"]
        chunks_by_id[cid] = chunk
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (RRF_K + rank + 1)
    for rank, chunk in enumerate(bm25_ranked):
        cid = chunk["id"]
        chunks_by_id[cid] = chunk
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (RRF_K + rank + 1)
    fused = sorted(chunks_by_id.values(), key=lambda c: scores[c["id"]], reverse=True)
    for chunk in fused:
        chunk["rrf_score"] = round(scores[chunk["id"]], 4)
    return fused

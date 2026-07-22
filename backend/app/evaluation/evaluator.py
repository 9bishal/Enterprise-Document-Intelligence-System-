import json
import random
from typing import Optional

SAMPLE_RATE = float(__import__("os").getenv("INTRADOC_EVAL_SAMPLE_RATE", "0.1"))

def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)

def heuristic_scores(answer: str, context_chunks: list[dict]) -> dict:
    contextual_keywords = set()
    for chunk in context_chunks:
        for word in chunk.get("text", "").lower().split():
            if len(word) > 3:
                contextual_keywords.add(word)
    answer_words = answer.lower().split()
    supported = sum(1 for w in answer_words if w in contextual_keywords)
    total = max(len(answer_words), 1)
    faithfulness = round(supported / total, 4)
    groundedness_score = round(faithfulness * 10, 1)
    relevance_score = round(min(1.0, len(context_chunks) / 5) * 10, 1)
    overall_score = round((groundedness_score + relevance_score) / 2, 1)
    return {
        "faithfulness": faithfulness,
        "context_utilization": round(min(1.0, len(context_chunks) / 5), 4),
        "relevance_score": relevance_score,
        "groundedness_score": groundedness_score,
        "overall_score": overall_score,
        "answer_length_chars": len(answer),
        "estimated_tokens": _estimate_tokens(answer),
    }

def llm_judge(question: str, context_block: str, answer: str, api_keys: dict = None) -> Optional[dict]:
    if random.random() > SAMPLE_RATE:
        return None
    prompt = f"""Evaluate the answer quality based on the context provided.

Context:
{context_block[:2000]}

Question: {question}

Answer: {answer}

Return a JSON object with:
- "correctness": 0.0 to 1.0 (how factually correct is the answer given the context)
- "completeness": 0.0 to 1.0 (how completely does it answer the question)
- "hallucination": 0.0 to 1.0 (how much is not supported by context, higher = worse)
- "overall": 0.0 to 1.0 (overall quality)
- "brief_feedback": "one sentence summary" """
    try:
        from app.llm_helper import call_llm_json
        res = call_llm_json(
            prompt=prompt,
            system_prompt="You are a strict RAG evaluation judge. Return valid JSON only.",
            provider="gemini",
            api_keys=api_keys,
            temperature=0.0,
        )
        return {
            "correctness": float(res.get("correctness", 0)),
            "completeness": float(res.get("completeness", 0)),
            "hallucination": float(res.get("hallucination", 0)),
            "overall": float(res.get("overall", 0)),
            "feedback": res.get("brief_feedback", ""),
        }
    except Exception as e:
        print(f"LLM Judge error: {e}")
        return None

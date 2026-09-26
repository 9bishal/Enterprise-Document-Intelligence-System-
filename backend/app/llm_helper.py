import os
import re
import json
import time
import urllib.request
import urllib.error
import ssl
# pyrefly: ignore [missing-import]
import google.generativeai as genai
_is_debug = os.getenv("DEBUG", "False").lower() in ["true", "1", "yes"]
if _is_debug:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
else:
    ssl_context = ssl.create_default_context()

# Cache & metrics (lazy initialized)
_cache_enabled = False
_llm_cache = {}
_llm_metrics = {}

class CachedString(str):
    """String subclass to mark cached responses."""
    is_cached: bool = False


# Real provider-reported token usage from the most recent call, keyed by path.
# generate_node / run_rag_stream read these right after the call returns, so
# costs are computed from billed tokens, not the len//4 estimate.
_last_call_usage: dict = {"input_tokens": 0, "output_tokens": 0}
_last_stream_usage: dict = {"input_tokens": 0, "output_tokens": 0}


def _usage_from_openai_payload(obj: dict) -> dict:
    """Extract {input_tokens, output_tokens} from an OpenAI-style usage block
    (Groq parity: usage / x_groq.usage shapes, streaming or not)."""
    if not isinstance(obj, dict):
        return {}
    usage = obj.get("usage") or {}
    if not usage and isinstance(obj.get("x_groq"), dict):
        usage = obj["x_groq"].get("usage") or {}
    try:
        return {
            "input_tokens": int(usage.get("prompt_tokens", 0) or 0),
            "output_tokens": int(usage.get("completion_tokens", 0) or 0),
        }
    except Exception:
        return {}

def _init_llm_cache():
    """Lazy init of prompt cache and Prometheus metrics - avoids import errors if optional deps missing."""
    global _cache_enabled, _llm_cache, _llm_metrics
    if _cache_enabled:
        return
    try:
        from django_backend.cache.domain_caches import PromptCache
        from django_backend.cost_tracking.pricing import estimate_cost as ec, count_tokens as ct
        from django_backend.monitoring.metrics import LLM_CALLS_TOTAL, LLM_LATENCY
        _llm_cache["prompt"] = PromptCache()
        _llm_metrics["calls"] = LLM_CALLS_TOTAL
        _llm_metrics["latency"] = LLM_LATENCY
        _llm_metrics["estimate_cost"] = ec
        _llm_metrics["count_tokens"] = ct
        _cache_enabled = True
    except Exception:
        _cache_enabled = False

def resolve_llm_config():
    """
    Return the effective (provider, model, api_key) from the admin-saved
    global LLMConfig, or None when no provider has a usable API key.
    Fallback chain: configured provider -> Groq -> Gemini -> OpenAI -> env vars.
    """
    try:
        from django_backend.models import LLMConfig
        cfg = LLMConfig.objects.first()
    except Exception:
        cfg = None

    if cfg is None:
        return None

    configured_provider = (cfg.provider or "groq").lower()
    key_map = {
        "groq": cfg.get_groq_key(),
        "gemini": cfg.get_gemini_key(),
        "openai": cfg.get_openai_key(),
    }

    # Priority order: configured provider first, then fallbacks
    candidates = [
        (configured_provider, cfg.model, key_map.get(configured_provider, "")),
        ("groq", cfg.model, key_map["groq"]),
        ("gemini", cfg.model, key_map["gemini"]),
        ("openai", cfg.model, key_map["openai"]),
    ]

    for provider, model, key in candidates:
        if key:
            return {"provider": provider, "model": model, "api_key": key}

    # Fall back to environment variables
    for provider, env_names in (
        ("groq", ("GROQ_API_KEY",)),
        ("gemini", ("GEMINI_API_KEY", "GOOGLE_API_KEY")),
        ("openai", ("OPENAI_API_KEY",)),
    ):
        for env_name in env_names:
            if os.environ.get(env_name):
                return {"provider": provider, "model": cfg.model, "api_key": os.environ[env_name]}
    return None


def _strip_thinking(text: str) -> str:
    """Remove chain-of-thought / reasoning text from model output."""
    if not text:
        return text
    # Gemini-style: content wrapped between a 'thinking' marker and the final response
    text = re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.DOTALL)
    text = re.sub(r"<\|thinking\|>.*?<\|/thinking\|>", "", text, flags=re.DOTALL)
    text = re.sub(r"<\|reasoning\|>.*?<\|/reasoning\|>", "", text, flags=re.DOTALL)
    text = re.sub(r"<thinking[^>]*>.*?</thinking>", "", text, flags=re.DOTALL)
    text = re.sub(r"<start_of_turn>.*?<end_of_turn>\s*", "", text, flags=re.DOTALL)
    return text.strip()


def _plain_text_enabled() -> bool:
    """Plain-text answers (no *, #, |, backticks) — on by default, off with INTRADOC_PLAIN_TEXT=0."""
    return os.getenv("INTRADOC_PLAIN_TEXT", "1").lower() not in ("0", "false", "no")


def to_plain_text(text: str) -> str:
    """Strip markdown/table artefacts (*, #, |, backticks, etc.) without changing words."""
    if not text:
        return text
    # fenced code blocks -> inner text
    text = re.sub(r"```(?:\w+)?\n?(.*?)```", r"\1", text, flags=re.DOTALL)
    # headings: leading # characters
    text = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", text)
    # bold/italic/strike: **x**, __x__, *x*, _x_, ~~x~~ -> x
    text = re.sub(r"(\*\*|__)(.*?)\1", r"\2", text, flags=re.DOTALL)
    text = re.sub(r"(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r"\1", text)
    text = re.sub(r"~~(.*?)~~", r"\1", text, flags=re.DOTALL)
    # inline code `x` -> x
    text = re.sub(r"`([^`]*)`", r"\1", text)
    # markdown tables: drop separator rows, turn pipes into spaces
    lines = []
    for line in text.splitlines():
        s = line.strip()
        if re.match(r"^\s*\|?[\s:\-|]+\|?\s*$", s) and ("-" in s):
            continue
        if "|" in line:
            line = line.replace("|", " ")
        # normalize *- and +-bullets to dash points; keep "- " and "1. " points
        # as-is so short answers stay in point form without markdown chars
        line = re.sub(r"^\s*[*+]\s+", "- ", line)
        line = re.sub(r"^\s*(\d+)[.)]\s+", r"\1. ", line)
        line = re.sub(r"[ \t]+", " ", line).rstrip()
        lines.append(line)
    text = "\n".join(lines)
    # leftover stray markdown chars
    text = re.sub(r"(?m)^\s*>\s?", "", text)  # blockquote
    text = re.sub(r"\*", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _fast_max_tokens() -> int:
    """Cap output tokens (default 512: short answers are faster + cheaper).
    Override with INTRADOC_MAX_TOKENS. Grounded-rag-bot uses 1024; we go lower
    because answers are short numbered points, not essays."""
    try:
        return int(os.getenv("INTRADOC_MAX_TOKENS", "512"))
    except ValueError:
        return 512


def call_llm(
    prompt: str,
    system_prompt: str = "",
    provider: str = "gemini",
    api_key: str = "",
    model_name: str = "",
    temperature: float = 0.2,
    max_tokens: int = 0,
) -> str:
    """
    Universal LLM API Caller supporting Gemini, OpenAI, Groq, and Ollama.
    Handles prompt caching, token counting, cost estimation, and latency metrics.
    """
    provider = provider.lower()
    _init_llm_cache()
    cache_key_vars = {"prompt": prompt, "system_prompt": system_prompt, "provider": provider, "model": model_name, "temperature": temperature}
    ct = _llm_metrics.get("count_tokens", lambda x: len(x)//4) if _cache_enabled else (lambda x: 0)
    input_tokens = ct(prompt + system_prompt) if _cache_enabled else 0

    # 1. Check prompt cache - returns CachedString with is_cached=True if hit
    if _cache_enabled:
        cached = _llm_cache["prompt"].get_rendered("llm_response", cache_key_vars)
        if cached is not None:
            _llm_metrics["calls"].labels(provider, model_name or "unknown").inc()
            res_str = CachedString(cached)
            res_str.is_cached = True
            return res_str

    start_time = time.time()

    # 1. Google Gemini - uses google.generativeai SDK
    if provider == "gemini":
        try:
            key = (
                api_key
                or os.environ.get("GEMINI_API_KEY")
                or os.environ.get("GOOGLE_API_KEY")
            )
            if not key:
                raise ValueError(
                    "Gemini API Key is missing. Please configure it in Settings."
                )

            genai.configure(api_key=key)
            name = model_name or "gemini-1.5-flash"

            if "gemini-2.5" in name.lower():
                name = "gemini-1.5-flash"

            model = genai.GenerativeModel(
                model_name=name,
                generation_config={"temperature": temperature, "max_output_tokens": max_tokens or _fast_max_tokens()},
                system_instruction=system_prompt if system_prompt else None,
            )
            response = model.generate_content(prompt)
            result = response.text
            result = _strip_thinking(result)
            if _plain_text_enabled() and not result.startswith("Error"):
                result = to_plain_text(result)
            # Real billed tokens when the SDK reports them.
            try:
                um = getattr(response, "usage_metadata", None)
                if um is not None:
                    _last_call_usage["input_tokens"] = int(getattr(um, "prompt_token_count", 0) or 0)
                    _last_call_usage["output_tokens"] = int(getattr(um, "candidates_token_count", 0) or 0)
                else:
                    _last_call_usage["input_tokens"] = 0
                    _last_call_usage["output_tokens"] = 0
            except Exception:
                _last_call_usage["input_tokens"] = 0
                _last_call_usage["output_tokens"] = 0

            latency = time.time() - start_time
            if _cache_enabled:
                _llm_metrics["calls"].labels(provider, name).inc()
                _llm_metrics["latency"].labels(provider, name).observe(latency)
                _llm_cache["prompt"].set_rendered("llm_response", cache_key_vars, result)

            res_str = CachedString(result)
            res_str.is_cached = False
            return res_str
        except Exception as e:
            return f"Error with Gemini API: {str(e)}"
    else:
        url = ""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }

        if provider == "openai":
            key = api_key or os.environ.get("OPENAI_API_KEY")
            if not key:
                raise ValueError(
                    "OpenAI API Key is missing. Please configure it in Settings."
                )
            url = "https://api.openai.com/v1/chat/completions"
            headers["Authorization"] = f"Bearer {key}"
            name = model_name or "gpt-4o-mini"

        elif provider == "groq":
            key = api_key or os.environ.get("GROQ_API_KEY")
            if not key:
                raise ValueError(
                    "Groq API Key is missing. Please configure it in Settings."
                )
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers["Authorization"] = f"Bearer {key}"
            name = model_name or "llama-3.3-70b-versatile"

        elif provider == "ollama":
            url = "http://localhost:11434/v1/chat/completions"
            name = model_name or "llama3"

        else:
            return f"Error: Unsupported provider '{provider}'"

        messages_list = []
        if system_prompt:
            messages_list.append({"role": "system", "content": system_prompt})
        messages_list.append({"role": "user", "content": prompt})

        payload = {"model": name, "messages": messages_list, "temperature": temperature, "max_tokens": max_tokens or _fast_max_tokens()}

        if "JSON" in prompt:
            payload["response_format"] = {"type": "json_object"}

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=45, context=ssl_context) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                result = res_data["choices"][0]["message"]["content"]
                result = _strip_thinking(result)
                # Never plain-text a JSON-mode grading response (would break parsing)
                if _plain_text_enabled() and "response_format" not in payload and not result.startswith(("Error", "HTTP Error")):
                    result = to_plain_text(result)
                # Real billed tokens from the provider usage block.
                ru = _usage_from_openai_payload(res_data)
                _last_call_usage["input_tokens"] = ru.get("input_tokens", 0)
                _last_call_usage["output_tokens"] = ru.get("output_tokens", 0)

            latency = time.time() - start_time
            if _cache_enabled:
                _llm_metrics["calls"].labels(provider, name).inc()
                _llm_metrics["latency"].labels(provider, name).observe(latency)
                _llm_cache["prompt"].set_rendered("llm_response", cache_key_vars, result)

            res_str = CachedString(result)
            res_str.is_cached = False
            return res_str
        except urllib.error.HTTPError as e:
            try:
                err_body = json.loads(e.read().decode("utf-8"))
                err_msg = err_body.get("error", {}).get("message", str(e))
            except Exception:
                err_msg = str(e)
            return f"HTTP Error from {provider.capitalize()}: {err_msg}"
        except Exception as e:
            return f"Error connecting to {provider.capitalize()} API: {str(e)}"


def stream_llm(
    prompt: str,
    system_prompt: str = "",
    provider: str = "groq",
    api_key: str = "",
    model_name: str = "",
    temperature: float = 0.2,
    max_tokens: int = 0,
):
    """Yield answer text deltas as they arrive (SSE-style streaming).

    Groq/OpenAI stream token-by-token over HTTP SSE. Other providers fall back
    to yielding the full non-streaming result once, so callers never break.
    Finished lines are plain-text cleaned before yield, so streamed points
    never contain *, #, | or other markdown artefacts.
    """
    provider = (provider or "groq").lower()
    limit = max_tokens or _fast_max_tokens()

    if provider in ("groq", "openai"):
        url = (
            "https://api.groq.com/openai/v1/chat/completions"
            if provider == "groq"
            else "https://api.openai.com/v1/chat/completions"
        )
        key = api_key or os.environ.get(
            "GROQ_API_KEY" if provider == "groq" else "OPENAI_API_KEY", ""
        )
        if not key:
            yield f"Error: {provider.capitalize()} API Key is missing."
            return
        name = model_name or (
            "llama-3.3-70b-versatile" if provider == "groq" else "gpt-4o-mini"
        )
        messages_list = []
        if system_prompt:
            messages_list.append({"role": "system", "content": system_prompt})
        messages_list.append({"role": "user", "content": prompt})
        payload = {
            "model": name,
            "messages": messages_list,
            "temperature": temperature,
            "max_tokens": limit,
            "stream": True,
            # Ask Groq/OpenAI to append the billed usage block on the final
            # chunk so streamed answers also get real token counts.
            "stream_options": {"include_usage": True},
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
        try:
            req = urllib.request.Request(
                url, data=json.dumps(payload).encode("utf-8"),
                headers=headers, method="POST",
            )
            _last_stream_usage["input_tokens"] = 0
            _last_stream_usage["output_tokens"] = 0
            with urllib.request.urlopen(req, timeout=60, context=ssl_context) as resp:
                for raw in resp:
                    line = raw.decode("utf-8", errors="ignore").strip()
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        evt = json.loads(data)
                    except Exception:
                        continue
                    # Billed usage rides on the final chunk — capture it.
                    ru = _usage_from_openai_payload(evt)
                    if ru.get("input_tokens") or ru.get("output_tokens"):
                        _last_stream_usage["input_tokens"] = ru["input_tokens"]
                        _last_stream_usage["output_tokens"] = ru["output_tokens"]
                    choices = evt.get("choices", [])
                    if not choices:
                        continue
                    delta = (choices[0].get("delta", {}) or {}).get("content", "")
                    # Yield immediately: buffering (e.g. per-line) would hold
                    # back tokens and the UI would paint all at once. The
                    # system prompt already enforces plain point-style output.
                    if delta:
                        yield delta
        except Exception as e:
            yield f"Error connecting to {provider.capitalize()} API: {str(e)}"
        return

    # Non-streaming fallback: single chunk, same cleaning as call_llm.
    full = call_llm(
        prompt=prompt, system_prompt=system_prompt, provider=provider,
        api_key=api_key, model_name=model_name, temperature=temperature,
        max_tokens=limit,
    )
    yield str(full)


def call_llm_with_fallback(
    prompt: str,
    system_prompt: str = "",
    provider: str = "gemini",
    api_key: str = "",
    primary_model: str = "",
    fallback_provider: str = "",
    fallback_model: str = "",
    temperature: float = 0.2,
) -> tuple[str, str, bool]:
    """
    Try primary model; on failure fall back to a different provider/model.
    Returns (response_text, model_used, cache_hit).
    Fallback models chosen for free-tier reliability (e.g., allam-2-7b for Groq).
    """
    model_used = primary_model or f"{provider}_fast"
    result = call_llm(
        prompt=prompt,
        system_prompt=system_prompt,
        provider=provider,
        api_key=api_key,
        model_name=primary_model,
        temperature=temperature,
    )
    is_cached = getattr(result, 'is_cached', False)
    # Success: no error prefix in response
    if not result.startswith("Error") and not result.startswith("HTTP Error"):
        return str(result), model_used, is_cached

    fp = fallback_provider
    if not fp:
        return str(result), model_used, False
    # Default fallback models per provider - chosen for free-tier reliability
    fm = fallback_model or {"groq": "allam-2-7b", "gemini": "gemini-1.5-flash", "openai": "gpt-4o-mini"}.get(fp, "")
    model_used = fm
    print(f"Primary LLM failed, falling back to {fp}/{fm}: {result[:100]}")
    result = call_llm(
        prompt=prompt,
        system_prompt=system_prompt,
        provider=fp,
        api_key=api_key,
        model_name=fm,
        temperature=temperature,
    )
    return str(result), model_used, getattr(result, 'is_cached', False)


def call_llm_json(
    prompt: str,
    system_prompt: str = "",
    provider: str = "gemini",
    api_key: str = "",
    model_name: str = "",
    temperature: float = 0.2,
) -> dict:
    """
    Utility that calls LLM and guarantees a parsed JSON dict return.
    """
    res = call_llm(prompt, system_prompt, provider, api_key, model_name, temperature)

    # Try to parse markdown JSON code blocks if the LLM returned it wrapped in ```json ... ```
    clean_res = res.strip()
    if "```json" in clean_res:
        try:
            clean_res = clean_res.split("```json")[1].split("```")[0].strip()
        except IndexError:
            pass
    elif "```" in clean_res:
        try:
            clean_res = clean_res.split("```")[1].split("```")[0].strip()
        except IndexError:
            pass

    # Try parsing
    try:
        return json.loads(clean_res)
    except Exception:
        # Fallback dictionary if parsing fails
        if (
            "true" in res.lower()
            or '"relevant": true' in res.lower()
            or '"grounded": true' in res.lower()
        ):
            return {"relevant": True, "grounded": True, "error_parsing": True}
        return {
            "relevant": False,
            "grounded": False,
            "error_parsing": True,
            "raw_response": res,
        }

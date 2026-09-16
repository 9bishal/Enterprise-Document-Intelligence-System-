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


def call_llm(
    prompt: str,
    system_prompt: str = "",
    provider: str = "gemini",
    api_key: str = "",
    model_name: str = "",
    temperature: float = 0.2,
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
                generation_config={"temperature": temperature},
                system_instruction=system_prompt if system_prompt else None,
            )
            response = model.generate_content(prompt)
            result = response.text
            result = _strip_thinking(result)

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

        payload = {"model": name, "messages": messages_list, "temperature": temperature}

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

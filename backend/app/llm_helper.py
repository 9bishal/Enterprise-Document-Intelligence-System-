import os
import json
import time
import urllib.request
import urllib.error
import ssl
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

def _init_llm_cache():
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

def _sanitize_key(key: str) -> str:
    return key.strip() if key else ""

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
    """
    provider = provider.lower()
    _init_llm_cache()
    cache_key_vars = {"prompt": prompt, "system_prompt": system_prompt, "provider": provider, "model": model_name, "temperature": temperature}
    ct = _llm_metrics.get("count_tokens", lambda x: len(x)//4) if _cache_enabled else (lambda x: 0)
    input_tokens = ct(prompt + system_prompt) if _cache_enabled else 0

    # 1. Check prompt cache
    if _cache_enabled:
        cached = _llm_cache["prompt"].get_rendered("llm_response", cache_key_vars)
        if cached is not None:
            _llm_metrics["calls"].labels(provider, model_name or "unknown").inc()
            return cached

    start_time = time.time()

    # 1. Google Gemini
    if provider == "gemini":
        try:
            key = _sanitize_key(api_key)
            if not key:
                raise ValueError(
                    "Gemini API Key is missing. Configure it in Admin Settings."
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

            latency = time.time() - start_time
            if _cache_enabled:
                _llm_metrics["calls"].labels(provider, name).inc()
                _llm_metrics["latency"].labels(provider, name).observe(latency)
                _llm_cache["prompt"].set_rendered("llm_response", cache_key_vars, result)

            return result
        except Exception as e:
            return f"Error with Gemini API: {str(e)}"

    # 2. OpenAI / Groq / Ollama (OpenAI API spec or standard HTTP endpoint)
    else:
        url = ""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }

        if provider == "openai":
            key = _sanitize_key(api_key)
            if not key:
                raise ValueError(
                    "OpenAI API Key is missing. Configure it in Admin Settings."
                )
            url = "https://api.openai.com/v1/chat/completions"
            headers["Authorization"] = f"Bearer {key}"
            name = model_name or "gpt-4o-mini"

        elif provider == "groq":
            key = _sanitize_key(api_key)
            if not key:
                raise ValueError(
                    "Groq API Key is missing. Configure it in Admin Settings."
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

            latency = time.time() - start_time
            if _cache_enabled:
                _llm_metrics["calls"].labels(provider, name).inc()
                _llm_metrics["latency"].labels(provider, name).observe(latency)
                _llm_cache["prompt"].set_rendered("llm_response", cache_key_vars, result)

            return result
        except urllib.error.HTTPError as e:
            try:
                err_body = json.loads(e.read().decode("utf-8"))
                err_msg = err_body.get("error", {}).get("message", str(e))
            except Exception:
                err_msg = str(e)
            return f"HTTP Error from {provider.capitalize()}: {err_msg}"
        except Exception as e:
            return f"Error connecting to {provider.capitalize()} API: {str(e)}"


API_KEY_PREFIXES = {
    "groq": "gsk_",
    "gemini": "AIza",
    "openai": "sk-",
}

def _check_key_available(provider: str, api_keys: dict = None) -> bool:
    key = _sanitize_key((api_keys or {}).get(provider, ""))
    if not key:
        return False
    prefix = API_KEY_PREFIXES.get(provider)
    if prefix and key.startswith(prefix):
        return True
    if not prefix:
        return True
    return False

def _find_fallback_provider(primary: str, api_keys: dict = None) -> tuple[str, str]:
    """Find a fallback provider that has a valid API key available.
    Returns (provider, default_model)."""
    candidates = [
        ("groq", "llama-3.3-70b-versatile"),
        ("gemini", "gemini-1.5-flash"),
        ("openai", "gpt-4o-mini"),
    ]
    for fp, fm in candidates:
        if fp != primary and _check_key_available(fp, api_keys):
            return fp, fm
    return ("groq", "llama-3.3-70b-versatile")

def call_llm_with_fallback(
    prompt: str,
    system_prompt: str = "",
    provider: str = "gemini",
    api_key: str = "",
    api_keys: dict = None,
    primary_model: str = "",
    fallback_provider: str = "",
    fallback_model: str = "",
    temperature: float = 0.2,
) -> tuple[str, str]:
    """Try primary model; on failure fall back to a different provider/model.
    Falls back to env vars if api_key is empty.
    Returns (response_text, model_used)."""
    model_used = primary_model or f"{provider}_fast"

    primary_key = _sanitize_key(api_key)
    if not primary_key and api_keys:
        primary_key = _sanitize_key(api_keys.get(provider, ""))

    result = call_llm(
        prompt=prompt,
        system_prompt=system_prompt,
        provider=provider,
        api_key=primary_key,
        model_name=primary_model,
        temperature=temperature,
    )
    if not result.startswith("Error") and not result.startswith("HTTP Error"):
        return result, model_used

    fp = fallback_provider
    fm = fallback_model
    if not fp or not _check_key_available(fp, api_keys):
        fp, fm = _find_fallback_provider(provider, api_keys)
    if not fm:
        fm = "llama-3.3-70b-versatile" if fp == "groq" else "gemini-1.5-flash"
    model_used = fm

    fallback_key = _sanitize_key((api_keys or {}).get(fp, ""))
    print(f"Primary LLM failed, falling back to {fp}/{fm}: {result[:100]}")
    result = call_llm(
        prompt=prompt,
        system_prompt=system_prompt,
        provider=fp,
        api_key=fallback_key,
        model_name=fm,
        temperature=temperature,
    )
    return result, model_used


def call_llm_json(
    prompt: str,
    system_prompt: str = "",
    provider: str = "gemini",
    api_key: str = "",
    api_keys: dict = None,
    model_name: str = "",
    temperature: float = 0.2,
) -> dict:
    """
    Utility that calls LLM and guarantees a parsed JSON dict return.
    Falls back to a different provider if the primary call fails.
    """
    primary_key = _sanitize_key(api_key)
    if not primary_key and api_keys:
        primary_key = _sanitize_key(api_keys.get(provider, ""))

    res = call_llm(prompt, system_prompt, provider, primary_key, model_name, temperature)

    if res.startswith("Error") or res.startswith("HTTP Error"):
        fp, fm = _find_fallback_provider(provider, api_keys)
        fallback_key = _sanitize_key((api_keys or {}).get(fp, ""))
        print(f"Primary LLM failed in call_llm_json, falling back to {fp}/{fm}: {res[:100]}")
        res = call_llm(prompt, system_prompt, fp, fallback_key, fm, temperature)

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

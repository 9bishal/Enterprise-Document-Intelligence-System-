import os
import json
import urllib.request
import urllib.error
import ssl
import google.generativeai as genai
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Create SSL context that doesn't verify certificates (for development)
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

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

    # 1. Google Gemini
    if provider == "gemini":
        try:
            # Fallback to env if api_key is not passed in the request
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

            # Translate common naming
            if "gemini-2.5" in name.lower():
                name = "gemini-1.5-flash"  # fallback to supported sdk models if 2.5 is not loaded

            model = genai.GenerativeModel(
                model_name=name,
                generation_config={"temperature": temperature},
                system_instruction=system_prompt if system_prompt else None,
            )
            response = model.generate_content(prompt)
            return response.text
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

        # Construct messages payload
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {"model": name, "messages": messages, "temperature": temperature}

        # Check if the user wants JSON format
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
                return res_data["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            try:
                err_body = json.loads(e.read().decode("utf-8"))
                err_msg = err_body.get("error", {}).get("message", str(e))
            except Exception:
                err_msg = str(e)
            return f"HTTP Error from {provider.capitalize()}: {err_msg}"
        except Exception as e:
            return f"Error connecting to {provider.capitalize()} API: {str(e)}"


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

"""Talk to the language model: Ollama by default, or an optional OpenAI-compatible provider."""
import json
import os
from collections.abc import Iterator
from urllib.parse import urlparse

import httpx

from .config import DATA, KEYS_FILE, Settings

OLLAMA = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
if not OLLAMA.startswith("http"):
    OLLAMA = f"http://{OLLAMA}"

PROVIDERS = {
    "groq": {
        "name": "Groq", "base": "https://api.groq.com/openai/v1", "free": "Free tier, very fast",
        "steps": ["Open console.groq.com/keys and sign in", "Choose Create API Key", "Copy the key that starts with gsk_ and paste it here"],
        "url": "https://console.groq.com/keys",
    },
    "gemini": {
        "name": "Google Gemini", "base": "https://generativelanguage.googleapis.com/v1beta/openai", "free": "Free tier",
        "steps": ["Open aistudio.google.com/apikey and sign in", "Choose Create API key", "Copy it and paste it here"],
        "url": "https://aistudio.google.com/apikey",
    },
    "openrouter": {
        "name": "OpenRouter", "base": "https://openrouter.ai/api/v1", "free": "Many free models",
        "steps": ["Open openrouter.ai/keys and sign in", "Choose Create Key", "Copy the key that starts with sk-or- and paste it here"],
        "url": "https://openrouter.ai/keys",
    },
    "custom": {
        "name": "Any OpenAI-compatible", "base": "", "free": "Your own endpoint",
        "steps": ["Find your provider's base URL, ending in /v1", "Paste the base URL and the key here", "Test it, then pick a model"],
        "url": "",
    },
}


class LLMError(Exception):
    """A failure the user can act on. `hint` says what to do; `code` lets the UI offer a button."""

    def __init__(self, message: str, hint: str = "", code: str = "llm"):
        super().__init__(message)
        self.message, self.hint, self.code = message, hint, code


# ── Ollama ──
def ollama_status() -> dict:
    try:
        with httpx.Client(trust_env=False, timeout=1.5) as client:
            models = client.get(f"{OLLAMA}/api/tags").raise_for_status().json().get("models", [])
        return {"up": True, "models": [m["name"] for m in models]}
    except (httpx.HTTPError, ValueError):
        return {"up": False, "models": []}


def pull(model: str) -> Iterator[dict]:
    """Download a model through Ollama, yielding its progress lines."""
    try:
        with httpx.Client(trust_env=False, timeout=httpx.Timeout(10, read=None)) as client:
            with client.stream("POST", f"{OLLAMA}/api/pull", json={"model": model}) as response:
                for line in response.iter_lines():
                    if line:
                        yield json.loads(line)
    except httpx.HTTPError as err:
        yield {"error": f"Ollama is not reachable ({type(err).__name__}). Is it running?"}


def _stream_ollama(messages: list[dict], settings: Settings) -> Iterator[dict]:
    body = {
        "model": settings.model, "messages": messages, "stream": True,
        "options": {"temperature": settings.temperature, "num_ctx": 4096},
    }
    try:
        with httpx.Client(trust_env=False, timeout=httpx.Timeout(5, read=300)) as client:
            with client.stream("POST", f"{OLLAMA}/api/chat", json=body) as response:
                if response.status_code == 404:
                    raise LLMError(f"The model {settings.model} is not downloaded yet.",
                                   f"Run: ollama pull {settings.model}", "model_missing")
                if response.status_code != 200:
                    response.read()
                    raise LLMError("Ollama returned an error.", response.text[:300])
                for line in response.iter_lines():
                    if not line:
                        continue
                    part = json.loads(line)
                    if part.get("message", {}).get("content"):
                        yield {"token": part["message"]["content"]}
                    if part.get("done"):
                        seconds = part.get("eval_duration", 0) / 1e9
                        yield {"stats": {
                            "tokens": part.get("eval_count", 0),
                            "tokens_per_s": round(part.get("eval_count", 0) / seconds, 1) if seconds else 0,
                            "prompt_tokens": part.get("prompt_eval_count", 0),
                        }}
    except httpx.ConnectError as err:
        raise LLMError("Ollama is not running.", "Start the Ollama app, or run: ollama serve", "ollama_down") from err
    except httpx.TimeoutException as err:
        raise LLMError("The model took too long to answer.", "Try a smaller model, or ask again.") from err


# ── Optional providers (OpenAI-compatible) ──
def _base_of(provider: str, keys: dict) -> str:
    saved = keys.get(provider, {})
    return (saved.get("base") or PROVIDERS[provider]["base"]).rstrip("/")


def _stream_openai(messages: list[dict], settings: Settings) -> Iterator[dict]:
    keys = load_keys()
    if settings.provider not in PROVIDERS or settings.provider not in keys:
        raise LLMError("No API key saved for this provider.", "Add one in the Keys tab, or switch back to Ollama.", "no_key")
    headers = {"Authorization": f"Bearer {keys[settings.provider]['key']}"}
    body = {"model": settings.model, "messages": messages, "stream": True, "temperature": settings.temperature}
    url = f"{_base_of(settings.provider, keys)}/chat/completions"
    try:
        with httpx.Client(timeout=httpx.Timeout(10, read=120)) as client:
            with client.stream("POST", url, json=body, headers=headers) as response:
                if response.status_code != 200:
                    response.read()
                    raise LLMError(f"The provider returned {response.status_code}.", _safe_detail(response))
                for line in response.iter_lines():
                    if not line.startswith("data:") or line.endswith("[DONE]"):
                        continue
                    choices = json.loads(line[5:]).get("choices") or [{}]
                    token = choices[0].get("delta", {}).get("content")
                    if token:
                        yield {"token": token}
    except httpx.HTTPError as err:
        raise LLMError("Could not reach the provider.", type(err).__name__) from err


def _safe_detail(response: httpx.Response) -> str:
    try:
        error = response.json().get("error", "")
        return (error.get("message", "") if isinstance(error, dict) else str(error))[:300]
    except ValueError:
        return ""


def stream(messages: list[dict], settings: Settings) -> Iterator[dict]:
    """Yield {'token': text} pieces, then at most one {'stats': {...}}."""
    return _stream_ollama(messages, settings) if settings.provider == "ollama" else _stream_openai(messages, settings)


# ── Key storage. The full key never leaves this module except to the provider itself. ──
def load_keys() -> dict:
    try:
        return json.loads(KEYS_FILE.read_text("utf-8"))
    except (OSError, ValueError):
        return {}


def _write_keys(keys: dict) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    KEYS_FILE.write_text(json.dumps(keys), "utf-8")


def masked_keys() -> dict:
    keys = load_keys()
    return {
        name: {
            **{k: info[k] for k in ("name", "free", "steps", "url")},
            "saved": name in keys,
            "last4": keys[name]["key"][-4:] if name in keys else "",
            "base": _base_of(name, keys),
            "needs_base": name == "custom",
        }
        for name, info in PROVIDERS.items()
    }


def save_key(provider: str, key: str, base: str = "") -> None:
    if provider not in PROVIDERS:
        raise LLMError("Unknown provider.")
    key = key.strip()
    if not 8 <= len(key) <= 400 or any(c.isspace() for c in key):
        raise LLMError("That does not look like an API key.", "Paste the whole key, with no spaces.")
    if provider == "custom":
        parsed = urlparse(base)
        local = parsed.hostname in ("localhost", "127.0.0.1")
        if not parsed.hostname or (parsed.scheme != "https" and not (local and parsed.scheme == "http")):
            raise LLMError("The base URL must start with https://", "Keys must not travel over plain http.")
    keys = load_keys()
    keys[provider] = {"key": key, **({"base": base} if provider == "custom" else {})}
    _write_keys(keys)


def remove_key(provider: str) -> None:
    keys = load_keys()
    keys.pop(provider, None)
    _write_keys(keys)


def test_key(provider: str) -> dict:
    """Ask the provider for its model list. A cheap way to prove the key works."""
    keys = load_keys()
    if provider not in PROVIDERS or provider not in keys:
        return {"ok": False, "message": "No key saved yet."}
    headers = {"Authorization": f"Bearer {keys[provider]['key']}"}
    try:
        response = httpx.get(f"{_base_of(provider, keys)}/models", headers=headers, timeout=12)
    except httpx.HTTPError as err:
        return {"ok": False, "message": f"Could not reach the provider ({type(err).__name__})."}
    if response.status_code in (401, 403):
        return {"ok": False, "message": "The provider rejected this key."}
    if response.status_code != 200:
        return {"ok": False, "message": f"The provider returned {response.status_code}."}
    try:
        models = sorted(m["id"] for m in response.json().get("data", []))
    except (ValueError, KeyError, TypeError):
        models = []
    return {"ok": True, "message": "Key works.", "models": models}

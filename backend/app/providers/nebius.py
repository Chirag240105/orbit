import re

import httpx

from app.config import Settings
from app.core.errors import AppError
from app.providers.base import ChatProvider, ProviderResult

_THINK = re.compile(r"<think>.*?</think>", re.S)


class NebiusProvider(ChatProvider):
    """Nebius Token Factory, OpenAI-compatible /chat/completions. Hosted inference: data leaves the machine."""

    name = "nebius"
    configured = True

    def __init__(self, settings: Settings):
        self._key, self._base, self._timeout = settings.nebius_api_key, settings.nebius_base_url.rstrip("/"), settings.provider_timeout_s
        self.model = settings.nebius_model

    async def complete(self, messages: list[dict]) -> ProviderResult:
        payload = {"model": self.model, "messages": messages, "temperature": 0.2, "max_tokens": 4096}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.post(f"{self._base}/chat/completions", json=payload, headers={"Authorization": f"Bearer {self._key}"})
        except httpx.HTTPError:
            raise AppError("provider_unreachable", "Could not reach the model provider. Check your network and NEBIUS_BASE_URL.", 502) from None
        if r.status_code in (401, 403):
            raise AppError("provider_auth_failed", "The model provider rejected the API key. Check NEBIUS_API_KEY.", 502)
        if r.status_code == 404:
            raise AppError("provider_model_not_found", "Model not found. Run scripts/list_models.py and update NEBIUS_MODEL.", 502)
        if r.status_code == 429:
            raise AppError("provider_rate_limited", "The model provider is rate limiting requests. Try again shortly.", 502)
        if r.status_code >= 400:
            raise AppError("provider_error", f"The model provider returned an error ({r.status_code}).", 502)
        try:
            msg = r.json()["choices"][0]["message"]
        except (KeyError, IndexError, ValueError):
            raise AppError("provider_bad_response", "The model provider returned an unexpected response.", 502) from None
        text = _THINK.sub("", msg.get("content") or "").strip()
        if not text:
            # Nemotron models on Token Factory are reasoning models; content can be empty if reasoning used the budget.
            raise AppError("provider_empty_response", "The model returned no answer (reasoning may have used the token budget). Try again.", 502)
        return ProviderResult(text=text, model=self.model)

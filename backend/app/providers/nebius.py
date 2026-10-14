import json
import re
from collections.abc import AsyncIterator

import httpx

from app.config import Settings
from app.core.errors import AppError
from app.providers.base import ChatProvider, ProviderResult, StreamChunk

_THINK = re.compile(r"<think>.*?</think>", re.S)
_OPEN = "<think>"


def _visible(raw: str, *, final: bool = False) -> str:
    """Answer text without reasoning blocks. While streaming, hold back an unclosed <think> block and a
    trailing partial '<think' so text already sent never has to be taken back."""
    text = _THINK.sub("", raw)
    if _OPEN in text:
        text = text[: text.index(_OPEN)]
    if not final:
        for k in range(len(_OPEN) - 1, 0, -1):
            if text.endswith(_OPEN[:k]):
                return text[:-k]
    return text


def _raise_for_status(code: int) -> None:
    if code in (401, 403):
        raise AppError("provider_auth_failed", "The model provider rejected the API key. Check NEBIUS_API_KEY.", 502)
    if code == 404:
        raise AppError("provider_model_not_found", "Model not found. Run scripts/list_models.py and update NEBIUS_MODEL.", 502)
    if code == 429:
        raise AppError("provider_rate_limited", "The model provider is rate limiting requests. Try again shortly.", 502)
    if code >= 400:
        raise AppError("provider_error", f"The model provider returned an error ({code}).", 502)


def _unreachable() -> AppError:
    return AppError("provider_unreachable", "Could not reach the model provider. Check your network and NEBIUS_BASE_URL.", 502)


def _empty() -> AppError:
    # Nemotron models on Token Factory are reasoning models; content can be empty if reasoning used the budget.
    return AppError("provider_empty_response", "The model returned no answer (reasoning may have used the token budget). Try again.", 502)


class NebiusProvider(ChatProvider):
    """Nebius Token Factory, OpenAI-compatible /chat/completions. Hosted inference: data leaves the machine."""

    name = "nebius"
    configured = True

    def __init__(self, settings: Settings):
        self._key, self._base, self._timeout = settings.nebius_api_key, settings.nebius_base_url.rstrip("/"), settings.provider_timeout_s
        self._max_tokens = settings.provider_max_tokens
        self.model = settings.nebius_model

    def _payload(self, messages: list[dict], max_tokens: int | None, stream: bool) -> dict:
        payload = {"model": self.model, "messages": messages, "temperature": 0.2, "max_tokens": max_tokens or self._max_tokens}
        if stream:
            payload["stream"] = True
        return payload

    async def complete(self, messages: list[dict], *, max_tokens: int | None = None) -> ProviderResult:
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.post(f"{self._base}/chat/completions", json=self._payload(messages, max_tokens, False), headers={"Authorization": f"Bearer {self._key}"})
        except httpx.HTTPError:
            raise _unreachable() from None
        _raise_for_status(r.status_code)
        try:
            msg = r.json()["choices"][0]["message"]
        except (KeyError, IndexError, ValueError, TypeError):
            raise AppError("provider_bad_response", "The model provider returned an unexpected response.", 502) from None
        text = _visible(msg.get("content") or "", final=True).strip()
        if not text:
            raise _empty()
        return ProviderResult(text=text, model=self.model)

    async def stream(self, messages: list[dict], *, max_tokens: int | None = None) -> AsyncIterator[StreamChunk]:
        raw, sent, thinking = "", 0, False
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                async with client.stream("POST", f"{self._base}/chat/completions", json=self._payload(messages, max_tokens, True), headers={"Authorization": f"Bearer {self._key}"}) as r:
                    if r.status_code >= 400:
                        await r.aread()
                        _raise_for_status(r.status_code)
                    async for line in r.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            delta = json.loads(data)["choices"][0].get("delta") or {}
                        except (ValueError, KeyError, IndexError, TypeError, AttributeError):
                            continue
                        if delta.get("reasoning_content") and not thinking:
                            thinking = True
                            yield StreamChunk("thinking")
                        if delta.get("content"):
                            raw += delta["content"]
                            visible = _visible(raw).lstrip()
                            if len(visible) > sent:
                                yield StreamChunk("token", visible[sent:])
                                sent = len(visible)
        except httpx.HTTPError:
            raise _unreachable() from None
        rest = _visible(raw, final=True).lstrip()
        if not rest.strip():
            raise _empty()
        if len(rest) > sent:
            yield StreamChunk("token", rest[sent:])

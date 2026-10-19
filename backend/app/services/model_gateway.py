"""OpenAI-compatible model gateway for chat, streaming, embeddings, and health checks."""

import asyncio
import hashlib
import logging
import math
import re
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Literal

import httpx

from app.config import Settings
from app.core.errors import AppError

log = logging.getLogger("orbit.model_gateway")
Task = Literal["planner", "fast"]
_THINK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


@dataclass
class ModelResult:
    text: str
    provider: str
    model: str
    latency_ms: int
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


class ModelGateway:
    """Centralizes provider routing and OpenAI-compatible HTTP behavior."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.provider = settings.llm_provider
        self.base_url, self.api_key = self._connection()
        self._reachability: dict[str, Any] = {"reachable": None, "checked_at": None}
        self._reachability_checked_monotonic: float | None = None

    def _connection(self) -> tuple[str, str | None]:
        if self.provider == "nvidia":
            return self.settings.nvidia_base_url, self.settings.nvidia_api_key
        return self.settings.nebius_base_url, self.settings.nebius_api_key

    def model_for(self, task: Task) -> str:
        model = self.settings.model_planner if task == "planner" else self.settings.model_fast
        if not model:
            raise AppError("model_not_configured", f"Set MODEL_{task.upper()} for the active provider.", 503)
        return model

    @property
    def configured(self) -> bool:
        return self.provider == "demo" or bool(self.api_key)

    def _require_configured(self) -> None:
        if not self.configured:
            key = "NVIDIA_API_KEY" if self.provider == "nvidia" else "NEBIUS_API_KEY"
            raise AppError("provider_not_configured", f"Set {key} or select LLM_PROVIDER=demo.", 503)

    async def _request(self, method: str, path: str, *, json_body: dict | None = None) -> httpx.Response:
        self._require_configured()
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        attempts = self.settings.provider_retries + 1
        for attempt in range(attempts):
            try:
                async with httpx.AsyncClient(timeout=self.settings.provider_timeout_s) as client:
                    response = await client.request(method, f"{self.base_url}/{path.lstrip('/')}", json=json_body, headers=headers)
                if response.status_code >= 500 and attempt + 1 < attempts:
                    continue
                return response
            except httpx.HTTPError:
                if attempt + 1 == attempts:
                    raise AppError("provider_unreachable", "Could not reach the model provider. Check the network and provider URL.", 502) from None
        raise AppError("provider_unreachable", "Could not reach the model provider.", 502)

    def _check_response(self, response: httpx.Response, *, models_path: str = "scripts/list_models.py") -> None:
        if response.status_code in (401, 403):
            raise AppError("provider_auth_failed", "The model provider rejected its API key. Check the provider credentials.", 502)
        if response.status_code == 404:
            raise AppError("provider_model_not_found", f"Model or endpoint not found. Run {models_path} to inspect available models.", 502)
        if response.status_code == 429:
            raise AppError("provider_rate_limited", "The model provider is rate limiting requests. Try again shortly.", 502)
        if response.status_code >= 400:
            raise AppError("provider_error", f"The model provider returned an error ({response.status_code}).", 502)

    async def complete(self, messages: list[dict], task: Task = "planner") -> ModelResult:
        model = self.model_for(task)
        started = time.perf_counter()
        response = await self._request("POST", "chat/completions", json_body={
            "model": model, "messages": messages, "temperature": 0.2, "max_tokens": 4096,
        })
        self._check_response(response)
        try:
            body = response.json()
            message = body["choices"][0]["message"]
            raw = message.get("content")
            if isinstance(raw, list):
                raw = "".join(part.get("text", "") for part in raw if isinstance(part, dict))
            content = _THINK.sub("", raw or "").strip()
            usage = body.get("usage") or {}
        except (KeyError, IndexError, ValueError, TypeError):
            raise AppError("provider_bad_response", "The model provider returned an unexpected response.", 502) from None
        latency = round((time.perf_counter() - started) * 1000)
        result = ModelResult(content, self.provider, model, latency, usage.get("prompt_tokens"), usage.get("completion_tokens"))
        log.info("model.complete provider=%s model=%s task=%s latency_ms=%d prompt_tokens=%s completion_tokens=%s",
                 self.provider, model, task, latency, result.prompt_tokens, result.completion_tokens)
        if not content:
            raise AppError("provider_empty_response", "The model returned no answer; reasoning may have used the token budget. Try again.", 502)
        return result

    async def stream(self, messages: list[dict], task: Task = "planner") -> AsyncIterator[str]:
        """Yield content deltas from a server-sent OpenAI-compatible chat completion."""
        model = self.model_for(task)
        started = time.perf_counter()
        self._require_configured()
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        prompt_tokens = completion_tokens = None
        try:
            for attempt in range(self.settings.provider_retries + 1):
                emitted = False
                try:
                    async with httpx.AsyncClient(timeout=self.settings.provider_timeout_s) as client:
                        async with client.stream("POST", f"{self.base_url}/chat/completions", json={
                            "model": model, "messages": messages, "temperature": 0.2, "max_tokens": 4096, "stream": True,
                            "stream_options": {"include_usage": True},
                        }, headers=headers) as response:
                            if response.status_code >= 500 and attempt < self.settings.provider_retries:
                                continue
                            self._check_response(response)
                            async for line in response.aiter_lines():
                                if not line.startswith("data:"):
                                    continue
                                data = line[5:].strip()
                                if data == "[DONE]":
                                    break
                                try:
                                    chunk = httpx.Response(200, text=data).json()
                                    usage = chunk.get("usage") or {}
                                    prompt_tokens = usage.get("prompt_tokens", prompt_tokens)
                                    completion_tokens = usage.get("completion_tokens", completion_tokens)
                                    choice = chunk.get("choices", [{}])[0]
                                    delta = choice.get("delta", {}).get("content")
                                    if isinstance(delta, str) and delta:
                                        emitted = True
                                        yield delta
                                except (ValueError, KeyError, IndexError, TypeError):
                                    continue
                    break
                except httpx.HTTPError:
                    if attempt >= self.settings.provider_retries or emitted:
                        raise
        except httpx.HTTPError:
            raise AppError("provider_unreachable", "Could not reach the model provider. Check the network and provider URL.", 502) from None
        finally:
            log.info("model.stream provider=%s model=%s task=%s latency_ms=%d prompt_tokens=%s completion_tokens=%s",
                     self.provider, model, task, round((time.perf_counter() - started) * 1000), prompt_tokens, completion_tokens)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if self.provider == "demo" or self.settings.mock_ai or self.settings.demo_mode:
            return await asyncio.to_thread(self._demo_embeddings, texts)
        if self.provider != "demo" and self.settings.model_embed and self.api_key:
            try:
                response = await self._request("POST", "embeddings", json_body={"model": self.settings.model_embed, "input": texts})
                self._check_response(response)
                vectors = [row["embedding"] for row in response.json()["data"]]
                if len(vectors) != len(texts) or any(len(vector) != self.settings.embedding_dimension for vector in vectors):
                    raise ValueError("configured embedding dimension mismatch")
                return vectors
            except AppError as exc:
                if exc.code not in {"provider_model_not_found", "provider_error"}:
                    raise
                log.warning("model.embedding_unavailable provider=%s model=%s fallback=sentence_transformers", self.provider, self.settings.model_embed)
            except (KeyError, TypeError, ValueError):
                log.warning("model.embedding_invalid provider=%s model=%s fallback=sentence_transformers", self.provider, self.settings.model_embed)
        return await asyncio.to_thread(self._local_embeddings, texts)

    def _demo_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Stable synthetic vectors for UI and tests; never used as production embeddings."""
        dimension = self.settings.embedding_dimension
        vectors = []
        for text in texts:
            raw = hashlib.shake_256(text.casefold().encode()).digest(dimension * 4)
            vector = [int.from_bytes(raw[i:i + 4], "big") / 2**31 - 1 for i in range(0, len(raw), 4)]
            norm = math.sqrt(sum(value * value for value in vector)) or 1.0
            vectors.append([value / norm for value in vector])
        return vectors

    def _local_embeddings(self, texts: list[str]) -> list[list[float]]:
        if not self.settings.embedding_fallback_model:
            raise AppError("embedding_unavailable", "Set ORBIT_EMBEDDING_FALLBACK_MODEL to enable local embeddings.", 503)
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise AppError("embedding_unavailable", "No remote embedding model is configured and sentence-transformers is not installed.", 503) from None
        model = SentenceTransformer(self.settings.embedding_fallback_model)
        vectors = model.encode(texts, normalize_embeddings=True).tolist()
        if any(len(vector) != self.settings.embedding_dimension for vector in vectors):
            raise AppError("embedding_dimension_mismatch", "The local embedding model dimension does not match ORBIT_EMBEDDING_DIMENSION.", 503)
        return vectors

    async def check_reachability(self) -> dict[str, Any]:
        if self._reachability_checked_monotonic is not None and time.monotonic() - self._reachability_checked_monotonic < 30:
            return dict(self._reachability)
        if self.provider == "demo" or self.settings.mock_ai or self.settings.demo_mode:
            status = {"reachable": True, "checked_at": time.time(), "reason": "demo mode does not contact a provider"}
        elif not self.api_key:
            status = {"reachable": False, "checked_at": time.time(), "reason": "provider key is not configured"}
        else:
            try:
                response = await self._request("GET", "models")
                self._check_response(response)
                status = {"reachable": True, "checked_at": time.time()}
            except AppError as exc:
                status = {"reachable": False, "checked_at": time.time(), "reason": exc.code}
        self._reachability = status
        self._reachability_checked_monotonic = time.monotonic()
        return dict(status)

"""OpenAI-compatible model gateway for chat, streaming, embeddings, and health checks.

Supports NVIDIA hosted API (default) and Nebius Token Factory (config switch).
"""

import asyncio
import hashlib
import json
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
_KEY_NAMES = {"nvidia": "NVIDIA_API_KEY", "nebius": "NEBIUS_API_KEY"}

Task = Literal[
    "chat", "scene_generation", "plan", "code_explain",
    "intent", "memory_gate", "tool_args", "embed",
    "planner", "fast"
]

JSON_TASKS = {
    "scene_generation", "plan", "tool_args", "memory_gate", "intent", "fast"
}
_THINK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


@dataclass
class ModelResult:
    text: str
    provider: str
    model: str
    latency_ms: int
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    reasoning_trace: str | None = None


class ModelGateway:
    """Centralizes provider routing, resilience fallback chains, and NVIDIA thinking controls."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.provider = settings.llm_provider
        self.base_url, self.api_key = self._connection()
        self._reachability: dict[str, Any] = {"reachable": None, "checked_at": None}
        self._reachability_checked_monotonic: float | None = None

    def _connection(self) -> tuple[str, str | None]:
        if self.provider == "demo":
            return self.settings.nvidia_base_url, None
        return self.settings.active_base_url or "", self.settings.active_api_key

    def model_for(self, task: Task) -> str:
        if task in ("intent", "memory_gate", "tool_args", "fast"):
            model = self.settings.model_fast
        elif task == "embed":
            model = self.settings.model_embed
        else:
            model = self.settings.model_planner

        if not model:
            raise AppError("model_not_configured", f"Set model for task '{task}'.", 503)
        return model

    def fallback_chain_for(self, task: Task) -> list[str]:
        """Produce the ordered list of models to attempt for a given task."""
        primary = self.model_for(task)
        chain = [primary]

        if task in ("intent", "memory_gate", "tool_args", "fast"):
            for candidate in (self.settings.model_planner, self.settings.model_fallback):
                if candidate and candidate not in chain:
                    chain.append(candidate)
        elif task in JSON_TASKS:
            # Structured tasks do not fall back to the smaller emergency model.
            if self.settings.model_fallback and self.settings.model_fallback not in chain:
                chain.append(self.settings.model_fallback)
        else:
            # Lightning is only the final emergency model for non-JSON tasks.
            for candidate in (self.settings.model_fallback, self.settings.model_fast):
                if candidate and candidate not in chain:
                    chain.append(candidate)

        return chain

    @property
    def configured(self) -> bool:
        return self.provider == "demo" or bool(self.api_key)

    def _require_configured(self) -> None:
        if not self.configured:
            key = _KEY_NAMES.get(self.provider, "NVIDIA_API_KEY")
            raise AppError("provider_not_configured", f"Set {key} or select LLM_PROVIDER=demo.", 503)

    def _build_payload(self, model: str, messages: list[dict], task: Task, max_tokens: int, extra: dict | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.2,
        }

        if task in JSON_TASKS:
            payload["temperature"] = 0.2
            payload["chat_template_kwargs"] = {"enable_thinking": False}
        elif task in ("chat", "code_explain", "planner"):
            payload["temperature"] = 0.3
            # Conversational task: thinking allowed
            payload["chat_template_kwargs"] = {"enable_thinking": True}

        if extra:
            payload.update(extra)

        return payload

    async def _post_chat_attempt(self, client: httpx.AsyncClient, payload: dict[str, Any], headers: dict[str, str]) -> httpx.Response:
        url = f"{self.base_url.rstrip('/')}/chat/completions"
        response = await client.post(url, json=payload, headers=headers)
        if response.status_code == 429:
            # Back off once on rate limit
            log.warning("provider_rate_limited (429) on model=%s, backing off 1s...", payload.get("model"))
            await asyncio.sleep(1.0)
            response = await client.post(url, json=payload, headers=headers)
        return response

    async def complete(
        self, messages: list[dict], task: Task = "planner", max_tokens: int = 4096, extra: dict | None = None
    ) -> ModelResult:
        self._require_configured()
        models_to_try = self.fallback_chain_for(task)
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}

        last_error: Exception | None = None
        started = time.perf_counter()

        async with httpx.AsyncClient(timeout=self.settings.provider_timeout_s) as client:
            for model_candidate in models_to_try:
                payload = self._build_payload(model_candidate, messages, task, max_tokens, extra)
                try:
                    response = await self._post_chat_attempt(client, payload, headers)
                    if response.status_code in (401, 403):
                        raise AppError("provider_auth_failed", "The model provider rejected its API key. Check NVIDIA_API_KEY.", 502)
                    if response.status_code == 429:
                        log.warning("model_call_failed 429 model=%s", model_candidate)
                        last_error = AppError("provider_rate_limited", "The model provider is rate limiting requests. Try again shortly.", 502)
                        continue
                    if response.status_code == 404:
                        last_error = AppError("provider_model_not_found", f"Model {model_candidate} not found.", 502)
                        continue
                    if response.status_code >= 400:
                        log.warning("model_call_failed model=%s status=%d body=%s", model_candidate, response.status_code, response.text[:200])
                        last_error = AppError("provider_error", f"The model provider returned an error ({response.status_code}).", 502)
                        continue

                    body = response.json()
                    choice = body["choices"][0]
                    message = choice["message"]
                    raw_content = message.get("content")
                    if isinstance(raw_content, list):
                        raw_content = "".join(part.get("text", "") for part in raw_content if isinstance(part, dict))

                    reasoning_content = message.get("reasoning_content")
                    # If think tags were embedded in content, extract them
                    think_match = _THINK.search(raw_content or "")
                    if think_match and not reasoning_content:
                        reasoning_content = think_match.group(0)

                    content = _THINK.sub("", raw_content or "").strip()
                    usage = body.get("usage") or {}

                    if not content:
                        log.warning("empty_content from model=%s, trying next in fallback chain", model_candidate)
                        last_error = AppError("provider_empty_response", "The model returned no answer; reasoning may have used the token budget. Try again.", 502)
                        continue

                    latency = round((time.perf_counter() - started) * 1000)
                    result = ModelResult(
                        text=content or (reasoning_content or ""),
                        provider=self.provider,
                        model=model_candidate,
                        latency_ms=latency,
                        prompt_tokens=usage.get("prompt_tokens"),
                        completion_tokens=usage.get("completion_tokens"),
                        reasoning_trace=reasoning_content,
                    )
                    log.info(
                        "model.complete provider=%s model=%s task=%s latency_ms=%d prompt_tokens=%s completion_tokens=%s",
                        self.provider, model_candidate, task, latency, result.prompt_tokens, result.completion_tokens,
                    )
                    return result

                except httpx.HTTPError as exc:
                    log.warning("http_error on model=%s: %s", model_candidate, exc)
                    last_error = exc
                    continue
                except AppError as exc:
                    if exc.code == "provider_auth_failed":
                        raise
                    last_error = exc
                    continue

        log.error("all_models_failed chain=%s last_error=%s", models_to_try, last_error)
        raise AppError(
            "provider_unavailable",
            "AI service temporarily unavailable. Please try again shortly.",
            503,
        )

    async def stream_deltas(self, messages: list[dict], task: Task = "planner") -> AsyncIterator[tuple[str, str]]:
        """Stream a response, falling through the configured chain before exposing output."""
        self._require_configured()
        models_to_try = self.fallback_chain_for(task)
        last_error: AppError | None = None

        for model in models_to_try:
            for rate_attempt in range(2):
                emitted_output = False
                try:
                    async for kind, text in self._stream_model_deltas(messages, task, model):
                        if kind != "model":
                            emitted_output = True
                        yield kind, text
                    return
                except AppError as exc:
                    if exc.code == "provider_auth_failed":
                        raise
                    if emitted_output:
                        raise AppError(
                            "provider_unavailable",
                            "AI service temporarily unavailable. Please try again shortly.",
                            503,
                        ) from None
                    last_error = exc
                    if exc.code == "provider_rate_limited" and rate_attempt == 0:
                        log.warning("stream rate limited on model=%s, backing off 1s", model)
                        await asyncio.sleep(1.0)
                        continue
                    break

        log.error("all_stream_models_failed chain=%s last_error=%s", models_to_try, last_error)
        raise AppError(
            "provider_unavailable",
            "AI service temporarily unavailable. Please try again shortly.",
            503,
        )

    async def _stream_model_deltas(
        self, messages: list[dict], task: Task, model: str
    ) -> AsyncIterator[tuple[str, str]]:
        """Yield (kind, chunk) where kind is 'content' or 'reasoning'."""
        self._require_configured()
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}

        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": 0.2 if task in JSON_TASKS else 0.3,
            "max_tokens": 4096,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if task in JSON_TASKS:
            payload["chat_template_kwargs"] = {"enable_thinking": False}

        started = time.perf_counter()
        prompt_tokens = completion_tokens = None
        emitted_any = False

        think_buffer = ""
        inside_think = False

        try:
            async with httpx.AsyncClient(timeout=self.settings.provider_timeout_s) as client:
                async with client.stream(
                    "POST", f"{self.base_url.rstrip('/')}/chat/completions", json=payload, headers=headers
                ) as response:
                    if response.status_code == 429:
                        log.warning("stream rate limited (429) on model=%s", model)
                        raise AppError(
                            "provider_rate_limited",
                            "The model provider is rate limiting requests.",
                            502,
                        )
                    if response.status_code in (401, 403):
                        raise AppError("provider_auth_failed", "API key rejected.", 502)
                    if response.status_code >= 400:
                        raise AppError(
                            "provider_error",
                            f"The model provider returned an error ({response.status_code}).",
                            502,
                        )

                    yield ("model", model)
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            usage = chunk.get("usage") or {}
                            prompt_tokens = usage.get("prompt_tokens", prompt_tokens)
                            completion_tokens = usage.get("completion_tokens", completion_tokens)
                            choice = chunk.get("choices", [{}])[0]
                            delta = choice.get("delta", {})

                            # Handle explicit reasoning_content delta
                            reasoning_delta = delta.get("reasoning_content")
                            if reasoning_delta:
                                emitted_any = True
                                yield ("reasoning", reasoning_delta)

                            # Handle content delta
                            content_delta = delta.get("content")
                            if isinstance(content_delta, str) and content_delta:
                                think_buffer += content_delta
                                while think_buffer:
                                    lower = think_buffer.lower()
                                    if inside_think:
                                        end = lower.find("</think>")
                                        if end < 0:
                                            # Yield as reasoning
                                            yield ("reasoning", think_buffer[:-8] if len(think_buffer) > 8 else "")
                                            think_buffer = think_buffer[-8:]
                                            break
                                        reasoning_part = think_buffer[:end]
                                        think_buffer = think_buffer[end + len("</think>"):]
                                        inside_think = False
                                        if reasoning_part:
                                            yield ("reasoning", reasoning_part)
                                        continue
                                    start = lower.find("<think>")
                                    if start >= 0:
                                        visible = think_buffer[:start]
                                        think_buffer = think_buffer[start + len("<think>"):]
                                        inside_think = True
                                        if visible:
                                            emitted_any = True
                                            yield ("content", visible)
                                        continue
                                    safe = max(0, len(think_buffer) - len("<think>") + 1)
                                    if safe:
                                        visible, think_buffer = think_buffer[:safe], think_buffer[safe:]
                                        emitted_any = True
                                        yield ("content", visible)
                                    break
                        except (ValueError, KeyError, IndexError, TypeError):
                            continue

                    if not inside_think and think_buffer:
                        emitted_any = True
                        yield ("content", think_buffer)
        except httpx.HTTPError:
            raise AppError("provider_unreachable", "Could not reach the model provider.", 502) from None
        finally:
            log.info(
                "model.stream provider=%s model=%s task=%s latency_ms=%d prompt_tokens=%s completion_tokens=%s",
                self.provider, model, task, round((time.perf_counter() - started) * 1000), prompt_tokens, completion_tokens,
            )
        if not emitted_any:
            raise AppError("provider_empty_response", "The model returned no answer.", 502)

    async def stream(self, messages: list[dict], task: Task = "planner") -> AsyncIterator[str]:
        """Backward-compatible streamer that yields only visible content tokens."""
        async for kind, text in self.stream_deltas(messages, task=task):
            if kind == "content":
                yield text

    async def embed(self, texts: list[str], input_type: Literal["query", "passage"] = "passage") -> list[list[float]]:
        if not texts:
            return []
        if self.provider == "demo" or self.settings.mock_ai or self.settings.demo_mode:
            return await asyncio.to_thread(self._demo_embeddings, texts)

        if self.settings.model_embed and self.api_key:
            try:
                headers = {"Authorization": f"Bearer {self.api_key}"}
                payload: dict[str, Any] = {
                    "model": self.settings.model_embed,
                    "input": texts,
                    "input_type": input_type,
                }
                async with httpx.AsyncClient(timeout=self.settings.provider_timeout_s) as client:
                    response = await client.post(
                        f"{self.base_url.rstrip('/')}/embeddings", json=payload, headers=headers
                    )
                if response.status_code == 200:
                    data = response.json()
                    vectors = [row["embedding"] for row in data.get("data", [])]
                    if len(vectors) == len(texts) and all(len(v) == self.settings.embedding_dimension for v in vectors):
                        return vectors
                    log.warning("model.embedding_dimension_mismatch expected=%d got=%s", self.settings.embedding_dimension, len(vectors[0]) if vectors else 0)
                else:
                    log.warning("model.embedding_remote_failed status=%d body=%s", response.status_code, response.text[:150])
            except Exception as exc:
                log.warning("model.embedding_exception: %s", exc)

        return await asyncio.to_thread(self._demo_embeddings, texts)

    def _demo_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Deterministic fallback vectors of the exact configured dimension."""
        dimension = self.settings.embedding_dimension
        vectors = []
        for text in texts:
            raw = hashlib.shake_256(text.casefold().encode()).digest(dimension * 4)
            vector = [int.from_bytes(raw[i:i + 4], "big") / 2**31 - 1 for i in range(0, len(raw), 4)]
            norm = math.sqrt(sum(value * value for value in vector)) or 1.0
            vectors.append([value / norm for value in vector])
        return vectors

    async def check_reachability(self) -> dict[str, Any]:
        if self._reachability_checked_monotonic is not None and time.monotonic() - self._reachability_checked_monotonic < 30:
            return dict(self._reachability)
        if self.provider == "demo" or self.settings.mock_ai or self.settings.demo_mode:
            status = {"reachable": True, "checked_at": time.time(), "reason": "demo mode"}
        elif not self.api_key:
            status = {"reachable": False, "checked_at": time.time(), "reason": "provider key is not configured"}
        else:
            try:
                headers = {"Authorization": f"Bearer {self.api_key}"}
                async with httpx.AsyncClient(timeout=10) as client:
                    response = await client.get(f"{self.base_url.rstrip('/')}/models", headers=headers)
                if response.status_code == 200:
                    status = {"reachable": True, "checked_at": time.time()}
                else:
                    status = {"reachable": False, "checked_at": time.time(), "reason": f"HTTP {response.status_code}"}
            except Exception as exc:
                status = {"reachable": False, "checked_at": time.time(), "reason": str(exc)[:100]}
        self._reachability = status
        self._reachability_checked_monotonic = time.monotonic()
        return dict(status)

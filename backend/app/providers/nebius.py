"""Compatibility adapter for hosted model providers (NVIDIA and Nebius)."""

import httpx  # noqa: F401 -- existing tests patch this module's client

from app.config import Settings
from app.core.errors import AppError
from app.providers.base import ChatProvider, ProviderResult
from app.services.model_gateway import ModelGateway


class HostedProvider(ChatProvider):
    def __init__(self, settings: Settings, gateway: ModelGateway):
        self._gateway = gateway
        self.name = gateway.provider
        self.model = settings.model_planner or ""
        self.configured = gateway.configured

    async def complete(self, messages: list[dict], task: str = "chat") -> ProviderResult:
        result = await self._gateway.complete(messages, task=task)
        return ProviderResult(
            text=result.text,
            model=result.model,
            provider=result.provider,
            latency_ms=result.latency_ms,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            reasoning_trace=result.reasoning_trace,
        )


class NvidiaProvider(HostedProvider):
    """NVIDIA hosted API provider."""

    def __init__(self, settings: Settings):
        if not settings.nvidia_api_key:
            raise AppError("provider_not_configured", "Set NVIDIA_API_KEY.", 503)
        super().__init__(settings, ModelGateway(settings))


class NebiusProvider(HostedProvider):
    """Nebius Token Factory provider."""

    def __init__(self, settings: Settings):
        if not settings.nebius_api_key:
            raise AppError("provider_not_configured", "Set NEBIUS_API_KEY.", 503)
        super().__init__(settings, ModelGateway(settings))

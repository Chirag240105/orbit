"""Compatibility adapter retained for the current skill orchestrator."""

import httpx  # noqa: F401 -- existing mocked-provider tests patch this shared module client

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

    async def complete(self, messages: list[dict]) -> ProviderResult:
        result = await self._gateway.complete(messages, task="planner")
        return ProviderResult(
            text=result.text, model=result.model, provider=result.provider,
            latency_ms=result.latency_ms, prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
        )


class NebiusProvider(HostedProvider):
    """Legacy constructor kept for integrations that instantiate NebiusProvider directly."""

    def __init__(self, settings: Settings):
        if not settings.nebius_api_key:
            raise AppError("provider_not_configured", "Set NEBIUS_API_KEY.", 503)
        super().__init__(settings, ModelGateway(settings))

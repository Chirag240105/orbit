from app.config import Settings
from app.core.errors import AppError
from app.providers.base import ChatProvider, ProviderResult
from app.services.model_gateway import ModelGateway


class DemoProvider(ChatProvider):
    """Deterministic development provider. The orchestrator never calls complete(): skills render demo_output()."""

    name, model, is_demo, configured = "demo", "deterministic-demo", True, True

    async def complete(self, messages: list[dict]) -> ProviderResult:  # pragma: no cover
        raise AppError("demo_provider", "Demo provider does not perform model inference.", 500)


class UnconfiguredProvider(ChatProvider):
    configured = False

    def __init__(self, provider: str, model: str):
        self.name, self.model = provider, model

    async def complete(self, messages: list[dict]) -> ProviderResult:
        raise AppError(
            "provider_not_configured",
            "No model provider is configured. Set the selected provider API key (or LLM_PROVIDER=demo for a labeled demo).",
            503,
        )


def build_provider(settings: Settings, gateway: ModelGateway | None = None) -> ChatProvider:
    if settings.demo_mode or settings.mock_ai or settings.llm_provider == "demo":
        return DemoProvider()
    gateway = gateway or ModelGateway(settings)
    if gateway.configured:
        from app.providers.nebius import HostedProvider
        return HostedProvider(settings, gateway)
    return UnconfiguredProvider(settings.llm_provider, settings.model_planner or "")

from app.config import Settings
from app.core.errors import AppError
from app.providers.base import ChatProvider, ProviderResult


class DemoProvider(ChatProvider):
    """Deterministic development provider. The orchestrator never calls complete(): skills render demo_output()."""

    name, model, is_demo, configured = "demo", "deterministic-demo", True, True

    async def complete(self, messages: list[dict], *, max_tokens: int | None = None) -> ProviderResult:  # pragma: no cover
        raise AppError("demo_provider", "Demo provider does not perform model inference.", 500)


class UnconfiguredProvider(ChatProvider):
    name, model, configured = "none", "", False

    async def complete(self, messages: list[dict], *, max_tokens: int | None = None) -> ProviderResult:
        raise AppError(
            "provider_not_configured",
            "No model provider is configured. Set NEBIUS_API_KEY in .env (or ORBIT_DEMO_MODE=true for a labeled demo).",
            503,
        )


def build_provider(settings: Settings) -> ChatProvider:
    if settings.demo_mode:
        return DemoProvider()
    if settings.nebius_api_key:
        from app.providers.nebius import NebiusProvider
        return NebiusProvider(settings)
    return UnconfiguredProvider()

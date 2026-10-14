from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass


@dataclass
class ProviderResult:
    text: str
    model: str
    is_demo: bool = False


@dataclass
class StreamChunk:
    kind: str  # "token" (visible answer text) | "thinking" (the model started reasoning; no text is exposed)
    text: str = ""


class ChatProvider(ABC):
    """Anything that can complete a chat. Add a provider = subclass + register in providers/__init__.py."""

    name: str = "unknown"
    model: str = ""
    is_demo: bool = False
    configured: bool = False

    @abstractmethod
    async def complete(self, messages: list[dict], *, max_tokens: int | None = None) -> ProviderResult: ...

    async def stream(self, messages: list[dict], *, max_tokens: int | None = None) -> AsyncIterator[StreamChunk]:
        """Default: no incremental output, the whole answer arrives as one chunk."""
        result = await self.complete(messages, max_tokens=max_tokens)
        yield StreamChunk("token", result.text)

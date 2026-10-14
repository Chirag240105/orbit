from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ProviderResult:
    text: str
    model: str
    is_demo: bool = False


class ChatProvider(ABC):
    """Anything that can complete a chat. Add a provider = subclass + register in providers/__init__.py."""

    name: str = "unknown"
    model: str = ""
    is_demo: bool = False
    configured: bool = False

    @abstractmethod
    async def complete(self, messages: list[dict]) -> ProviderResult: ...

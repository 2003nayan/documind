"""Provider-agnostic LLM interface.

Text and vision are separate capabilities: a fallback text model is never
assumed to accept images.
"""

from dataclasses import dataclass, field
from typing import Protocol


class LLMError(Exception):
    pass


class QuotaExceededError(LLMError):
    pass


@dataclass
class ImagePart:
    data: bytes
    mime_type: str = "image/png"


@dataclass
class LLMRequest:
    system: str
    prompt: str
    images: list[ImagePart] = field(default_factory=list)
    json_output: bool = True
    temperature: float = 0.1


@dataclass
class LLMResponse:
    text: str
    provider: str
    model: str


class LLMProvider(Protocol):
    name: str
    model: str
    supports_vision: bool

    def generate(self, request: LLMRequest) -> LLMResponse: ...


class FallbackProvider:
    """Tries each provider in order; used where a single provider is expected (vision OCR)."""

    def __init__(self, providers: list[LLMProvider]) -> None:
        self.providers = providers
        self.name = providers[0].name
        self.model = providers[0].model
        self.supports_vision = all(p.supports_vision for p in providers)

    def generate(self, request: LLMRequest) -> LLMResponse:
        last: Exception | None = None
        for provider in self.providers:
            try:
                return provider.generate(request)
            except LLMError as exc:
                last = exc
        raise last or LLMError("No provider configured")

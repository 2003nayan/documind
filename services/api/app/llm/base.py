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

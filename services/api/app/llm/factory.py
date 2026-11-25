from app.config import Settings
from app.llm.base import LLMProvider
from app.llm.extractive import ExtractiveProvider


def build_providers(name: str | None, settings: Settings) -> list[LLMProvider]:
    """GEMINI_MODEL may list several models ("a,b"); each becomes a fallback step."""
    if name == "gemini":
        if not settings.gemini_api_key:
            raise ValueError("LLM_PROVIDER=gemini requires GEMINI_API_KEY")
        from app.llm.gemini import GeminiProvider

        models = [m.strip() for m in settings.gemini_model.split(",") if m.strip()]
        return [GeminiProvider(settings.gemini_api_key, m) for m in models]
    provider = build_provider(name, settings)
    return [provider] if provider else []


def build_provider(name: str | None, settings: Settings) -> LLMProvider | None:
    if not name:
        return None
    if name == "gemini":
        return build_providers(name, settings)[0]
    if name == "openrouter":
        if not settings.openrouter_api_key or not settings.openrouter_model:
            raise ValueError("LLM_PROVIDER=openrouter requires OPENROUTER_API_KEY and OPENROUTER_MODEL")
        from app.llm.openrouter import OpenRouterProvider

        return OpenRouterProvider(settings.openrouter_api_key, settings.openrouter_model)
    if name == "extractive":
        return ExtractiveProvider()
    raise ValueError(f"Unknown LLM provider: {name}")

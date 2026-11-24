from functools import lru_cache

from documind_core.config import CoreSettings


class Settings(CoreSettings):
    app_env: str = "development"

    llm_provider: str = "extractive"
    llm_fallback_provider: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    openrouter_api_key: str | None = None
    openrouter_model: str | None = None

    files_dir: str = "data/files"
    uploads_enabled: bool = True
    max_upload_mb: int = 10
    max_upload_pages: int = 20
    uploads_per_ip_per_day: int = 3
    chats_per_ip_per_day: int = 30
    chats_global_per_day: int = 400
    upload_ttl_hours: int = 24
    cors_origins: str = "http://localhost:3000"

    retrieval_limit: int = 8


@lru_cache
def get_settings() -> Settings:
    return Settings()

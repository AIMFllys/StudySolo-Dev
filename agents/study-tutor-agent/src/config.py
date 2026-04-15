from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    agent_name: str = "study-tutor"
    version: str = "0.1.0"
    model_id: str = "study-tutor-v1"
    api_key: str
    host: str = "127.0.0.1"
    port: int = 8004
    cors_allow_origins: str = "*"
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 60
    rate_limit_window_seconds: int = 60
    tutor_backend: Literal["heuristic", "upstream_reserved", "upstream_openai_compatible"] = "heuristic"
    tutor_model: str | None = None
    tutor_base_url: str | None = None
    tutor_api_key: str | None = None
    tutor_timeout_seconds: float = 30.0
    understanding_backend: Literal["heuristic", "openai_compatible"] = "heuristic"
    understanding_model: str | None = None
    understanding_base_url: str | None = None
    understanding_api_key: str | None = None
    understanding_timeout_seconds: float = 30.0

    model_config = SettingsConfigDict(
        env_prefix="AGENT_",
        env_file=ENV_FILE,
        extra="ignore",
    )

    @property
    def models(self) -> list[str]:
        return [self.model_id]

    @property
    def cors_origins(self) -> list[str]:
        raw = (self.cors_allow_origins or "").strip()
        if not raw:
            return []
        if raw == "*":
            return ["*"]
        return [item.strip() for item in raw.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

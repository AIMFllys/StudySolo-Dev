from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    agent_name: str = "deep-research-agent"
    version: str = "0.1.0"
    model_id: str = "research-agent"
    api_key: str = "research-agent-secret"
    host: str = "127.0.0.1"
    port: int = 8002
    storage_path: str = "./storage"

    model_config = SettingsConfigDict(
        env_prefix="AGENT_",
        env_file=".env",
        extra="ignore",
    )

    @property
    def models(self) -> list[str]:
        return [self.model_id]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

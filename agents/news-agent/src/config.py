from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    agent_name: str = "news-agent"
    version: str = "0.1.0"
    model_id: str = "last30days"
    api_key: str = "news-agent-secret"
    host: str = "127.0.0.1"
    port: int = 8004

    model_config = SettingsConfigDict(
        env_prefix="AGENT_",
        env_file=".env",
        extra="ignore",
    )

    @property
    def models(self) -> list[str]:
        return [f"{self.model_id}-quick", self.model_id, f"{self.model_id}-deep"]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

"""Application configuration loaded from environment variables via pydantic-settings."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str

    # Security
    jwt_secret: str
    captcha_secret: str = ""
    cors_origin: str = "http://localhost:2037"

    # Server
    port: int = 2038
    environment: str = "development"

    # AI platforms (optional — used by config_loader / ai_router)
    dashscope_api_key: str = ""
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    moonshot_api_key: str = ""
    moonshot_base_url: str = "https://api.moonshot.cn/v1"
    volcengine_api_key: str = ""
    volcengine_base_url: str = "https://ark.cn-beijing.volces.com/api/v3"
    zhipu_api_key: str = ""
    zhipu_base_url: str = "https://open.bigmodel.cn/api/paas/v4"
    qiniu_api_key: str = ""
    qiniu_ai_api_key: str = ""
    qiniu_base_url: str = "https://api.qnaigc.com/v1"
    youyun_api_key: str = ""
    youyun_base_url: str = "https://api.youyun.com/v1"
    siliconflow_api_key: str = ""
    siliconflow_base_url: str = "https://api.siliconflow.cn/v1"

    # Email (Aliyun DirectMail) — 与 Platform 共用 accounts@email.1037solo.com
    smtp_host: str = "smtpdm.aliyun.com"
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_pass: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()

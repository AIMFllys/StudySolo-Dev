"""Agent Gateway data models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AgentMeta(BaseModel):
    """Agent 注册元信息（从 agents.yaml 加载）."""

    name: str
    url: str
    timeout: int = 45
    max_retries: int = 2
    api_key_env: str = ""
    models: list[str] = Field(default_factory=list)
    enabled: bool = True
    description: str = ""
    owner: str = ""


class AgentCallResult(BaseModel):
    """单次 Agent 调用的结果."""

    status_code: int
    body: dict | None = None
    error: str | None = None
    duration_ms: int = 0
    request_id: str = ""

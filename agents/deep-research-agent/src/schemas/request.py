from typing import Literal

from pydantic import BaseModel, Field


class ResearchConfig(BaseModel):
    depth: Literal["quick", "standard", "deep"] = "standard"
    language: str = "zh-CN"
    max_sources: int = 15
    focus_areas: list[str] = Field(default_factory=list)


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatCompletionRequest(BaseModel):
    model: str | None = "research-agent"
    messages: list[ChatMessage] = Field(default_factory=list)
    stream: bool = True
    temperature: float | None = None
    max_tokens: int | None = None
    top_p: float | None = None
    frequency_penalty: float | None = None
    presence_penalty: float | None = None
    stop: str | list[str] | None = None
    format: Literal["default", "reasoning", "display"] = "default"
    research_config: ResearchConfig | None = None

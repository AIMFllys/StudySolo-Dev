"""Pydantic models for OpenAI-compatible API request/response."""

import time
import uuid
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field


# --- Request models ---

class ReasoningConfig(BaseModel):
    effort: Literal["low", "medium", "high"] = "medium"
    summary: Literal["auto", "concise", "detailed"] = "auto"


class RequestMetadata(BaseModel):
    days: int = Field(default=30, ge=1, le=30)
    sources: str = "all"
    include_web: bool = False
    x_handle: Optional[str] = None


class CreateResponseRequest(BaseModel):
    model: str = "last30days"
    input: Union[str, List[Dict[str, Any]]]
    stream: bool = False
    background: bool = False
    instructions: Optional[str] = None
    reasoning: Optional[ReasoningConfig] = None
    metadata: Optional[RequestMetadata] = None

    def get_topic(self) -> str:
        """Extract topic string from input (string or message array)."""
        if isinstance(self.input, str):
            return self.input
        # OpenAI message array format
        for msg in self.input:
            if msg.get("role") == "user":
                content = msg.get("content", "")
                if isinstance(content, str):
                    return content
                if isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict) and part.get("type") == "input_text":
                            return part.get("text", "")
        return ""

    def get_depth(self) -> str:
        """Map model name to depth parameter."""
        if self.model.endswith("-quick"):
            return "quick"
        elif self.model.endswith("-deep"):
            return "deep"
        return "default"

    def get_output_mode(self) -> str:
        """Determine output mode from request parameters."""
        if self.stream and self.reasoning:
            return "reasoning"  # Mode 3
        if not self.stream and self.background:
            return "background"  # Mode 2
        if self.stream:
            return "streaming"  # Mode 1
        return "sync"  # Synchronous (quick only)


# --- Response models ---

def gen_id(prefix: str = "resp") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:24]}"


class OutputTextContent(BaseModel):
    type: str = "output_text"
    text: str = ""
    annotations: list = Field(default_factory=list)


class OutputMessage(BaseModel):
    id: str = Field(default_factory=lambda: gen_id("msg"))
    type: str = "message"
    role: str = "assistant"
    status: str = "completed"
    content: List[OutputTextContent] = Field(default_factory=list)


class UsageInfo(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


class ResponseObject(BaseModel):
    id: str = Field(default_factory=lambda: gen_id("resp"))
    object: str = "response"
    created_at: int = Field(default_factory=lambda: int(time.time()))
    status: str = "completed"
    model: str = "last30days"
    output: List[OutputMessage] = Field(default_factory=list)
    usage: Optional[UsageInfo] = None
    metadata: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, str]] = None

    @classmethod
    def from_report(cls, report, model: str = "last30days") -> "ResponseObject":
        """Build a ResponseObject from a schema.Report."""
        from lib import render
        text = render.render_compact(report)
        msg = OutputMessage(content=[OutputTextContent(text=text)])
        usage = UsageInfo(output_tokens=len(text), total_tokens=len(text))
        return cls(model=model, output=[msg], usage=usage)

    @classmethod
    def queued(cls, model: str = "last30days") -> "ResponseObject":
        return cls(status="queued", model=model)

    @classmethod
    def error_response(cls, message: str, code: str = "internal_error") -> "ResponseObject":
        return cls(status="failed", error={"message": message, "code": code})


class ModelInfo(BaseModel):
    id: str
    object: str = "model"
    owned_by: str = "newsagents"
    description: str = ""


class ModelList(BaseModel):
    object: str = "list"
    data: List[ModelInfo] = Field(default_factory=list)


AVAILABLE_MODELS = ModelList(data=[
    ModelInfo(id="last30days-quick", description="快速研究，8-12 源/类，1-2 分钟"),
    ModelInfo(id="last30days", description="平衡研究，20-30 源/类，2-5 分钟"),
    ModelInfo(id="last30days-deep", description="深度研究，50-70 源/类，5-8 分钟"),
])

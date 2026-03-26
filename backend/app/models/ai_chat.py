"""AI Chat request/response Pydantic models."""

from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Canvas Context (前端序列化的画布快照) ─────────────────────────────

class NodeSummarySchema(BaseModel):
    """单个节点的 AI 可读摘要."""
    id: str
    index: int
    label: str
    type: str
    status: str = "pending"
    has_output: bool = False
    output_preview: str = ""
    upstream_labels: list[str] = Field(default_factory=list)
    downstream_labels: list[str] = Field(default_factory=list)
    position: dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})


class CanvasContextSchema(BaseModel):
    """画布上下文快照 — 前端在每次请求时附带."""
    workflow_id: str | None = None
    workflow_name: str = ""
    nodes: list[NodeSummarySchema] = Field(default_factory=list)
    dag_description: str = ""
    selected_node_id: str | None = None
    execution_status: str | None = None


# ── Chat Messages ────────────────────────────────────────────────────

class ChatMessageSchema(BaseModel):
    """单条对话消息."""
    role: Literal["user", "assistant"]
    content: str
    timestamp: int = 0


# ── Request ──────────────────────────────────────────────────────────

class AIChatRequest(BaseModel):
    """统一 AI 对话请求."""
    user_input: str = Field(..., min_length=1, max_length=4000)
    canvas_context: CanvasContextSchema | None = None
    conversation_history: list[ChatMessageSchema] = Field(
        default_factory=list, max_length=20,
    )
    intent_hint: str | None = None
    selected_model_key: str | None = None
    selected_model: str | None = None
    selected_platform: str | None = None
    thinking_level: Literal["fast", "balanced", "deep"] = "balanced"
    mode: Literal["plan", "chat", "create"] = "chat"


# ── Canvas Action ────────────────────────────────────────────────────

class CanvasAction(BaseModel):
    """画布操作指令 — 前端 ActionExecutor 解释执行."""
    operation: str
    target_node_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


# ── Response ─────────────────────────────────────────────────────────

class AIChatResponse(BaseModel):
    """统一 AI 对话响应."""
    intent: str
    response: str
    actions: list[CanvasAction] | None = None
    model_used: str = ""
    platform_used: str = ""

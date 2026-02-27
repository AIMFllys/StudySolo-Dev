"""AI request/response Pydantic models and node type definitions."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ── Node type enum ───────────────────────────────────────────────────────────

class NodeType(str, Enum):
    trigger_input = "trigger_input"
    ai_analyzer = "ai_analyzer"
    ai_planner = "ai_planner"
    outline_gen = "outline_gen"
    content_extract = "content_extract"
    summary = "summary"
    flashcard = "flashcard"
    chat_response = "chat_response"
    write_db = "write_db"


# LLM node types (require system prompts)
LLM_NODE_TYPES = {
    NodeType.ai_analyzer,
    NodeType.ai_planner,
    NodeType.outline_gen,
    NodeType.content_extract,
    NodeType.summary,
    NodeType.flashcard,
    NodeType.chat_response,
}

# Non-LLM node types
NON_LLM_NODE_TYPES = {
    NodeType.trigger_input,
    NodeType.write_db,
}


# ── System Prompt templates ──────────────────────────────────────────────────

SYSTEM_PROMPTS: dict[NodeType, str] = {
    NodeType.ai_analyzer: (
        "你是一个学习需求分析专家。用户会给你一个学习目标，你需要将其解析为结构化的需求 JSON。\n"
        "输出必须是严格的 JSON 格式，包含以下字段：\n"
        "- goal: string（核心学习目标）\n"
        "- user_defined_steps: string[]（用户明确提到的步骤，可为空数组）\n"
        "- design_requirements: string[]（设计要求）\n"
        "- constraints: object（约束条件，如 max_steps、mode）\n"
        "- extras: object（其他补充信息）\n"
        "不要输出任何 JSON 以外的内容。"
    ),
    NodeType.ai_planner: (
        "你是一个学习工作流规划专家。你会收到结构化的学习需求 JSON，需要生成工作流节点和连线。\n"
        "输出必须是严格的 JSON 格式，包含：\n"
        "- nodes: 节点数组，每个节点包含 id、type、position({x,y})、data({label,system_prompt,model_route,status,output})\n"
        "- edges: 连线数组，每条连线包含 id、source、target\n"
        "节点类型只能是：outline_gen、content_extract、summary、flashcard、chat_response、write_db\n"
        "最多生成 8 个节点。不要输出任何 JSON 以外的内容。"
    ),
    NodeType.outline_gen: (
        "你是一个知识大纲生成专家。根据学习目标和暗线上下文，生成清晰的学习大纲。\n"
        "输出格式为 Markdown，包含层级标题和要点。"
    ),
    NodeType.content_extract: (
        "你是一个知识提炼专家。根据学习大纲和暗线上下文，提炼核心知识点。\n"
        "输出格式为 Markdown，每个知识点包含定义、示例和应用场景。"
    ),
    NodeType.summary: (
        "你是一个总结归纳专家。根据已提炼的知识点和暗线上下文，生成简洁的学习总结。\n"
        "输出格式为 Markdown，包含核心要点和关键结论。"
    ),
    NodeType.flashcard: (
        "你是一个闪卡生成专家。根据知识点和暗线上下文，生成适合记忆的问答闪卡。\n"
        "输出格式为 JSON 数组，每张卡片包含 question 和 answer 字段。"
    ),
    NodeType.chat_response: (
        "你是一个学习助手。根据用户的学习进度和暗线上下文，提供个性化的学习建议和回复。\n"
        "输出格式为 Markdown，语气友好、鼓励性强。"
    ),
}


# ── AI request/response models ───────────────────────────────────────────────

class GenerateWorkflowRequest(BaseModel):
    user_input: str = Field(..., min_length=1, max_length=2000, description="用户自然语言学习目标")


class AnalyzerOutput(BaseModel):
    goal: str
    user_defined_steps: list[str] = Field(default_factory=list)
    design_requirements: list[str] = Field(default_factory=list)
    constraints: dict[str, Any] = Field(default_factory=dict)
    extras: dict[str, Any] = Field(default_factory=dict)


class NodePosition(BaseModel):
    x: float
    y: float


class NodeData(BaseModel):
    label: str
    system_prompt: str = ""
    model_route: str = ""
    status: str = "pending"
    output: str = ""


class WorkflowNodeSchema(BaseModel):
    id: str
    type: str
    position: NodePosition
    data: NodeData


class WorkflowEdgeSchema(BaseModel):
    id: str
    source: str
    target: str


class ImplicitContext(BaseModel):
    global_theme: str
    language_style: str
    core_outline: list[str] = Field(default_factory=list)
    target_audience: str
    user_constraints: dict[str, Any] = Field(default_factory=dict)


class PlannerOutput(BaseModel):
    nodes: list[WorkflowNodeSchema]
    edges: list[WorkflowEdgeSchema]


class GenerateWorkflowResponse(BaseModel):
    nodes: list[WorkflowNodeSchema]
    edges: list[WorkflowEdgeSchema]
    implicit_context: ImplicitContext

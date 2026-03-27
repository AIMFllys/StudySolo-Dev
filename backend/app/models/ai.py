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
    compare = "compare"
    mind_map = "mind_map"
    quiz_gen = "quiz_gen"
    merge_polish = "merge_polish"
    knowledge_base = "knowledge_base"
    web_search = "web_search"
    export_file = "export_file"
    write_db = "write_db"
    logic_switch = "logic_switch"
    loop_map = "loop_map"


# LLM node types (require system prompts)
LLM_NODE_TYPES = {
    NodeType.ai_analyzer,
    NodeType.ai_planner,
    NodeType.outline_gen,
    NodeType.content_extract,
    NodeType.summary,
    NodeType.flashcard,
    NodeType.chat_response,
    NodeType.compare,
    NodeType.mind_map,
    NodeType.quiz_gen,
    NodeType.merge_polish,
}

# Non-LLM node types
NON_LLM_NODE_TYPES = {
    NodeType.trigger_input,
    NodeType.write_db,
    NodeType.knowledge_base,
    NodeType.web_search,
    NodeType.export_file,
    NodeType.logic_switch,
    NodeType.loop_map,
}


# NOTE: SYSTEM_PROMPTS dict has been removed.
# All node prompts now live in nodes/*/prompt.md files and are assembled
# via BaseNode.system_prompt (identity + base rules + node prompt).
# For BUILD path access, use: BaseNode.get_system_prompt_for_type(node_type)


# ── AI request/response models ───────────────────────────────────────────────

class GenerateWorkflowRequest(BaseModel):
    user_input: str = Field(..., min_length=1, max_length=2000, description="用户自然语言学习目标")


class InputSources(BaseModel):
    """Analyzer's judgment on which input source nodes are needed."""
    need_knowledge_base: bool = False
    need_web_search: bool = False
    reasoning: str = ""


class AnalyzerOutput(BaseModel):
    goal: str
    user_defined_steps: list[str] = Field(default_factory=list)
    design_requirements: list[str] = Field(default_factory=list)
    constraints: dict[str, Any] = Field(default_factory=dict)
    extras: dict[str, Any] = Field(default_factory=dict)
    input_sources: InputSources = Field(default_factory=InputSources)


class NodePosition(BaseModel):
    x: float
    y: float


class NodeData(BaseModel):
    label: str
    type: str = ""
    system_prompt: str = ""
    model_route: str = ""
    status: str = "pending"
    output: str = ""
    user_content: str = ""  # Full user input for trigger_input; used by execution engine
    config: dict[str, Any] = Field(default_factory=dict)


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

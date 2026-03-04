"""Base class for all workflow nodes.

Every node type inherits from BaseNode and is automatically registered
via __init_subclass__. The engine discovers nodes through NODE_REGISTRY
without any hardcoded imports or if/else chains.

Architecture inspired by:
- Dify:  api/core/workflow/nodes/base/node.py
- n8n:   INodeType interface
- Mini Claude Code: tools/index.ts  TOOLS registry
"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, AsyncIterator, ClassVar

from pydantic import BaseModel, Field


# ── Standard I/O models ──────────────────────────────────────────────────────

class NodeInput(BaseModel):
    """Standard input passed to every node's execute()."""
    user_content: str = ""
    upstream_outputs: dict[str, str] = Field(default_factory=dict)
    implicit_context: dict[str, Any] | None = None
    node_config: dict[str, Any] | None = None  # 节点配置参数（如 quiz_gen: {types, count, difficulty}）


class NodeOutput(BaseModel):
    """Standard output returned from every node's post_process()."""
    content: str = ""
    format: str = "markdown"
    metadata: dict[str, Any] = Field(default_factory=dict)


# ── Abstract base ────────────────────────────────────────────────────────────

class BaseNode(ABC):
    """Abstract base class — one subclass per node type.

    Subclasses only need to:
    1. Set class variables: node_type, category, description, etc.
    2. Implement execute()
    3. Optionally override post_process() and build_user_message()
    """

    # ── Auto-registration via __init_subclass__ ──────────────────────────────
    _registry: ClassVar[dict[str, type["BaseNode"]]] = {}

    def __init_subclass__(cls, **kwargs):
        """Called automatically when any class inherits BaseNode.

        If the subclass defines a non-empty `node_type`, it is registered
        into _registry.  This means: define a class → it is discoverable.
        """
        super().__init_subclass__(**kwargs)
        node_type = getattr(cls, "node_type", "")
        if node_type and not getattr(cls, "_abstract", False):
            BaseNode._registry[node_type] = cls

    # ── Class-level metadata (subclasses MUST set these) ─────────────────────
    node_type: ClassVar[str] = ""
    category: ClassVar[str] = ""            # "input" | "analysis" | "generation" | "interaction" | "output"
    description: ClassVar[str] = ""
    is_llm_node: ClassVar[bool] = True
    output_format: ClassVar[str] = "markdown"   # "markdown" | "json" | "passthrough"
    icon: ClassVar[str] = "⚙️"
    color: ClassVar[str] = "#6366f1"

    # ── System prompt (auto-loaded from prompt.md next to node.py) ───────────

    @property
    def system_prompt(self) -> str:
        """Load system prompt from prompt.md in the same directory as node.py."""
        node_file = Path(self.__class__.__module__.replace(".", "/") + ".py")
        prompt_file = node_file.parent / "prompt.md"
        if prompt_file.exists():
            return prompt_file.read_text(encoding="utf-8").strip()
        return ""

    # ── Core execution (subclasses MUST implement) ───────────────────────────

    @abstractmethod
    async def execute(
        self,
        node_input: NodeInput,
        llm_caller: Any,
    ) -> AsyncIterator[str]:
        """Execute this node's logic, yielding streamed tokens.

        For LLM nodes: build messages → call llm_caller → yield tokens.
        For non-LLM nodes: perform side effects → yield result.
        """
        ...

    # ── Output post-processing (optional override) ───────────────────────────

    async def post_process(self, raw_output: str) -> NodeOutput:
        """Validate / transform the raw LLM output.

        Default: pass through unchanged as markdown.
        Override in flashcard/analyzer nodes to enforce JSON schema.
        """
        return NodeOutput(content=raw_output, format=self.output_format)

    # ── Input message builder (optional override) ────────────────────────────

    def build_user_message(self, node_input: NodeInput) -> str:
        """Build the user-role message from upstream outputs + current task.

        Default: concatenate direct upstream outputs + current label.
        Override to customize context injection strategy.
        """
        parts: list[str] = []
        if node_input.upstream_outputs:
            upstream_text = "\n\n".join(
                f"[{nid}]: {out}"
                for nid, out in node_input.upstream_outputs.items()
                if out
            )
            parts.append(f"前序节点输出：\n{upstream_text}")
        if node_input.user_content:
            parts.append(f"当前任务：{node_input.user_content}")
        return "\n\n".join(parts)

    # ── Context prompt builder ───────────────────────────────────────────────

    def build_context_prompt(self, implicit_context: dict | None) -> str:
        """Build the implicit context injection string."""
        if not implicit_context:
            return ""
        import json
        return (
            "\n\n---\n暗线上下文（请保持输出风格与以下上下文一致）：\n"
            + json.dumps(implicit_context, ensure_ascii=False, indent=2)
            + "\n---"
        )

    # ── Registry helpers ─────────────────────────────────────────────────────

    @classmethod
    def get_registry(cls) -> dict[str, type["BaseNode"]]:
        """Return a copy of all registered node types."""
        return dict(cls._registry)

    @classmethod
    def get_node_class(cls, node_type: str) -> type["BaseNode"] | None:
        """Look up a node class by its type string."""
        return cls._registry.get(node_type)

    @classmethod
    def get_manifest(cls) -> list[dict[str, Any]]:
        """Return metadata for all registered nodes (consumed by frontend)."""
        return [
            {
                "type": nc.node_type,
                "category": nc.category,
                "description": nc.description,
                "is_llm_node": nc.is_llm_node,
                "output_format": nc.output_format,
                "icon": nc.icon,
                "color": nc.color,
            }
            for nc in cls._registry.values()
        ]

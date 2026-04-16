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
from functools import lru_cache
from pathlib import Path
from typing import Any, AsyncIterator, ClassVar

from pydantic import BaseModel, Field


# ── Shared prompt fragment loader (cached per process) ───────────────────────

_NODES_DIR = Path(__file__).parent
_PROMPTS_DIR = _NODES_DIR.parent / "prompts"


@lru_cache(maxsize=1)
def _load_identity_prompt() -> str:
    """Load identity.md from the prompts/ directory (cached)."""
    path = _PROMPTS_DIR / "identity.md"
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return ""


@lru_cache(maxsize=1)
def _load_base_prompt() -> str:
    """Load _base_prompt.md from the nodes/ directory (cached)."""
    path = _NODES_DIR / "_base_prompt.md"
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return ""


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
    display_name: ClassVar[str] = ""
    description: ClassVar[str] = ""
    is_llm_node: ClassVar[bool] = True
    output_format: ClassVar[str] = "markdown"   # "markdown" | "json" | "passthrough"
    icon: ClassVar[str] = "⚙️"
    color: ClassVar[str] = "#6366f1"
    config_schema: ClassVar[list[dict[str, Any]]] = []
    output_capabilities: ClassVar[list[str]] = []
    supports_upload: ClassVar[bool] = False
    supports_preview: ClassVar[bool] = True
    deprecated_surface: ClassVar[str | None] = None
    renderer: ClassVar[str | None] = None
    version: ClassVar[str] = "1.0.0"
    changelog: ClassVar[dict[str, str] | None] = None
    model_source: ClassVar[str | None] = None
    agent_name: ClassVar[str | None] = None

    # ── System prompt (unified three-segment assembly) ─────────────────────────

    @property
    def system_prompt(self) -> str:
        """Assemble: identity + base rules + node-specific prompt.

        Segments:
        1. identity.md  — platform identity, safety rules
        2. _base_prompt.md — universal execution discipline
        3. prompt.md — node-specific instructions (next to node.py)
        """
        node_prompt = self._load_node_prompt()
        return self._assemble_prompt(node_prompt)

    @staticmethod
    def _assemble_prompt(node_prompt: str) -> str:
        """Join non-empty segments with double newlines."""
        segments = [
            _load_identity_prompt(),
            _load_base_prompt(),
            node_prompt,
        ]
        return "\n\n".join(s for s in segments if s)

    def _load_node_prompt(self) -> str:
        """Load prompt.md from the same directory as the concrete node.py."""
        node_file = Path(self.__class__.__module__.replace(".", "/") + ".py")
        prompt_file = node_file.parent / "prompt.md"
        if prompt_file.exists():
            return prompt_file.read_text(encoding="utf-8").strip()
        return ""

    @classmethod
    def get_system_prompt_for_type(cls, node_type: str) -> str:
        """Get the unified system prompt by node type string.

        Used by api/ai.py BUILD path to replace SYSTEM_PROMPTS dict lookups.
        Falls back to empty string if the node type is not registered.
        """
        node_class = cls._registry.get(node_type)
        if not node_class:
            return ""
        instance = node_class()
        return instance.system_prompt

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
        if node_input.node_config:
            import json
            parts.append(
                "节点配置（如与默认行为冲突，优先遵守这些参数）：\n"
                + json.dumps(node_input.node_config, ensure_ascii=False, indent=2)
            )
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
    def is_manifest_available(cls) -> bool:
        """Allow subclasses to hide themselves from the manifest."""
        return True

    @classmethod
    def get_manifest(cls) -> list[dict[str, Any]]:
        """Return metadata for all registered nodes (consumed by frontend)."""
        manifest: list[dict[str, Any]] = []
        for _, nc in sorted(cls._registry.items(), key=lambda item: item[0]):
            if not nc.is_manifest_available():
                continue
            model_source = nc.model_source or ("catalog" if nc.is_llm_node else "none")
            manifest.append({
                "type": nc.node_type,
                "category": nc.category,
                "display_name": nc.display_name,
                "description": nc.description,
                "is_llm_node": nc.is_llm_node,
                "output_format": nc.output_format,
                "icon": nc.icon,
                "color": nc.color,
                "config_schema": nc.config_schema,
                "output_capabilities": nc.output_capabilities,
                "supports_upload": nc.supports_upload,
                "supports_preview": nc.supports_preview,
                "deprecated_surface": nc.deprecated_surface,
                "renderer": nc.renderer,
                "version": nc.version,
                "changelog": nc.changelog,
                "model_source": model_source,
                "agent_name": nc.agent_name,
            })
        return manifest

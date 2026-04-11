"""LogicSwitch node — conditional branching within a workflow.

This is an LLM node that decides which branch to take based on
the upstream content and a set of user-defined conditions.

The node outputs a JSON object with:
- branch: the chosen branch identifier (e.g., "A", "B", "default")
- reason: explanation of why this branch was chosen

The executor reads the `branch` field from the output and only
executes downstream nodes that match the chosen branch via edge labels.

Edge labeling convention:
  - Edges from logic_switch should have a `data.branch` field
  - e.g., {"source": "switch1", "target": "nodeA", "data": {"branch": "A"}}
  - The default branch (unlabeled edges) always executes as fallback
"""

import json
import logging
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput, NodeOutput
from app.nodes._mixins import LLMStreamMixin, JsonOutputMixin

logger = logging.getLogger(__name__)


class LogicSwitchNode(BaseNode, LLMStreamMixin, JsonOutputMixin):
    node_type = "logic_switch"
    category = "analysis"
    display_name = "逻辑分支"
    description = "根据条件判断选择执行分支"
    is_llm_node = True
    output_format = "json"
    icon = "🔀"
    color = "#f59e0b"
    config_schema = [
        {
            "key": "branch_options",
            "type": "textarea",
            "label": "候选分支",
            "default": "A: 满足主条件\nB: 走备选方案\ndefault: 兜底路径",
            "description": "用多行文本描述可选分支与命名。",
        },
        {
            "key": "default_branch",
            "type": "text",
            "label": "默认分支",
            "default": "default",
            "description": "模型无法明确判断时使用的兜底分支名。",
        },
    ]
    output_capabilities = ["preview", "compact"]

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        """Ask LLM to decide which branch to take."""
        async for token in self.call_llm_stream(node_input, llm_caller):
            yield token

    async def post_process(self, raw_output: str) -> NodeOutput:
        """Parse the branch decision from LLM output.

        Expected JSON: {"branch": "A", "reason": "..."}
        If parsing fails, defaults to branch "default".
        """
        parsed = self.try_parse_json(raw_output)

        if parsed and isinstance(parsed, dict):
            branch = parsed.get("branch", "default")
            reason = parsed.get("reason", "")
            return NodeOutput(
                content=json.dumps(parsed, ensure_ascii=False),
                format="json",
                metadata={
                    "source": "logic_switch",
                    "branch": str(branch),
                    "reason": reason,
                },
            )

        # Fallback: try to extract branch from plain text
        branch = "default"
        lower = raw_output.lower().strip()
        if lower.startswith("a") or "分支a" in lower or "branch a" in lower:
            branch = "A"
        elif lower.startswith("b") or "分支b" in lower or "branch b" in lower:
            branch = "B"

        return NodeOutput(
            content=json.dumps({"branch": branch, "reason": raw_output}, ensure_ascii=False),
            format="json",
            metadata={
                "source": "logic_switch",
                "branch": branch,
                "reason": raw_output,
            },
        )

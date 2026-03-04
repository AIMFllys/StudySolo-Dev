"""MindMap node — generates hierarchical mind map data for knowledge visualization.

This is a '专一型' (single-purpose) node that takes upstream knowledge and
produces a structured JSON tree for mind map visualization.
The output is rendered by MindMapRenderer on the frontend as a collapsible tree.
"""

import json
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput, NodeOutput
from app.nodes._mixins import LLMStreamMixin, JsonOutputMixin


class MindMapNode(BaseNode, LLMStreamMixin, JsonOutputMixin):
    node_type = "mind_map"
    category = "generation"
    description = "知识结构可视化思维导图"
    is_llm_node = True
    output_format = "json"
    icon = "🧠"
    color = "#10b981"

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        system = self.system_prompt + self.build_context_prompt(node_input.implicit_context)
        user_msg = self.build_user_message(node_input)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ]
        async for token in self.stream_llm(messages, llm_caller):
            yield token

    async def post_process(self, raw_output: str) -> NodeOutput:
        """Validate mind map output as JSON tree structure."""
        try:
            parsed = await self.validate_json(raw_output)
            # Ensure required fields exist
            if isinstance(parsed, dict):
                if "root" not in parsed:
                    parsed["root"] = "知识导图"
                if "children" not in parsed:
                    parsed["children"] = []

            # Count total nodes for metadata
            def count_nodes(node: dict) -> int:
                count = 1
                for child in node.get("children", []):
                    count += count_nodes(child)
                return count

            total = count_nodes(parsed) if isinstance(parsed, dict) else 0

            return NodeOutput(
                content=json.dumps(parsed, ensure_ascii=False, indent=2),
                format="json",
                metadata={"total_nodes": total},
            )
        except ValueError:
            # Fallback: return as markdown
            return NodeOutput(content=raw_output, format="markdown")

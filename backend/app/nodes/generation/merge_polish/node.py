"""MergePolish node — merges and polishes multiple upstream outputs into coherent text.

This is a '专一型' (single-purpose) node that takes multiple parallel upstream
outputs and combines them into a single, well-structured, coherent long-form text.
It removes duplication, unifies writing style, and ensures smooth transitions.
"""

from typing import Any, AsyncIterator
from app.nodes._base import BaseNode, NodeInput
from app.nodes._mixins import LLMStreamMixin


class MergePolishNode(BaseNode, LLMStreamMixin):
    node_type = "merge_polish"
    category = "generation"
    description = "将多个上游输出润色合并为连贯长文"
    is_llm_node = True
    output_format = "markdown"
    icon = "✏️"
    color = "#8b5cf6"

    def build_user_message(self, node_input: NodeInput) -> str:
        """Override: emphasize that we're merging multiple upstream outputs."""
        parts: list[str] = []
        if node_input.upstream_outputs:
            parts.append("以下是需要合并润色的多段内容：\n")
            for i, (nid, out) in enumerate(node_input.upstream_outputs.items(), 1):
                parts.append(f"--- 第 {i} 部分（来自 {nid}）---\n{out}\n")
        if node_input.user_content:
            parts.append(f"\n润色要求：{node_input.user_content}")
        return "\n".join(parts)

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        system = self.system_prompt + self.build_context_prompt(node_input.implicit_context)
        user_msg = self.build_user_message(node_input)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ]
        async for token in self.stream_llm(messages, llm_caller):
            yield token

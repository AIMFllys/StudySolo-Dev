"""Compare node — generates multi-concept, multi-dimension comparison tables.

This is a '专一型' (single-purpose) node that takes upstream knowledge and
produces a structured JSON comparison across multiple concepts and dimensions.
The output is rendered by CompareRenderer on the frontend as a beautiful table.
"""

import json
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput, NodeOutput
from app.nodes._mixins import LLMStreamMixin, JsonOutputMixin


class CompareNode(BaseNode, LLMStreamMixin, JsonOutputMixin):
    node_type = "compare"
    category = "generation"
    description = "多概念多维度结构化对比辨析"
    is_llm_node = True
    output_format = "json"
    icon = "⚖️"
    color = "#06b6d4"

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
        """Validate comparison output as JSON with concepts/dimensions structure."""
        try:
            parsed = await self.validate_json(raw_output)
            # Ensure required fields exist
            if isinstance(parsed, dict):
                if "concepts" not in parsed:
                    parsed["concepts"] = []
                if "dimensions" not in parsed:
                    parsed["dimensions"] = []
            return NodeOutput(
                content=json.dumps(parsed, ensure_ascii=False, indent=2),
                format="json",
                metadata={
                    "concept_count": len(parsed.get("concepts", [])),
                    "dimension_count": len(parsed.get("dimensions", [])),
                },
            )
        except ValueError:
            # Fallback: return as markdown
            return NodeOutput(content=raw_output, format="markdown")

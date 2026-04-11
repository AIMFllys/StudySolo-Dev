"""LoopMap node — splits input into items and processes each one.

This is an LLM node that takes upstream content and splits it into
a structured array of items. Each item can then be processed by
downstream nodes (the executor handles the iteration).

The node outputs a JSON array of items. The executor will:
1. Parse the array from the output
2. For each item, set it as the upstream_output for downstream nodes
3. Execute downstream nodes once per item
4. Aggregate results

Output format:
[
  {"item": "...", "label": "..."},
  {"item": "...", "label": "..."},
  ...
]
"""

import json
import logging
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput, NodeOutput
from app.nodes._mixins import LLMStreamMixin, JsonOutputMixin

logger = logging.getLogger(__name__)


class LoopMapNode(BaseNode, LLMStreamMixin, JsonOutputMixin):
    node_type = "loop_map"
    category = "analysis"
    display_name = "循环映射"
    description = "将内容拆分为多项，逐项处理"
    is_llm_node = True
    output_format = "json"
    icon = "🔄"
    color = "#8b5cf6"
    config_schema = [
        {
            "key": "item_hint",
            "type": "text",
            "label": "拆分提示",
            "default": "",
            "description": "告诉模型按什么粒度拆分列表项。",
        },
        {
            "key": "max_items",
            "type": "number",
            "label": "最多项数",
            "default": 8,
            "min": 1,
            "max": 20,
            "step": 1,
            "description": "限制一次循环拆分出的项目数量。",
        },
    ]
    output_capabilities = ["preview", "compact"]

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        """Ask LLM to split content into processable items."""
        async for token in self.call_llm_stream(node_input, llm_caller):
            yield token

    async def post_process(self, raw_output: str) -> NodeOutput:
        """Parse the item list from LLM output.

        Expected JSON: [{"item": "...", "label": "..."}, ...]
        If parsing fails, wraps entire output as a single item.
        """
        parsed = self.try_parse_json(raw_output)

        if parsed and isinstance(parsed, list):
            # Normalize items
            items = []
            for i, item in enumerate(parsed):
                if isinstance(item, dict):
                    items.append(item)
                elif isinstance(item, str):
                    items.append({"item": item, "label": f"项目 {i+1}"})
                else:
                    items.append({"item": str(item), "label": f"项目 {i+1}"})

            return NodeOutput(
                content=json.dumps(items, ensure_ascii=False),
                format="json",
                metadata={
                    "source": "loop_map",
                    "item_count": len(items),
                    "is_iterable": True,
                },
            )

        # Fallback: single item
        return NodeOutput(
            content=json.dumps([{"item": raw_output, "label": "全部内容"}], ensure_ascii=False),
            format="json",
            metadata={
                "source": "loop_map",
                "item_count": 1,
                "is_iterable": True,
            },
        )

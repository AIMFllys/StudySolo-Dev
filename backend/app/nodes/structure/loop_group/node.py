"""LoopGroup node — container node that iterates its child subgraph.

This is a NON-LLM structural node. It does not call an LLM directly;
instead, the executor handles the iteration of child nodes within
this container. The node exists in the BaseNode registry primarily
so that the manifest API can expose its metadata to the frontend.

Execution flow:
  1. The executor detects `type == "loop_group"` during level traversal
  2. It calls `_execute_loop_group()` which handles the child subgraph
  3. Each iteration runs the children in topological order
  4. Results are aggregated and stored as the group's output

The node's execute() method is a no-op since the executor handles
all orchestration. It is defined to satisfy the BaseNode contract.
"""

import json
from typing import Any, AsyncIterator, ClassVar

from app.nodes._base import BaseNode, NodeInput, NodeOutput


class LoopGroupNode(BaseNode):
    node_type = "loop_group"
    category = "structure"
    display_name = "循环块"
    description = "循环容器：将子节点重复执行多次"
    is_llm_node = False
    output_format = "json"
    icon = "🔁"
    color = "#8b5cf6"
    config_schema: ClassVar[list[dict[str, Any]]] = [
        {
            "key": "maxIterations",
            "type": "number",
            "label": "最大循环次数",
            "default": 3,
            "min": 1,
            "max": 100,
            "step": 1,
            "description": "子节点被重复执行的次数上限。",
        },
        {
            "key": "intervalSeconds",
            "type": "number",
            "label": "迭代间隔 (秒)",
            "default": 0,
            "min": 0,
            "max": 300,
            "step": 1,
            "description": "两次迭代之间的等待时间。设为 0 表示无间隔。",
        },
    ]
    output_capabilities = ["preview", "compact"]
    supports_preview = False

    async def execute(
        self, node_input: NodeInput, llm_caller: Any
    ) -> AsyncIterator[str]:
        """No-op: the executor handles loop group orchestration directly.

        This method exists only to satisfy the BaseNode abstract contract.
        It will not be called in normal workflow execution because the
        executor intercepts loop_group nodes before dispatching.
        """
        yield json.dumps(
            {"message": "循环容器由执行引擎直接编排", "iterations": 0},
            ensure_ascii=False,
        )

    async def post_process(self, raw_output: str) -> NodeOutput:
        """Pass through the aggregated iteration results."""
        return NodeOutput(
            content=raw_output,
            format="json",
            metadata={"source": "loop_group"},
        )

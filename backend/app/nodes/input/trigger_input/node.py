"""Trigger input node — workflow entry point.

Non-LLM node: simply passes the user's initial input downstream.
"""

from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput


class TriggerInputNode(BaseNode):
    node_type = "trigger_input"
    category = "input"
    display_name = "用户输入"
    description = "工作流触发入口，接收用户初始输入"
    is_llm_node = False
    output_format = "passthrough"
    icon = "▶️"
    color = "#10b981"
    config_schema = [
        {
            "key": "input_template",
            "type": "textarea",
            "label": "输入模板",
            "default": "",
            "description": "当没有自动注入 user_content 时，作为默认输入模板。",
        },
        {
            "key": "example_placeholder",
            "type": "text",
            "label": "示例占位",
            "default": "",
            "description": "为当前触发节点记录一个推荐输入示例。",
        },
    ]
    output_capabilities = ["preview", "compact"]

    async def execute(
        self,
        node_input: NodeInput,
        llm_caller: Any,
    ) -> AsyncIterator[str]:
        """Pass through user content as-is — no LLM call needed."""
        config = node_input.node_config or {}
        output = node_input.user_content or config.get("input_template", "") or ""
        if output:
            yield output

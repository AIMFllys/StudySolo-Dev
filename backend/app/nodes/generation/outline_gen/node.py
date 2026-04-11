"""Outline generation node — produces structured learning outlines."""

from typing import Any, AsyncIterator
from app.nodes._base import BaseNode, NodeInput
from app.nodes._mixins import LLMStreamMixin


class OutlineGenNode(BaseNode, LLMStreamMixin):
    node_type = "outline_gen"
    category = "generation"
    display_name = "大纲生成"
    description = "根据学习目标生成清晰的学习大纲"
    is_llm_node = True
    output_format = "markdown"
    icon = "📋"
    color = "#3b82f6"
    renderer = "OutlineRenderer"
    config_schema = [
        {
            "key": "max_sections",
            "type": "number",
            "label": "章节数量",
            "default": 6,
            "min": 3,
            "max": 12,
            "step": 1,
            "description": "控制大纲的顶层章节数。",
        },
        {
            "key": "outline_style",
            "type": "select",
            "label": "大纲风格",
            "default": "balanced",
            "options": [
                {"label": "平衡", "value": "balanced"},
                {"label": "课程式", "value": "course"},
                {"label": "速记式", "value": "revision"},
            ],
            "description": "控制大纲更偏教学课程还是复习提纲。",
        },
    ]
    output_capabilities = ["preview", "compact"]

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        system = self.system_prompt + self.build_context_prompt(node_input.implicit_context)
        user_msg = self.build_user_message(node_input)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ]
        async for token in self.stream_llm(messages, llm_caller):
            yield token

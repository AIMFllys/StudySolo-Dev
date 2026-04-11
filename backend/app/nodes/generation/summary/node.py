"""Summary node — generates concise learning summaries."""

from typing import Any, AsyncIterator
from app.nodes._base import BaseNode, NodeInput
from app.nodes._mixins import LLMStreamMixin


class SummaryNode(BaseNode, LLMStreamMixin):
    node_type = "summary"
    category = "generation"
    display_name = "总结归纳"
    description = "生成简洁的学习总结"
    is_llm_node = True
    output_format = "markdown"
    icon = "📝"
    color = "#3b82f6"
    config_schema = [
        {
            "key": "summary_length",
            "type": "select",
            "label": "总结长度",
            "default": "balanced",
            "options": [
                {"label": "简短", "value": "short"},
                {"label": "标准", "value": "balanced"},
                {"label": "详细", "value": "long"},
            ],
            "description": "控制总结篇幅。",
        },
        {
            "key": "style",
            "type": "select",
            "label": "总结风格",
            "default": "study_notes",
            "options": [
                {"label": "学习笔记", "value": "study_notes"},
                {"label": "复习提纲", "value": "revision"},
                {"label": "结论导向", "value": "conclusion"},
            ],
            "description": "控制总结组织方式。",
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

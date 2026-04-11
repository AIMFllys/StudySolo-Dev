"""Content extraction node — distills core knowledge points."""

from typing import Any, AsyncIterator
from app.nodes._base import BaseNode, NodeInput
from app.nodes._mixins import LLMStreamMixin


class ContentExtractNode(BaseNode, LLMStreamMixin):
    node_type = "content_extract"
    category = "generation"
    display_name = "知识提炼"
    description = "根据大纲提炼核心知识点"
    is_llm_node = True
    output_format = "markdown"
    icon = "🔬"
    color = "#3b82f6"
    config_schema = [
        {
            "key": "focus",
            "type": "text",
            "label": "提炼重点",
            "default": "",
            "description": "例如：核心概念、案例、公式、误区。",
        },
        {
            "key": "detail_level",
            "type": "select",
            "label": "详细程度",
            "default": "balanced",
            "options": [
                {"label": "简洁", "value": "concise"},
                {"label": "平衡", "value": "balanced"},
                {"label": "详细", "value": "detailed"},
            ],
            "description": "控制提炼结果的细节密度。",
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

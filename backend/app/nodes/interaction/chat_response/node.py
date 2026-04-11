"""Chat response node — provides personalized learning advice."""

from typing import Any, AsyncIterator
from app.nodes._base import BaseNode, NodeInput
from app.nodes._mixins import LLMStreamMixin


class ChatResponseNode(BaseNode, LLMStreamMixin):
    node_type = "chat_response"
    category = "interaction"
    display_name = "对话回复"
    description = "提供个性化学习建议和回复"
    is_llm_node = True
    output_format = "markdown"
    icon = "💬"
    color = "#ec4899"
    config_schema = [
        {
            "key": "tone",
            "type": "select",
            "label": "回复语气",
            "default": "friendly",
            "options": [
                {"label": "友好", "value": "friendly"},
                {"label": "专业", "value": "professional"},
                {"label": "鼓励式", "value": "coaching"},
            ],
            "description": "控制最终回复的语气。",
        },
        {
            "key": "include_next_steps",
            "type": "boolean",
            "label": "包含下一步建议",
            "default": True,
            "description": "在回复尾部加入后续行动建议。",
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

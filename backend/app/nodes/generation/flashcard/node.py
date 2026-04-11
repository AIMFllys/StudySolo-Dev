"""Flashcard node — generates Q&A flashcards with JSON validation."""

import json
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput, NodeOutput
from app.nodes._mixins import LLMStreamMixin, JsonOutputMixin


class FlashcardNode(BaseNode, LLMStreamMixin, JsonOutputMixin):
    node_type = "flashcard"
    category = "generation"
    display_name = "闪卡生成"
    description = "根据知识点生成问答闪卡"
    is_llm_node = True
    output_format = "json"
    icon = "🃏"
    color = "#f59e0b"
    renderer = "FlashcardRenderer"
    config_schema = [
        {
            "key": "card_count",
            "type": "number",
            "label": "闪卡数量",
            "default": 8,
            "min": 3,
            "max": 24,
            "step": 1,
            "description": "建议生成的闪卡总数。",
        },
        {
            "key": "difficulty",
            "type": "select",
            "label": "难度",
            "default": "standard",
            "options": [
                {"label": "基础", "value": "basic"},
                {"label": "标准", "value": "standard"},
                {"label": "进阶", "value": "advanced"},
            ],
            "description": "控制题目难度与答案深度。",
        },
        {
            "key": "answer_style",
            "type": "select",
            "label": "答案风格",
            "default": "concise",
            "options": [
                {"label": "简明", "value": "concise"},
                {"label": "解释型", "value": "explanatory"},
            ],
            "description": "决定答案是短答还是带解释。",
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

    async def post_process(self, raw_output: str) -> NodeOutput:
        """Validate flashcard output as JSON array of {question, answer}."""
        try:
            parsed = await self.validate_json(raw_output)
            # Ensure it's a list
            if not isinstance(parsed, list):
                parsed = [parsed]
            return NodeOutput(
                content=json.dumps(parsed, ensure_ascii=False, indent=2),
                format="json",
                metadata={"card_count": len(parsed)},
            )
        except ValueError:
            # Fallback: return as markdown
            return NodeOutput(content=raw_output, format="markdown")

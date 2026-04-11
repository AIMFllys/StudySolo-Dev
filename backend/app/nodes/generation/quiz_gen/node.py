"""QuizGen node — generates quiz questions for learning assessment.

This is a '封装功能型' (encapsulated) node that generates quiz questions
of multiple types (choice, true_false, fill_blank) with difficulty control,
answer explanations, and JSON schema validation via Pydantic.

It forms the '测' (test) part of the 「学 → 练 → 测」learning loop.
"""

import json
import logging
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput, NodeOutput
from app.nodes._mixins import LLMStreamMixin, JsonOutputMixin
from app.nodes.generation.quiz_gen.validator import validate_quiz_output

logger = logging.getLogger(__name__)


class QuizGenNode(BaseNode, LLMStreamMixin, JsonOutputMixin):
    node_type = "quiz_gen"
    category = "generation"
    display_name = "测验生成"
    description = "生成测验题目（选择题/判断题/填空题）"
    is_llm_node = True
    output_format = "json"
    icon = "📝"
    color = "#ef4444"
    renderer = "QuizRenderer"
    config_schema = [
        {
            "key": "question_count",
            "type": "number",
            "label": "题目数量",
            "default": 6,
            "min": 3,
            "max": 20,
            "step": 1,
            "description": "生成的题目总数。",
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
            "description": "控制题目难度。",
        },
        {
            "key": "question_types",
            "type": "text",
            "label": "题型",
            "default": "choice,true_false,fill_blank",
            "description": "逗号分隔，例如 choice,true_false。",
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
        """Validate quiz output using Pydantic schema and repair if needed."""
        try:
            parsed = await self.validate_json(raw_output)
            # Ensure it's a list
            if not isinstance(parsed, list):
                parsed = [parsed]

            # Validate each question via Pydantic
            validated_questions = validate_quiz_output(parsed)

            return NodeOutput(
                content=json.dumps(validated_questions, ensure_ascii=False, indent=2),
                format="json",
                metadata={
                    "question_count": len(validated_questions),
                    "type_breakdown": _count_types(validated_questions),
                },
            )
        except ValueError as e:
            logger.warning("Quiz validation failed: %s", e)
            # Fallback: return as markdown
            return NodeOutput(content=raw_output, format="markdown")


def _count_types(questions: list[dict]) -> dict[str, int]:
    """Count questions by type."""
    counts: dict[str, int] = {}
    for q in questions:
        qtype = q.get("type", "unknown")
        counts[qtype] = counts.get(qtype, 0) + 1
    return counts

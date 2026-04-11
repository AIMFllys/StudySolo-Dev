"""AI Analyzer node — parses user learning goals into structured JSON."""

import json
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput, NodeOutput
from app.nodes._mixins import LLMStreamMixin, JsonOutputMixin


class AIAnalyzerNode(BaseNode, LLMStreamMixin, JsonOutputMixin):
    node_type = "ai_analyzer"
    category = "analysis"
    display_name = "需求分析"
    description = "将用户学习目标解析为结构化需求 JSON"
    is_llm_node = True
    output_format = "json"
    icon = "🔍"
    color = "#8b5cf6"
    output_capabilities = ["preview", "compact"]

    async def execute(
        self,
        node_input: NodeInput,
        llm_caller: Any,
    ) -> AsyncIterator[str]:
        system = self.system_prompt + self.build_context_prompt(node_input.implicit_context)
        user_msg = self.build_user_message(node_input)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ]
        async for token in self.stream_llm(messages, llm_caller):
            yield token

    async def post_process(self, raw_output: str) -> NodeOutput:
        try:
            parsed = await self.validate_json(raw_output)
            return NodeOutput(
                content=json.dumps(parsed, ensure_ascii=False, indent=2),
                format="json",
                metadata={"fields": list(parsed.keys()) if isinstance(parsed, dict) else []},
            )
        except ValueError:
            # Fallback: return raw output as markdown if JSON parsing fails
            return NodeOutput(content=raw_output, format="markdown")

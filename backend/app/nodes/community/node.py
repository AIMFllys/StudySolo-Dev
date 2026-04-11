"""Community shared workflow node."""

from __future__ import annotations

import json
import re
from typing import Any, AsyncIterator

from app.core.database import get_db
from app.nodes._base import BaseNode, NodeInput, NodeOutput
from app.services.community_node_queries import get_node_with_prompt


def _build_json_constraint_prompt(output_schema: dict) -> str:
    schema_str = json.dumps(output_schema, ensure_ascii=False, indent=2)
    return f"""

---
【输出格式严格约束 / OUTPUT FORMAT CONSTRAINT】

你必须且只能输出一个合规的 JSON 对象。

严格要求：
1. 以 {{ 开头，以 }} 结尾
2. 不要输出 ```json ``` 代码块标记
3. 不要输出任何解释、注释或多余文字
4. 字段名必须与以下 Schema 完全一致
5. 所有 required 字段必须存在

JSON Schema：
{schema_str}
---"""


def _build_knowledge_prompt(knowledge_text: str) -> str:
    return f"""

---
【辅助知识资料】
以下内容来自发布者绑定的知识文件。请优先在这些资料范围内作答，并在资料不足时再做稳健补充：

{knowledge_text}
---"""


class CommunityNode(BaseNode):
    node_type = "community_node"
    category = "community"
    display_name = "社区共享节点"
    description = "社区共享节点"
    is_llm_node = True
    output_format = "markdown"
    icon = "🌐"
    color = "#0f766e"
    output_capabilities = ["preview", "compact"]
    renderer = "CommunityNodeRenderer"

    def __init__(self) -> None:
        self._output_format = "markdown"
        self._output_schema: dict | None = None

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        config = node_input.node_config or {}
        community_node_id = config.get("community_node_id")
        if not isinstance(community_node_id, str) or not community_node_id:
            yield "[错误] 缺少社区节点 ID"
            return

        db = await get_db()
        node_def = await get_node_with_prompt(db, node_id=community_node_id)
        if not node_def:
            yield "[错误] 社区节点不存在或未公开"
            return

        self._output_format = str(node_def.get("output_format") or config.get("output_format") or "markdown")
        self._output_schema = node_def.get("output_schema") if isinstance(node_def.get("output_schema"), dict) else None

        custom_prompt = str(node_def.get("prompt") or "").strip()
        if isinstance(node_def.get("knowledge_text"), str) and node_def["knowledge_text"].strip():
            custom_prompt += _build_knowledge_prompt(node_def["knowledge_text"].strip())
        if self._output_format == "json" and self._output_schema:
            custom_prompt += _build_json_constraint_prompt(self._output_schema)

        system = self._assemble_prompt(custom_prompt) + self.build_context_prompt(node_input.implicit_context)
        user_msg = self.build_user_message(node_input)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ]
        token_stream = await llm_caller("chat_response", messages, stream=True)
        async for token in token_stream:
            yield token

    async def post_process(self, raw_output: str) -> NodeOutput:
        if self._output_format != "json":
            return NodeOutput(content=raw_output, format="markdown")

        cleaned = raw_output.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```\\w*\\n?", "", cleaned)
            cleaned = re.sub(r"\\n?```$", "", cleaned)
            cleaned = cleaned.strip()

        brace_start = cleaned.find("{")
        brace_end = cleaned.rfind("}")
        if brace_start >= 0 and brace_end > brace_start:
            cleaned = cleaned[brace_start:brace_end + 1]

        try:
            parsed = json.loads(cleaned)
            return NodeOutput(
                content=json.dumps(parsed, ensure_ascii=False, indent=2),
                format="json",
                metadata={"json_valid": True},
            )
        except json.JSONDecodeError as exc:
            return NodeOutput(
                content=(
                    "⚠️ **JSON 格式校验失败**\n\n"
                    f"错误信息：{exc.msg}\n\n"
                    f"模型原始输出：\n```\n{raw_output[:2000]}\n```"
                ),
                format="markdown",
                metadata={"json_valid": False, "json_error": str(exc)},
            )

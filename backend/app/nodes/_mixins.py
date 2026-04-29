"""Shared mixins for common node behaviours.

Mixins reduce code duplication across nodes that share similar logic
(e.g., all LLM nodes stream tokens the same way, all JSON nodes
need the same output validation).
"""

import json
import logging
from typing import Any, AsyncIterator

logger = logging.getLogger(__name__)


class LLMStreamMixin:
    """Standard LLM streaming call.

    Usage in a node:
        class MyNode(BaseNode, LLMStreamMixin):
            async def execute(self, node_input, llm_caller):
                messages = [...]
                async for token in self.stream_llm(messages, llm_caller):
                    yield token
    """

    async def stream_llm(
        self,
        messages: list[dict[str, str]],
        llm_caller: Any,
        node_type: str | None = None,
    ) -> AsyncIterator[str]:
        """Call LLM with streaming and yield tokens."""
        _type = node_type or getattr(self, "node_type", "chat_response")
        token_stream = await llm_caller(_type, messages, stream=True)
        async for token in token_stream:
            yield token

    async def call_llm_stream(
        self,
        node_input: Any,
        llm_caller: Any,
    ) -> AsyncIterator[str]:
        """Build default system/user messages and stream tokens."""
        system = self.system_prompt + self.build_context_prompt(node_input.implicit_context)
        user_msg = self.build_user_message(node_input)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ]
        async for token in self.stream_llm(messages, llm_caller):
            yield token


class JsonOutputMixin:
    """JSON output validation and repair.

    Usage in a node:
        class FlashcardNode(BaseNode, JsonOutputMixin):
            async def post_process(self, raw_output):
                parsed = await self.validate_json(raw_output)
                return NodeOutput(content=json.dumps(parsed, ensure_ascii=False), format="json")
    """

    async def validate_json(self, raw_output: str) -> Any:
        """Parse raw LLM output as JSON, with common repair strategies."""
        text = raw_output.strip()

        # Strategy 1: direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Strategy 2: strip markdown code fences
        for fence in ("```json", "```JSON", "```"):
            if text.startswith(fence):
                text = text[len(fence):]
                break
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Strategy 3: find first [ or { and last ] or }
        start = -1
        end = -1
        for i, ch in enumerate(text):
            if ch in ("{", "["):
                start = i
                break
        for i in range(len(text) - 1, -1, -1):
            if text[i] in ("}", "]"):
                end = i + 1
                break

        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass

        # All strategies failed
        logger.warning("JSON validation failed for output: %s...", text[:200])
        raise ValueError(f"无法解析为 JSON: {text[:200]}...")

    def try_parse_json(self, raw_output: str) -> dict | list | None:
        """Synchronous JSON parse with fallback — returns None on failure.

        Unlike validate_json (async, raises on failure), this method is
        synchronous and returns None when parsing fails.  Used by nodes
        like LogicSwitchNode and LoopMapNode whose post_process needs a
        lenient, non-throwing parser.
        """
        text = raw_output.strip()

        # Strategy 1: direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Strategy 2: strip markdown fences
        for fence in ("```json", "```JSON", "```"):
            if text.startswith(fence):
                text = text[len(fence):]
                break
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Strategy 3: find first { or [ and last } or ]
        start = -1
        end = -1
        for i, ch in enumerate(text):
            if ch in ("{", "["):
                start = i
                break
        for i in range(len(text) - 1, -1, -1):
            if text[i] in ("}", "]"):
                end = i + 1
                break

        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass

        return None

"""WebSearch node — retrieves real-time information from the internet.

This is a NON-LLM node. It calls the dual-engine search service
(GLM + Baidu) concurrently and returns merged, authority-filtered results.

The search results are formatted as Markdown and passed to downstream nodes.
Users cannot manually select a model — search engines are built-in.

Typical flows:
  [trigger_input] → [web_search] → [content_extract] → [summary]
  [trigger_input] → [web_search] → [flashcard]
"""

import logging
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput, NodeOutput

logger = logging.getLogger(__name__)


class WebSearchNode(BaseNode):
    node_type = "web_search"
    category = "input"
    description = "联网搜索获取最新信息（GLM + 百度双引擎）"
    is_llm_node = False
    output_format = "markdown"
    icon = "🌐"
    color = "#0ea5e9"
    config_schema = [
        {
            "key": "max_results",
            "type": "number",
            "label": "每引擎结果数",
            "default": 5,
            "min": 1,
            "max": 10,
            "step": 1,
            "description": "每个搜索引擎返回的结果数量上限。双引擎总计最多 2x 条。",
        },
    ]
    output_capabilities = ["preview", "compact"]

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        """Execute dual-engine web search (GLM + Baidu).

        Query is built from:
        1. node_input.user_content (the label)
        2. Upstream outputs (first meaningful line for context)
        """
        # Lazy import to avoid registration-time dependency
        from app.services.search_service import search_web, format_search_results

        # Build search query
        query_parts: list[str] = []
        if node_input.user_content:
            label = node_input.user_content.strip()
            for prefix in ("🌐", "🔍", "📖"):
                label = label.removeprefix(prefix).strip()
            query_parts.append(label)

        if node_input.upstream_outputs:
            for uid, out in node_input.upstream_outputs.items():
                first_line = ""
                for line in out.split("\n"):
                    stripped = line.strip().lstrip("#").strip()
                    if stripped and len(stripped) > 3:
                        first_line = stripped[:80]
                        break
                if first_line:
                    query_parts.append(first_line)

        query = " ".join(query_parts)
        if not query.strip():
            yield "⚠️ 没有提供搜索关键词"
            return

        # Get search config
        max_results = 5
        if node_input.node_config:
            max_results = node_input.node_config.get("max_results", 5)

        # Perform dual-engine search
        try:
            yield "🔍 正在通过 GLM + 百度双引擎搜索...\n\n"

            response = await search_web(
                query=query,
                max_results=max_results,
            )

            formatted = format_search_results(response)
            yield formatted

        except Exception as e:
            logger.error("Web search node failed: %s", e)
            yield f"⚠️ 联网搜索出错: {e}"

    async def post_process(self, raw_output: str) -> NodeOutput:
        """Return search results as markdown."""
        content = raw_output
        # Remove the searching prefix if present
        search_prefixes = [
            "🔍 正在通过 GLM + 百度双引擎搜索...\n\n",
            "🔍 正在搜索...\n\n",
        ]
        for prefix in search_prefixes:
            if content.startswith(prefix):
                content = content[len(prefix):]
                break

        return NodeOutput(
            content=content,
            format="markdown",
            metadata={"source": "web_search", "engines": ["glm", "baidu"]},
        )

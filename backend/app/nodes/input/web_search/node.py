"""WebSearch node — retrieves real-time information from the internet.

This is a NON-LLM node. It calls the dual-engine search service
(Zhipu web-search-pro + Qiniu Baidu /search/web) concurrently and returns
merged, authority-scored results.

Typical flows:
  [trigger_input] → [web_search] → [content_extract] → [summary]
  [trigger_input] → [web_search] → [flashcard]

When both engines fail, the node still emits a downstream-LLM-friendly
"fallback instruction" (via NodeOutput.metadata.degraded + fallback_instruction)
so that successor LLM nodes answer from their own knowledge with a clear
disclaimer, rather than summarizing error messages.
"""

from __future__ import annotations

import logging
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput, NodeOutput

logger = logging.getLogger(__name__)

# Generic label fragments that should NOT be used as a search query on their own.
_GENERIC_LABEL_TOKENS: set[str] = {
    "", "联网搜索", "网络搜索", "搜索", "web search", "web_search",
    "search", "internet search",
}


def _clean_label(raw: str) -> str:
    """Strip node-label emoji prefixes and return a trimmed topic string."""
    if not raw:
        return ""
    label = raw.strip()
    for prefix in ("🌐", "🔍", "📖", "🔎"):
        label = label.removeprefix(prefix).strip()
    return label


def _is_generic_label(label: str) -> bool:
    return label.lower().strip() in _GENERIC_LABEL_TOKENS


def _extract_first_meaningful_line(text: str, max_len: int = 160) -> str:
    """Return the first non-trivial line from an upstream node output."""
    for line in text.splitlines():
        stripped = line.strip().lstrip("#").strip().lstrip(">").strip()
        if stripped and len(stripped) >= 3:
            return stripped[:max_len]
    return ""


def _build_query(node_input: NodeInput) -> str:
    """Compose a search query from upstream outputs + node label.

    Priority order:
      1. Upstream outputs (trigger_input's original user question) — this is
         the actual topic the user wants to research.
      2. Node label (only when it's not a generic "联网搜索" stub).
    """
    parts: list[str] = []

    if node_input.upstream_outputs:
        for _uid, out in node_input.upstream_outputs.items():
            if not out:
                continue
            first = _extract_first_meaningful_line(out)
            if first:
                parts.append(first)
                break  # one upstream anchor is enough

    label = _clean_label(node_input.user_content or "")
    if label and not _is_generic_label(label):
        parts.append(label)

    return " ".join(parts).strip()


class WebSearchNode(BaseNode):
    node_type = "web_search"
    category = "input"
    display_name = "网络搜索"
    description = "联网搜索获取最新信息（智谱 + 百度 双引擎）"
    is_llm_node = False
    output_format = "markdown"
    icon = "🌐"
    color = "#0ea5e9"
    version = "1.0.0"
    changelog = {"1.0.0": "初始版本"}
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

    # Instance-level cache populated by execute() and consumed by post_process().
    # Fresh instances are created per-execution by node_runner, so this is safe.
    def __init__(self) -> None:
        self._last_response: Any = None
        self._last_query: str = ""

    async def execute(
        self,
        node_input: NodeInput,
        llm_caller: Any,
    ) -> AsyncIterator[str]:
        """Execute dual-engine web search and yield markdown tokens."""
        from app.services.search_service import (
            FALLBACK_INSTRUCTION,
            SearchResponse,
            format_search_results,
            search_web,
        )

        query = _build_query(node_input)
        self._last_query = query

        max_results = 5
        if node_input.node_config:
            raw = node_input.node_config.get("max_results", 5)
            try:
                max_results = max(1, min(int(raw), 10))
            except (TypeError, ValueError):
                max_results = 5

        if not query:
            # No usable query: immediately emit a degraded SearchResponse so
            # downstream LLM nodes still know to answer from self-knowledge.
            degraded = SearchResponse(
                query="",
                degraded=True,
                degradation_reason="未能从上游或节点标签构造出有效搜索关键词",
                fallback_instruction=FALLBACK_INSTRUCTION,
            )
            self._last_response = degraded
            yield format_search_results(degraded)
            return

        try:
            yield "🔍 正在通过 智谱 + 百度 双引擎搜索...\n\n"
            response = await search_web(query=query, max_results=max_results)
            self._last_response = response
            yield format_search_results(response)
        except Exception as e:  # final safety net
            logger.error("Web search node failed: %s", e)
            degraded = SearchResponse(
                query=query,
                degraded=True,
                degradation_reason=f"双引擎调度异常: {e}",
                fallback_instruction=FALLBACK_INSTRUCTION,
            )
            self._last_response = degraded
            yield "\n" + format_search_results(degraded)

    async def post_process(self, raw_output: str) -> NodeOutput:
        """Return search results with degraded/fallback metadata preserved."""
        content = raw_output
        # Strip the transient "searching" prefix so downstream sees clean markdown.
        for prefix in (
            "🔍 正在通过 智谱 + 百度 双引擎搜索...\n\n",
            "🔍 正在通过 GLM + 百度双引擎搜索...\n\n",  # legacy prefix tolerance
            "🔍 正在搜索...\n\n",
        ):
            if content.startswith(prefix):
                content = content[len(prefix):]
                break

        response = self._last_response
        metadata: dict[str, Any] = {
            "source": "web_search",
            "engines": ["glm", "baidu"],
            "degraded": False,
            "degradation_reason": "",
            "fallback_instruction": "",
            "original_query": self._last_query,
        }
        if response is not None:
            metadata["degraded"] = bool(getattr(response, "degraded", False))
            metadata["degradation_reason"] = str(getattr(response, "degradation_reason", "") or "")
            metadata["fallback_instruction"] = str(getattr(response, "fallback_instruction", "") or "")
            metadata["original_query"] = str(getattr(response, "query", self._last_query) or self._last_query)
            metadata["errors"] = list(getattr(response, "errors", []) or [])
            metadata["result_count"] = len(getattr(response, "results", []) or [])

        return NodeOutput(
            content=content,
            format="markdown",
            metadata=metadata,
        )

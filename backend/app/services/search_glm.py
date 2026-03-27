"""GLM web_search provider — uses Zhipu AI's web_search tool capability.

GLM models (GLM-4 series) support a `web_search` tool that performs
real-time internet searches and returns structured results.

The approach: call the GLM chat API with web_search tool enabled,
the model automatically performs the search and returns results.
"""

import logging
import os
from dataclasses import dataclass, field

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


@dataclass
class GLMSearchResult:
    """A single search result from GLM web_search."""
    title: str
    url: str
    content: str
    refer: str = ""


@dataclass
class GLMSearchResponse:
    """Aggregated GLM search response."""
    query: str
    results: list[GLMSearchResult] = field(default_factory=list)
    summary: str = ""
    error: str | None = None


async def search_via_glm(
    query: str,
    max_results: int = 5,
) -> GLMSearchResponse:
    """Execute a web search via GLM's web_search tool.

    Uses the Zhipu AI API with web_search tool enabled.
    The model performs the search and we extract results from the response.
    """
    api_key = os.getenv("ZHIPU_API_KEY", "")
    base_url = os.getenv("ZHIPU_BASE_URL", "https://open.bigmodel.cn/api/paas/v4")

    if not api_key:
        logger.warning("ZHIPU_API_KEY not set, GLM search unavailable")
        return GLMSearchResponse(
            query=query,
            error="GLM 搜索未配置（缺少 ZHIPU_API_KEY）",
        )

    client = AsyncOpenAI(base_url=base_url, api_key=api_key, timeout=30.0)

    # Build search prompt with authority constraints
    search_prompt = (
        f"请搜索以下内容，优先从权威平台获取信息"
        f"（如百度百科、知网CNKI、中国政府网、学术期刊、官方文档）。\n"
        f"禁止引用非官方自媒体、个人博客等不可靠来源。\n\n"
        f"搜索内容：{query}\n\n"
        f"请提供 {max_results} 条最相关的搜索结果，每条包含标题、来源URL和核心内容摘要。"
    )

    try:
        response = await client.chat.completions.create(
            model="glm-4-flash",
            messages=[{"role": "user", "content": search_prompt}],
            tools=[{"type": "web_search", "web_search": {"enable": True}}],
            stream=False,
        )

        content = response.choices[0].message.content or ""

        # Extract web_search_results from the response metadata if available
        web_results: list[GLMSearchResult] = []

        # GLM returns web search references in the response
        # Parse the structured content from GLM's response
        tool_calls = getattr(response.choices[0].message, "tool_calls", None)

        # GLM web_search integrates results directly into the response content
        # We parse the content and also check for web_search metadata
        if hasattr(response, "web_search") and response.web_search:
            for item in response.web_search[:max_results]:
                web_results.append(GLMSearchResult(
                    title=item.get("title", ""),
                    url=item.get("link", item.get("url", "")),
                    content=item.get("content", ""),
                    refer=item.get("refer", ""),
                ))

        # If no structured results, use the text content as summary
        return GLMSearchResponse(
            query=query,
            results=web_results,
            summary=content,
        )

    except Exception as e:
        logger.error("GLM web search failed for query '%s': %s", query[:50], e)
        return GLMSearchResponse(query=query, error=f"GLM 搜索出错: {e}")

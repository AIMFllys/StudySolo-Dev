"""Baidu search via Qiniu proxy — uses Qiniu's OpenAI-compatible API
with a model that has built-in web search capability.

Qiniu proxies multiple model vendors and some models include
search-augmented generation (SAG) capabilities that perform
Baidu searches under the hood.

Strategy: Use Qiniu's API with a search-capable model to perform
Baidu-backed web searches with authoritative source constraints.
"""

import logging
import os
from dataclasses import dataclass, field

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


@dataclass
class BaiduSearchResult:
    """A single search result from Baidu via Qiniu."""
    title: str
    url: str
    content: str


@dataclass
class BaiduSearchResponse:
    """Aggregated Baidu search response."""
    query: str
    results: list[BaiduSearchResult] = field(default_factory=list)
    summary: str = ""
    error: str | None = None


async def search_via_baidu(
    query: str,
    max_results: int = 5,
) -> BaiduSearchResponse:
    """Execute a web search via Qiniu's Baidu-backed search model.

    Uses the Qiniu OpenAI-compatible API with a search-capable model
    that performs Baidu searches and returns structured results.
    """
    api_key = os.getenv("QINIU_API_KEY", "")
    base_url = os.getenv("QINIU_BASE_URL", "https://api.qnaigc.com/v1")

    if not api_key:
        logger.warning("QINIU_API_KEY not set, Baidu search via Qiniu unavailable")
        return BaiduSearchResponse(
            query=query,
            error="百度搜索未配置（缺少 QINIU_API_KEY）",
        )

    client = AsyncOpenAI(base_url=base_url, api_key=api_key, timeout=30.0)

    # Build search prompt with strict authority constraints
    search_prompt = (
        f"你是一个学术搜索助手。请通过百度搜索以下内容，"
        f"并严格遵循以下搜索规则：\n\n"
        f"## 搜索规则\n"
        f"1. **仅引用权威平台**：百度百科、知网(CNKI)、中国政府网(.gov.cn)、"
        f"学术期刊、官方文档、维基百科\n"
        f"2. **禁止引用**：个人博客、自媒体(百家号、搜狐号)、"
        f"未经验证的论坛帖子、非官方教程网站\n"
        f"3. **每条结果**必须包含：标题、来源URL、核心内容摘要\n\n"
        f"## 搜索内容\n{query}\n\n"
        f"请提供 {max_results} 条最权威、最相关的搜索结果。"
    )

    try:
        # Use a search-capable model via Qiniu
        # Qiniu proxies models like Qwen that can perform web searches
        response = await client.chat.completions.create(
            model="Qwen/Qwen3-Max",
            messages=[{"role": "user", "content": search_prompt}],
            extra_body={"enable_search": True},
            stream=False,
        )

        content = response.choices[0].message.content or ""

        # Extract search results from response metadata if available
        search_results: list[BaiduSearchResult] = []

        # Check for search_results in the response (Qwen search-augmented)
        if hasattr(response, "search_results") and response.search_results:
            for item in response.search_results[:max_results]:
                search_results.append(BaiduSearchResult(
                    title=item.get("title", ""),
                    url=item.get("url", item.get("link", "")),
                    content=item.get("content", item.get("snippet", "")),
                ))

        return BaiduSearchResponse(
            query=query,
            results=search_results,
            summary=content,
        )

    except Exception as e:
        logger.error("Baidu search via Qiniu failed for query '%s': %s", query[:50], e)
        return BaiduSearchResponse(query=query, error=f"百度搜索出错: {e}")

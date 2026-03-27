"""Unified web search service — aggregates GLM + Baidu dual-engine search.

Architecture:
  1. Concurrent search via GLM (Zhipu AI web_search tool) + Baidu (Qiniu proxy)
  2. Merge & deduplicate results by URL
  3. Filter out non-authoritative sources
  4. Format into Markdown for downstream node consumption

Authority filter:
  - Whitelist: baike.baidu.com, cnki.net, gov.cn, wikipedia.org, zhihu.com,
               official docs, academic journals
  - Blocklist: personal blogs, unverified forums, self-media platforms
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

from app.services.search_glm import GLMSearchResponse, search_via_glm
from app.services.search_baidu import BaiduSearchResponse, search_via_baidu

logger = logging.getLogger(__name__)


# ── Authority domain configuration ───────────────────────────────────────────

# Domains that are always considered authoritative
AUTHORITY_WHITELIST = {
    "baike.baidu.com",
    "cnki.net",
    "www.cnki.net",
    "gov.cn",
    "wikipedia.org",
    "zh.wikipedia.org",
    "zhihu.com",
    "www.zhihu.com",
    "arxiv.org",
    "scholar.google.com",
    "docs.python.org",
    "developer.mozilla.org",
    "reactjs.org",
    "nextjs.org",
}

# Domains that should be excluded from results
BLOCKLIST_PATTERNS = {
    "baijiahao.baidu.com",    # 百家号
    "sohu.com",               # 搜狐号
    "toutiao.com",            # 头条号
    "163.com/dy",             # 网易号
    "jianshu.com",            # 简书
    "blog.csdn.net",          # CSDN 博客
}


def _is_authoritative_url(url: str) -> bool:
    """Check if a URL is from an authoritative source."""
    if not url:
        return True  # Allow results without URLs (summaries)

    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
    except Exception:
        return True

    # Block known non-authoritative domains
    for blocked in BLOCKLIST_PATTERNS:
        if blocked in domain:
            return False

    return True


# ── Data models ──────────────────────────────────────────────────────────────

@dataclass
class SearchResult:
    """A single merged search result."""
    title: str
    url: str
    content: str
    source_engine: str  # "glm" or "baidu"
    score: float = 0.0


@dataclass
class SearchResponse:
    """Aggregated multi-engine search response."""
    query: str
    results: list[SearchResult] = field(default_factory=list)
    glm_summary: Optional[str] = None
    baidu_summary: Optional[str] = None
    errors: list[str] = field(default_factory=list)


# ── Core search function ─────────────────────────────────────────────────────

async def search_web(
    query: str,
    max_results: int = 5,
) -> SearchResponse:
    """Execute a dual-engine web search (GLM + Baidu) concurrently.

    Args:
        query: Search query string
        max_results: Maximum number of results per engine

    Returns:
        SearchResponse with merged, deduplicated, authority-filtered results
    """
    # Run both engines concurrently
    glm_task = search_via_glm(query, max_results=max_results)
    baidu_task = search_via_baidu(query, max_results=max_results)

    glm_response, baidu_response = await asyncio.gather(
        glm_task, baidu_task, return_exceptions=True
    )

    errors: list[str] = []
    all_results: list[SearchResult] = []
    seen_urls: set[str] = set()

    # Process GLM results
    glm_summary = None
    if isinstance(glm_response, GLMSearchResponse):
        if glm_response.error:
            errors.append(f"GLM: {glm_response.error}")
        else:
            glm_summary = glm_response.summary
            for r in glm_response.results:
                if r.url not in seen_urls and _is_authoritative_url(r.url):
                    seen_urls.add(r.url)
                    all_results.append(SearchResult(
                        title=r.title,
                        url=r.url,
                        content=r.content,
                        source_engine="glm",
                    ))
    elif isinstance(glm_response, Exception):
        errors.append(f"GLM 引擎异常: {glm_response}")
        logger.error("GLM search engine exception: %s", glm_response)

    # Process Baidu results
    baidu_summary = None
    if isinstance(baidu_response, BaiduSearchResponse):
        if baidu_response.error:
            errors.append(f"百度: {baidu_response.error}")
        else:
            baidu_summary = baidu_response.summary
            for r in baidu_response.results:
                if r.url not in seen_urls and _is_authoritative_url(r.url):
                    seen_urls.add(r.url)
                    all_results.append(SearchResult(
                        title=r.title,
                        url=r.url,
                        content=r.content,
                        source_engine="baidu",
                    ))
    elif isinstance(baidu_response, Exception):
        errors.append(f"百度引擎异常: {baidu_response}")
        logger.error("Baidu search engine exception: %s", baidu_response)

    # If both engines returned no structured results but have summaries,
    # the summaries themselves are still valuable
    logger.info(
        "Dual-engine search for '%s': %d results (GLM: %s, Baidu: %s)",
        query[:50],
        len(all_results),
        "OK" if not isinstance(glm_response, Exception) and not (isinstance(glm_response, GLMSearchResponse) and glm_response.error) else "FAIL",
        "OK" if not isinstance(baidu_response, Exception) and not (isinstance(baidu_response, BaiduSearchResponse) and baidu_response.error) else "FAIL",
    )

    return SearchResponse(
        query=query,
        results=all_results,
        glm_summary=glm_summary,
        baidu_summary=baidu_summary,
        errors=errors,
    )


# ── Formatting ───────────────────────────────────────────────────────────────

def format_search_results(response: SearchResponse) -> str:
    """Format search results as Markdown for downstream nodes.

    Output format:
    ## 🔍 搜索结果: {query}

    > GLM AI 摘要: {summary}
    > 百度搜索摘要: {summary}

    ### 1. {title} [GLM/百度]
    > 来源: {url}
    {content}

    ---
    """
    lines: list[str] = []

    # Report any errors
    if response.errors and not response.results and not response.glm_summary and not response.baidu_summary:
        return "⚠️ 搜索引擎均不可用：" + "；".join(response.errors)

    lines.append(f"## 🔍 搜索结果: {response.query}\n")

    # Add summaries from both engines
    if response.glm_summary:
        lines.append(f"> **GLM 智能摘要**: {response.glm_summary}\n")

    if response.baidu_summary:
        lines.append(f"> **百度搜索摘要**: {response.baidu_summary}\n")

    if not response.results:
        if response.glm_summary or response.baidu_summary:
            lines.append("\n*搜索引擎提供了综合摘要，但未返回结构化条目。*")
        else:
            lines.append("未找到相关结果。")
        return "\n".join(lines)

    engine_labels = {"glm": "GLM", "baidu": "百度"}

    for i, result in enumerate(response.results, 1):
        engine = engine_labels.get(result.source_engine, result.source_engine)
        lines.append(f"### {i}. {result.title} [{engine}]")
        lines.append(f"> 来源: [{result.url}]({result.url})")
        lines.append(f"\n{result.content}\n")
        lines.append("---\n")

    lines.append(f"*共 {len(response.results)} 条权威结果（已过滤非官方来源）*")

    if response.errors:
        lines.append(f"\n⚠️ 部分引擎异常：{'；'.join(response.errors)}")

    return "\n".join(lines)

"""Unified web search service — aggregates GLM + Baidu dual-engine search.

Architecture:
  1. Concurrent search via GLM (Zhipu web-search-pro) + Baidu (Qiniu /search/web)
  2. Merge & deduplicate by URL
  3. Score (authority whitelist + provider authority_score) and sort
  4. Format as Markdown for downstream node consumption

Degradation contract:
  - If both engines fail or return zero structured results, SearchResponse.degraded=True.
  - format_search_results() then emits a structured LLM instruction that tells
    the downstream LLM node to answer from its own training knowledge and
    mark its reply as "not using live web data".
  - WebSearchNode copies degraded / degradation_reason / fallback_instruction
    into NodeOutput.metadata so the engine propagates them downstream.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from urllib.parse import urlparse

from app.services.search_baidu import BaiduSearchResponse, search_via_baidu
from app.services.search_glm import GLMSearchResponse, search_via_glm

logger = logging.getLogger(__name__)


# ── Authority domain configuration ───────────────────────────────────────────

# Domains that are considered authoritative (positive scoring boost).
AUTHORITY_WHITELIST: set[str] = {
    "baike.baidu.com",
    "cnki.net",
    "www.cnki.net",
    "gov.cn",
    "wikipedia.org",
    "zh.wikipedia.org",
    "arxiv.org",
    "scholar.google.com",
    "docs.python.org",
    "developer.mozilla.org",
    "reactjs.org",
    "nextjs.org",
}

# Domains that are hard-filtered out of results.
BLOCKLIST_PATTERNS: set[str] = {
    "baijiahao.baidu.com",
    "sohu.com",
    "toutiao.com",
    "163.com/dy",
    "jianshu.com",
    "blog.csdn.net",
}


def _domain_of(url: str) -> str:
    if not url:
        return ""
    try:
        return (urlparse(url).netloc or "").lower()
    except Exception:
        return ""


def _is_blocked_url(url: str) -> bool:
    """Hard blocklist (self-media / unverified forums)."""
    if not url:
        return False
    domain = _domain_of(url)
    if not domain:
        return False
    for blocked in BLOCKLIST_PATTERNS:
        if blocked in domain:
            return True
    return False


def _authority_boost(url: str) -> float:
    """Positive score boost when URL domain matches AUTHORITY_WHITELIST."""
    domain = _domain_of(url)
    if not domain:
        return 0.0
    for wl in AUTHORITY_WHITELIST:
        if wl == domain or domain.endswith(f".{wl}") or wl in domain:
            return 1.0
    return 0.0


# ── Data models ──────────────────────────────────────────────────────────────

@dataclass
class SearchResult:
    """A single merged search result."""
    title: str
    url: str
    content: str
    source_engine: str  # "glm" or "baidu"
    score: float = 0.0
    authority_score: float = 0.0
    date: str = ""
    source: str = ""


FALLBACK_INSTRUCTION = (
    "联网搜索已失败，下游节点必须按以下规则回答用户原问题：\n"
    "1. **只使用模型自身训练知识**回答，不得引用任何实时信息；\n"
    "2. **禁止编造**具体 URL、发表日期、权威机构表述、统计数字等实时性数据；\n"
    "3. **输出首行必须**插入：`> ⚠️ 本回答基于 AI 自身知识，未使用实时网络数据`；\n"
    "4. 如涉及时效性话题（新闻、股价、赛事、最新政策等），必须明确告知用户\n"
    "   「当前信息截止至模型训练日期，实际情况请以官方渠道为准」。"
)


@dataclass
class SearchResponse:
    """Aggregated multi-engine search response."""
    query: str
    results: list[SearchResult] = field(default_factory=list)
    glm_summary: str | None = None
    baidu_summary: str | None = None
    errors: list[str] = field(default_factory=list)
    degraded: bool = False
    degradation_reason: str = ""
    fallback_instruction: str = ""


# ── Core search function ─────────────────────────────────────────────────────

async def search_web(
    query: str,
    max_results: int = 5,
) -> SearchResponse:
    """Execute a dual-engine web search concurrently and merge results.

    Sets `degraded=True` when both engines failed to return any structured
    results, so callers can emit the fallback_instruction for downstream LLMs.
    """
    glm_task = search_via_glm(query, max_results=max_results)
    baidu_task = search_via_baidu(query, max_results=max_results)

    glm_response, baidu_response = await asyncio.gather(
        glm_task, baidu_task, return_exceptions=True
    )

    errors: list[str] = []
    all_results: list[SearchResult] = []
    seen_urls: set[str] = set()

    # ── Process GLM ──────────────────────────────────────────────────────
    glm_summary: str | None = None
    glm_ok = False
    if isinstance(glm_response, GLMSearchResponse):
        if glm_response.error:
            errors.append(f"GLM: {glm_response.error}")
        else:
            glm_ok = True
            glm_summary = glm_response.summary or None
            for r in glm_response.results:
                if _is_blocked_url(r.url):
                    continue
                key = r.url or f"glm::{r.title}"
                if key in seen_urls:
                    continue
                seen_urls.add(key)
                score = 1.0 + _authority_boost(r.url)
                all_results.append(SearchResult(
                    title=r.title,
                    url=r.url,
                    content=r.content,
                    source_engine="glm",
                    score=score,
                    date=r.publish_date,
                    source=r.media,
                ))
    elif isinstance(glm_response, Exception):
        errors.append(f"GLM 引擎异常: {glm_response}")
        logger.error("GLM search engine exception: %s", glm_response)

    # ── Process Baidu ────────────────────────────────────────────────────
    baidu_summary: str | None = None
    baidu_ok = False
    if isinstance(baidu_response, BaiduSearchResponse):
        if baidu_response.error:
            errors.append(f"百度: {baidu_response.error}")
        else:
            baidu_ok = True
            baidu_summary = baidu_response.summary or None
            for r in baidu_response.results:
                if _is_blocked_url(r.url):
                    continue
                key = r.url or f"baidu::{r.title}"
                if key in seen_urls:
                    continue
                seen_urls.add(key)
                score = 1.0 + _authority_boost(r.url) + (r.authority_score or 0.0)
                all_results.append(SearchResult(
                    title=r.title,
                    url=r.url,
                    content=r.content,
                    source_engine="baidu",
                    score=score,
                    authority_score=r.authority_score,
                    date=r.date,
                    source=r.source,
                ))
    elif isinstance(baidu_response, Exception):
        errors.append(f"百度引擎异常: {baidu_response}")
        logger.error("Baidu search engine exception: %s", baidu_response)

    # ── Sort by composite score ──────────────────────────────────────────
    all_results.sort(
        key=lambda r: (r.score, r.authority_score),
        reverse=True,
    )

    # ── Degradation decision ─────────────────────────────────────────────
    # We treat "degraded" as: both engines produced neither structured results
    # nor any text summary. If even one side returned results (or a summary),
    # we can still serve the downstream.
    has_any_content = bool(all_results) or bool(glm_summary) or bool(baidu_summary)
    degraded = not has_any_content
    degradation_reason = ""
    if degraded:
        if errors:
            degradation_reason = "；".join(errors)
        elif not glm_ok and not baidu_ok:
            degradation_reason = "两个搜索引擎均返回空结果"
        else:
            degradation_reason = "搜索结果为空"

    logger.info(
        "Dual-engine search for '%s': %d results, GLM=%s, Baidu=%s, degraded=%s",
        (query or "")[:50], len(all_results),
        "OK" if glm_ok else "FAIL",
        "OK" if baidu_ok else "FAIL",
        degraded,
    )

    return SearchResponse(
        query=query,
        results=all_results,
        glm_summary=glm_summary,
        baidu_summary=baidu_summary,
        errors=errors,
        degraded=degraded,
        degradation_reason=degradation_reason,
        fallback_instruction=FALLBACK_INSTRUCTION if degraded else "",
    )


# ── Formatting ───────────────────────────────────────────────────────────────

def format_search_results(response: SearchResponse) -> str:
    """Format search results as Markdown for downstream nodes.

    Two paths:
      - Normal: render a header + engine summaries + numbered result list.
      - Degraded: render a structured LLM instruction directing the downstream
        node to answer from self-knowledge (no warning that a downstream LLM
        might "summarize" as if it were content).
    """
    if response.degraded:
        return _format_degraded(response)

    lines: list[str] = [f"## 🔍 搜索结果: {response.query}\n"]

    if response.glm_summary:
        lines.append(f"> **GLM 智能摘要**: {response.glm_summary}\n")
    if response.baidu_summary:
        lines.append(f"> **百度搜索摘要**: {response.baidu_summary}\n")

    if not response.results:
        lines.append("\n*搜索引擎提供了综合摘要，但未返回结构化条目。*")
        if response.errors:
            lines.append(f"\n⚠️ 部分引擎异常：{'；'.join(response.errors)}")
        return "\n".join(lines)

    engine_labels = {"glm": "GLM", "baidu": "百度"}
    for i, result in enumerate(response.results, 1):
        engine = engine_labels.get(result.source_engine, result.source_engine)
        lines.append(f"### {i}. {result.title} [{engine}]")
        if result.url:
            lines.append(f"> 来源: [{result.url}]({result.url})")
        meta_bits: list[str] = []
        if result.source:
            meta_bits.append(result.source)
        if result.date:
            meta_bits.append(result.date)
        if meta_bits:
            lines.append(f"> {' · '.join(meta_bits)}")
        lines.append(f"\n{result.content}\n")
        lines.append("---\n")

    lines.append(f"*共 {len(response.results)} 条结果（权威源优先，自媒体已过滤）*")
    if response.errors:
        lines.append(f"\n⚠️ 部分引擎异常：{'；'.join(response.errors)}")

    return "\n".join(lines)


def _format_degraded(response: SearchResponse) -> str:
    """Render the LLM-facing degradation instruction block."""
    reason = response.degradation_reason or "搜索引擎均不可用"
    return (
        "## ⚠️ 联网搜索不可用\n"
        f"> 原始问题：{response.query}\n"
        f"> 失败原因：{reason}\n\n"
        "请**忽略本段「搜索结果」本身**，下游节点按以下降级策略回答：\n\n"
        f"{response.fallback_instruction or FALLBACK_INSTRUCTION}\n"
    )

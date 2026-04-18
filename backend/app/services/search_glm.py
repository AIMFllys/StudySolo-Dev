"""Zhipu Web Search Pro — calls the dedicated /web_search REST endpoint.

Endpoint: POST {base_url}/web_search
(base_url example: https://open.bigmodel.cn/api/paas/v4)

Docs: docs/Plans/daily_plan/API/AI_API参考资料/10-智谱AI-Zhipu-OpenAI兼容接入.md
Also: https://docs.bigmodel.cn/cn/guide/tools/web-search

The previous implementation called chat.completions with
`tools=[{"type":"web_search","web_search":{"enable":True}}]` which is the
legacy 2024 shape and is silently dropped (or rejected) by strict SDK versions.
The response did not contain the `web_search` metadata, so the code fell
back to regex-parsing the model's hallucinated text.
The dedicated /web_search endpoint returns a structured `search_result`
array with title/link/content/refer/media/publish_date fields.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

import httpx

logger = logging.getLogger(__name__)


@dataclass
class GLMSearchResult:
    """A single structured search result from Zhipu web-search-pro."""
    title: str
    url: str
    content: str
    refer: str = ""
    media: str = ""
    publish_date: str = ""


@dataclass
class GLMSearchResponse:
    """Aggregated Zhipu search response."""
    query: str
    results: list[GLMSearchResult] = field(default_factory=list)
    summary: str = ""
    error: str | None = None


def _resolve_credentials() -> tuple[str, str]:
    """Resolve Zhipu credentials via config.yaml → .env fallback."""
    try:
        from app.core.config_loader import get_config
        zhipu_cfg = get_config().get("providers", {}).get("zhipu", {})
        api_key = str(zhipu_cfg.get("api_key", "")).strip()
        base_url = str(zhipu_cfg.get("base_url", "")).strip() or "https://open.bigmodel.cn/api/paas/v4"
    except Exception:
        api_key = os.getenv("ZHIPU_API_KEY", "")
        base_url = os.getenv("ZHIPU_BASE_URL", "https://open.bigmodel.cn/api/paas/v4")
    return api_key, base_url.rstrip("/")


def _parse_results(body: dict, max_results: int) -> list[GLMSearchResult]:
    """Extract structured results from Zhipu /web_search response body."""
    # The response shape: {"id": "...", "created": ..., "search_intent": [...],
    #   "search_result": [{"title","link","content","refer","media","publish_date", ...}]}
    raw_list = (
        body.get("search_result")
        or body.get("results")
        or body.get("data", {}).get("search_result")
        or []
    )
    parsed: list[GLMSearchResult] = []
    for item in raw_list[:max_results]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        url = str(item.get("link") or item.get("url") or "").strip()
        content = str(item.get("content") or item.get("snippet") or "").strip()
        if not (title or content):
            continue
        parsed.append(GLMSearchResult(
            title=title,
            url=url,
            content=content[:600],
            refer=str(item.get("refer") or "").strip(),
            media=str(item.get("media") or "").strip(),
            publish_date=str(item.get("publish_date") or "").strip(),
        ))
    return parsed


async def search_via_glm(
    query: str,
    max_results: int = 5,
) -> GLMSearchResponse:
    """Execute a web search via Zhipu's dedicated /web_search endpoint.

    Returns a structured GLMSearchResponse; on any provider-level failure
    the `error` field is populated (callers must NOT treat failure as empty
    results).
    """
    api_key, base_url = _resolve_credentials()
    if not api_key:
        logger.warning("ZHIPU_API_KEY not set, GLM search unavailable")
        return GLMSearchResponse(
            query=query,
            error="智谱搜索未配置（缺少 ZHIPU_API_KEY）",
        )

    # Zhipu constrains search_query to ≤70 chars; callers honoring count 1-50.
    trimmed_query = (query or "").strip()[:70]
    safe_count = max(1, min(int(max_results or 5), 50))

    payload: dict[str, Any] = {
        "search_query": trimmed_query,
        "search_engine": "search_pro",
        "search_recency_filter": "noLimit",
        "content_size": "medium",
        "count": safe_count,
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                f"{base_url}/web_search",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.HTTPError as e:
        logger.error("Zhipu web_search HTTP error for '%s': %s", trimmed_query[:60], e)
        return GLMSearchResponse(query=query, error=f"智谱搜索网络异常: {e}")

    if resp.status_code != 200:
        detail = resp.text[:200] if resp.text else ""
        logger.error(
            "Zhipu web_search returned HTTP %s for '%s': %s",
            resp.status_code, trimmed_query[:60], detail,
        )
        return GLMSearchResponse(
            query=query,
            error=f"智谱搜索 HTTP {resp.status_code}: {detail}",
        )

    try:
        body = resp.json()
    except ValueError:
        return GLMSearchResponse(query=query, error="智谱搜索返回非 JSON")

    if not isinstance(body, dict):
        return GLMSearchResponse(query=query, error="智谱搜索返回结构不合法")

    # Zhipu typically returns "error" / "code" on failure; preserve message.
    if isinstance(body.get("error"), dict):
        err_msg = str(body["error"].get("message") or body["error"])
        return GLMSearchResponse(query=query, error=f"智谱搜索失败: {err_msg}")

    results = _parse_results(body, safe_count)
    return GLMSearchResponse(
        query=query,
        results=results,
        summary="",
    )

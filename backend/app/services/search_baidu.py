"""Qiniu Baidu-backed full-web search — calls the dedicated /search/web REST endpoint.

Endpoint: POST {base_url}/search/web
Docs: docs/Plans/daily_plan/API/AI_API参考资料/七牛云-更详细指南.md/全网搜索API.md

This is NOT an OpenAI chat-completions call. The previous implementation
used chat.completions with extra_body.enable_search=True, which is a
DashScope-native parameter and is silently dropped by Qiniu's proxy —
the result was AI-hallucinated "search results" rather than real Baidu data.
The dedicated /search/web endpoint returns a structured results array with
title/url/content/date/source/authority_score fields.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

import httpx

logger = logging.getLogger(__name__)


@dataclass
class BaiduSearchResult:
    """A single Baidu search result returned by Qiniu /search/web."""
    title: str
    url: str
    content: str
    date: str = ""
    source: str = ""
    authority_score: float = 0.0


@dataclass
class BaiduSearchResponse:
    """Aggregated Baidu search response."""
    query: str
    results: list[BaiduSearchResult] = field(default_factory=list)
    summary: str = ""
    error: str | None = None


def _resolve_credentials() -> tuple[str, str]:
    """Resolve Qiniu AI credentials via config.yaml → .env fallback."""
    try:
        from app.core.config_loader import get_config
        qiniu_cfg = get_config().get("providers", {}).get("qiniu", {})
        api_key = str(qiniu_cfg.get("api_key", "")).strip()
        base_url = str(qiniu_cfg.get("base_url", "")).strip() or "https://api.qnaigc.com/v1"
    except Exception:
        api_key = os.getenv("QINIU_AI_API_KEY") or os.getenv("QINIU_API_KEY") or ""
        base_url = os.getenv("QINIU_BASE_URL") or "https://api.qnaigc.com/v1"
    return api_key, base_url.rstrip("/")


def _coerce_authority(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _parse_results(data: dict, max_results: int) -> list[BaiduSearchResult]:
    """Map Qiniu /search/web response to structured results."""
    raw_results = data.get("results") or []
    parsed: list[BaiduSearchResult] = []
    for item in raw_results[:max_results]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        url = str(item.get("url") or item.get("link") or "").strip()
        content = str(item.get("content") or item.get("snippet") or "").strip()
        if not (title or content):
            continue
        parsed.append(BaiduSearchResult(
            title=title,
            url=url,
            content=content[:600],
            date=str(item.get("date") or "").strip(),
            source=str(item.get("source") or "").strip(),
            authority_score=_coerce_authority(item.get("authority_score")),
        ))
    return parsed


async def search_via_baidu(
    query: str,
    max_results: int = 5,
) -> BaiduSearchResponse:
    """Execute a Baidu full-web search through Qiniu's /search/web endpoint.

    Returns a structured BaiduSearchResponse; on any provider-level failure
    the `error` field is populated (callers must NOT treat failure as empty
    results — the search_service layer decides degradation behavior).
    """
    api_key, base_url = _resolve_credentials()
    if not api_key:
        logger.warning("Qiniu API key not set, Baidu search unavailable")
        return BaiduSearchResponse(
            query=query,
            error="百度搜索未配置（缺少 QINIU_AI_API_KEY / QINIU_API_KEY）",
        )

    # Qiniu supports max_results up to 50; keep callers honest.
    safe_max = max(1, min(int(max_results or 5), 50))
    payload: dict[str, Any] = {
        "query": query,
        "max_results": safe_max,
        "search_type": "web",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{base_url}/search/web",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.HTTPError as e:
        logger.error("Baidu search HTTP error for '%s': %s", query[:60], e)
        return BaiduSearchResponse(query=query, error=f"百度搜索网络异常: {e}")

    if resp.status_code != 200:
        detail = resp.text[:200] if resp.text else ""
        logger.error(
            "Baidu search returned HTTP %s for '%s': %s",
            resp.status_code, query[:60], detail,
        )
        return BaiduSearchResponse(
            query=query,
            error=f"百度搜索 HTTP {resp.status_code}: {detail}",
        )

    try:
        body = resp.json()
    except ValueError:
        return BaiduSearchResponse(query=query, error="百度搜索返回非 JSON")

    if not isinstance(body, dict):
        return BaiduSearchResponse(query=query, error="百度搜索返回结构不合法")

    if body.get("success") is False:
        msg = str(body.get("message") or "unknown")
        return BaiduSearchResponse(query=query, error=f"百度搜索失败: {msg}")

    data = body.get("data")
    if not isinstance(data, dict):
        return BaiduSearchResponse(query=query, error="百度搜索返回缺少 data 字段")

    results = _parse_results(data, safe_max)
    return BaiduSearchResponse(
        query=query,
        results=results,
        summary="",
    )

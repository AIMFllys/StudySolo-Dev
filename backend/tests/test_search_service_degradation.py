"""Tests for the search_service degradation contract.

Exercises the three key branches of search_web:
  - Both engines succeed → degraded=False, results merged/deduplicated
  - Only one engine succeeds → degraded=False (still serves downstream)
  - Both engines fail → degraded=True, fallback_instruction populated,
    format_search_results emits the structured LLM instruction block
"""

from __future__ import annotations

import pytest

from app.services import search_service as svc
from app.services.search_baidu import BaiduSearchResponse, BaiduSearchResult
from app.services.search_glm import GLMSearchResponse, GLMSearchResult


async def _async_return(value):
    return value


@pytest.mark.asyncio
async def test_both_engines_success_merges_and_deduplicates(monkeypatch: pytest.MonkeyPatch) -> None:
    glm = GLMSearchResponse(
        query="python",
        results=[GLMSearchResult(
            title="Python docs",
            url="https://docs.python.org/3/",
            content="Python docs",
            media="docs.python.org",
        )],
    )
    baidu = BaiduSearchResponse(
        query="python",
        results=[
            BaiduSearchResult(
                title="Python docs (dup)",
                url="https://docs.python.org/3/",  # duplicate URL
                content="dup body",
            ),
            BaiduSearchResult(
                title="Python 基础",
                url="https://baike.baidu.com/item/python",
                content="百度百科条目",
                authority_score=0.9,
            ),
        ],
    )

    async def _fake_glm(q, max_results=5):
        return glm

    async def _fake_baidu(q, max_results=5):
        return baidu

    monkeypatch.setattr(svc, "search_via_glm", _fake_glm)
    monkeypatch.setattr(svc, "search_via_baidu", _fake_baidu)

    resp = await svc.search_web("python")

    assert resp.degraded is False
    assert resp.fallback_instruction == ""
    # Dedup by URL — Python docs only counted once
    urls = {r.url for r in resp.results}
    assert urls == {
        "https://docs.python.org/3/",
        "https://baike.baidu.com/item/python",
    }
    # baidu baike url should get authority whitelist boost → appears first
    assert resp.results[0].url.startswith("https://baike.baidu.com")


@pytest.mark.asyncio
async def test_single_engine_failure_does_not_degrade(monkeypatch: pytest.MonkeyPatch) -> None:
    glm = GLMSearchResponse(query="q", error="upstream 500")
    baidu = BaiduSearchResponse(
        query="q",
        results=[BaiduSearchResult(
            title="only-hit", url="https://example.com/a", content="body",
        )],
    )

    async def _fake_glm(q, max_results=5):
        return glm

    async def _fake_baidu(q, max_results=5):
        return baidu

    monkeypatch.setattr(svc, "search_via_glm", _fake_glm)
    monkeypatch.setattr(svc, "search_via_baidu", _fake_baidu)

    resp = await svc.search_web("q")

    assert resp.degraded is False
    assert len(resp.results) == 1
    assert resp.errors and any("GLM" in e for e in resp.errors)


@pytest.mark.asyncio
async def test_both_engines_fail_triggers_degradation(monkeypatch: pytest.MonkeyPatch) -> None:
    glm = GLMSearchResponse(query="q", error="401 unauthorized")
    baidu = BaiduSearchResponse(query="q", error="conn refused")

    async def _fake_glm(q, max_results=5):
        return glm

    async def _fake_baidu(q, max_results=5):
        return baidu

    monkeypatch.setattr(svc, "search_via_glm", _fake_glm)
    monkeypatch.setattr(svc, "search_via_baidu", _fake_baidu)

    resp = await svc.search_web("q")

    assert resp.degraded is True
    assert resp.fallback_instruction  # non-empty
    assert "401" in resp.degradation_reason or "conn" in resp.degradation_reason
    assert resp.results == []


@pytest.mark.asyncio
async def test_engine_raising_exception_is_captured(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_glm(q, max_results=5):
        raise RuntimeError("glm boom")

    async def _fake_baidu(q, max_results=5):
        raise RuntimeError("baidu boom")

    monkeypatch.setattr(svc, "search_via_glm", _fake_glm)
    monkeypatch.setattr(svc, "search_via_baidu", _fake_baidu)

    resp = await svc.search_web("q")

    assert resp.degraded is True
    assert any("glm" in e.lower() or "引擎异常" in e for e in resp.errors)
    assert any("baidu" in e.lower() or "引擎异常" in e for e in resp.errors)


def test_format_degraded_emits_llm_instruction_block() -> None:
    resp = svc.SearchResponse(
        query="最新 AI 新闻",
        degraded=True,
        degradation_reason="all engines down",
        fallback_instruction=svc.FALLBACK_INSTRUCTION,
    )
    out = svc.format_search_results(resp)
    assert "联网搜索不可用" in out
    assert "最新 AI 新闻" in out
    assert "基于 AI 自身知识" in out
    assert "all engines down" in out


def test_format_normal_renders_results() -> None:
    resp = svc.SearchResponse(
        query="q",
        results=[svc.SearchResult(
            title="T", url="https://example.com", content="body",
            source_engine="glm", score=1.0,
        )],
    )
    out = svc.format_search_results(resp)
    assert "搜索结果: q" in out
    assert "T" in out
    assert "example.com" in out


def test_is_blocked_url_filters_self_media() -> None:
    assert svc._is_blocked_url("https://baijiahao.baidu.com/abc") is True
    assert svc._is_blocked_url("https://baike.baidu.com/abc") is False


def test_authority_boost_whitelisted_domain_scores_one() -> None:
    assert svc._authority_boost("https://zh.wikipedia.org/wiki/x") > 0.0
    assert svc._authority_boost("https://some-random-site.io/") == 0.0

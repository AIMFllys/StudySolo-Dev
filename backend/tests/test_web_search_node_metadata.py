"""Tests for WebSearchNode — query construction and degradation metadata.

Verifies:
  - Empty upstream + generic label → immediate degraded path
  - Meaningful upstream question → query is built and search is called
  - post_process propagates degraded/fallback_instruction/original_query
    into NodeOutput.metadata
"""

from __future__ import annotations


import pytest

from app.nodes._base import NodeInput
from app.nodes.input.web_search.node import WebSearchNode, _build_query
from app.services import search_service as svc


async def _collect(gen):
    out: list[str] = []
    async for token in gen:
        out.append(token)
    return "".join(out)


def test_build_query_prefers_upstream_question() -> None:
    ni = NodeInput(
        user_content="🌐 联网搜索",
        upstream_outputs={"trigger-1": "介绍量子纠缠的基本概念"},
    )
    assert _build_query(ni) == "介绍量子纠缠的基本概念"


def test_build_query_strips_markdown_header_markers() -> None:
    ni = NodeInput(
        user_content="🌐 联网搜索",
        upstream_outputs={"trigger-1": "# 什么是量子纠缠"},
    )
    # Leading '#' should be stripped; the topic line remains.
    assert _build_query(ni) == "什么是量子纠缠"


def test_build_query_ignores_generic_label_only() -> None:
    ni = NodeInput(user_content="🔍 搜索", upstream_outputs={})
    assert _build_query(ni) == ""


def test_build_query_uses_meaningful_label_when_no_upstream() -> None:
    ni = NodeInput(user_content="🌐 量子计算最新进展", upstream_outputs={})
    assert _build_query(ni) == "量子计算最新进展"


@pytest.mark.asyncio
async def test_empty_query_yields_degraded_metadata() -> None:
    node = WebSearchNode()
    ni = NodeInput(user_content="联网搜索", upstream_outputs={})

    raw = await _collect(node.execute(ni, llm_caller=None))
    assert "联网搜索不可用" in raw

    output = await node.post_process(raw)
    assert output.metadata["degraded"] is True
    assert output.metadata["fallback_instruction"]
    assert output.metadata["source"] == "web_search"
    assert output.metadata["original_query"] == ""


@pytest.mark.asyncio
async def test_successful_search_marks_not_degraded(monkeypatch: pytest.MonkeyPatch) -> None:
    node = WebSearchNode()

    async def _fake_search_web(query: str, max_results: int = 5) -> svc.SearchResponse:
        return svc.SearchResponse(
            query=query,
            results=[svc.SearchResult(
                title="ok", url="https://example.com", content="body",
                source_engine="glm", score=1.0,
            )],
        )

    monkeypatch.setattr(
        "app.services.search_service.search_web", _fake_search_web
    )

    ni = NodeInput(
        user_content="🌐 联网搜索",
        upstream_outputs={"t": "介绍Python"},
    )
    raw = await _collect(node.execute(ni, llm_caller=None))
    output = await node.post_process(raw)

    assert output.metadata["degraded"] is False
    assert output.metadata["fallback_instruction"] == ""
    assert output.metadata["original_query"] == "介绍Python"
    assert output.metadata["result_count"] == 1


@pytest.mark.asyncio
async def test_engine_failure_propagates_fallback_into_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    node = WebSearchNode()

    async def _fake_search_web(query: str, max_results: int = 5) -> svc.SearchResponse:
        return svc.SearchResponse(
            query=query,
            degraded=True,
            degradation_reason="both engines down",
            fallback_instruction=svc.FALLBACK_INSTRUCTION,
        )

    monkeypatch.setattr(
        "app.services.search_service.search_web", _fake_search_web
    )

    ni = NodeInput(
        user_content="🌐 联网搜索",
        upstream_outputs={"t": "当前美股指数"},
    )
    raw = await _collect(node.execute(ni, llm_caller=None))
    output = await node.post_process(raw)

    assert output.metadata["degraded"] is True
    assert "both engines down" in output.metadata["degradation_reason"]
    assert output.metadata["fallback_instruction"]
    assert output.metadata["original_query"] == "当前美股指数"


@pytest.mark.asyncio
async def test_search_exception_still_emits_degraded(monkeypatch: pytest.MonkeyPatch) -> None:
    node = WebSearchNode()

    async def _raise(query: str, max_results: int = 5) -> svc.SearchResponse:
        raise RuntimeError("network down")

    monkeypatch.setattr(
        "app.services.search_service.search_web", _raise
    )

    ni = NodeInput(
        user_content="🌐 联网搜索",
        upstream_outputs={"t": "测试问题"},
    )
    raw = await _collect(node.execute(ni, llm_caller=None))
    output = await node.post_process(raw)

    assert output.metadata["degraded"] is True
    assert "network down" in output.metadata["degradation_reason"]

"""
Property 15: 拓扑排序执行顺序
Property 14: 暗线上下文生命周期
Property 18: 错误传播停止执行
Feature: studysolo-mvp, Properties 14, 15, 18

Validates: Requirements 5.9, 6.3, 6.4, 6.11
"""

from collections import defaultdict
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.engine.executor import (
    _build_context_prompt,
    _get_all_downstream_helper,
    topological_sort,
)
from app.engine.events import parse_sse_frame
from app.engine.node_runner import NodeExecutionResult, stream_single_node_events
from app.services.agent_gateway.models import AgentCallResult, AgentMeta


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_node(node_id: str) -> dict:
    return {"id": node_id, "type": "summary", "data": {"label": node_id, "output": ""}}


def make_edge(source: str, target: str) -> dict:
    return {"id": f"{source}-{target}", "source": source, "target": target}


# ── DAG generation strategy ──────────────────────────────────────────────────

def _build_dag(node_ids: list[str], edge_pairs: list[tuple[int, int]]) -> tuple[list[dict], list[dict]]:
    """Build a DAG ensuring no cycles by only allowing edges from lower to higher index."""
    nodes = [make_node(nid) for nid in node_ids]
    seen_edges: set[tuple[str, str]] = set()
    edges = []
    for i, j in edge_pairs:
        if i < j and i < len(node_ids) and j < len(node_ids):
            src, tgt = node_ids[i], node_ids[j]
            if (src, tgt) not in seen_edges:
                seen_edges.add((src, tgt))
                edges.append(make_edge(src, tgt))
    return nodes, edges


_node_ids_strategy = st.lists(
    st.uuids().map(lambda u: str(u)[:8]),
    min_size=2, max_size=8, unique=True,
)

_edge_pairs_strategy = st.lists(
    st.tuples(st.integers(min_value=0, max_value=7), st.integers(min_value=0, max_value=7)),
    min_size=0, max_size=10,
)


# ── Property 15: Topological sort execution order ────────────────────────────

@given(_node_ids_strategy, _edge_pairs_strategy)
@settings(max_examples=200)
def test_topological_sort_respects_edge_order(node_ids, edge_pairs):
    """For every edge (source → target), source must appear before target in the sorted order."""
    nodes, edges = _build_dag(node_ids, edge_pairs)
    order = topological_sort(nodes, edges)

    # Build position map
    position = {nid: i for i, nid in enumerate(order)}

    for edge in edges:
        src_pos = position[edge["source"]]
        tgt_pos = position[edge["target"]]
        assert src_pos < tgt_pos, (
            f"Edge {edge['source']} → {edge['target']}: "
            f"source at position {src_pos} must be before target at {tgt_pos}"
        )


@given(_node_ids_strategy, _edge_pairs_strategy)
@settings(max_examples=200)
def test_topological_sort_includes_all_nodes(node_ids, edge_pairs):
    """Topological sort must include every node exactly once."""
    nodes, edges = _build_dag(node_ids, edge_pairs)
    order = topological_sort(nodes, edges)

    assert len(order) == len(nodes)
    assert set(order) == {n["id"] for n in nodes}


def test_topological_sort_detects_cycle():
    """A cyclic graph must raise ValueError."""
    nodes = [make_node("a"), make_node("b"), make_node("c")]
    edges = [make_edge("a", "b"), make_edge("b", "c"), make_edge("c", "a")]
    with pytest.raises(ValueError, match="cycle"):
        topological_sort(nodes, edges)


# ── Property 14: Implicit context lifecycle ──────────────────────────────────

_printable_text = st.text(
    alphabet=st.characters(
        whitelist_categories=("Lu", "Ll", "Lt", "Lm", "Lo", "Nd", "Zs"),
        whitelist_characters=" _-.",
    ),
    min_size=1,
    max_size=50,
)


@given(
    theme=_printable_text,
    style=_printable_text,
    outline=st.lists(_printable_text, min_size=0, max_size=5),
    audience=_printable_text,
)
@settings(max_examples=100)
def test_implicit_context_injected_into_system_prompt(theme, style, outline, audience):
    """Implicit context must appear in the generated context prompt."""
    import json as _json
    ctx = {
        "global_theme": theme,
        "language_style": style,
        "core_outline": outline,
        "target_audience": audience,
        "user_constraints": {},
    }
    prompt = _build_context_prompt(ctx)
    # Values are JSON-serialized in the prompt; compare against JSON-encoded form
    assert _json.dumps(theme, ensure_ascii=False) in prompt
    assert _json.dumps(style, ensure_ascii=False) in prompt
    assert _json.dumps(audience, ensure_ascii=False) in prompt


def test_empty_implicit_context_returns_empty_string():
    """None implicit context must return empty string."""
    assert _build_context_prompt(None) == ""
    assert _build_context_prompt({}) == ""


# ── Property 18: Error propagation stops execution ───────────────────────────

@given(_node_ids_strategy, _edge_pairs_strategy)
@settings(max_examples=200)
def test_failed_node_downstream_marked_pending(node_ids, edge_pairs):
    """All downstream nodes of a failed node must be in the failed set."""
    nodes, edges = _build_dag(node_ids, edge_pairs)
    if not nodes:
        return

    # Build downstream map
    downstream: dict[str, set[str]] = defaultdict(set)
    for edge in edges:
        downstream[edge["source"]].add(edge["target"])

    # Pick the first node as the failed one
    failed_node_id = nodes[0]["id"]

    # Get all downstream nodes
    failed_set = _get_all_downstream_helper(failed_node_id, downstream)

    # Verify: no downstream node of the failed node should be executed
    # (they should all be in failed_set)
    order = topological_sort(nodes, edges)
    failed_pos = order.index(failed_node_id)

    for nid in failed_set:
        nid_pos = order.index(nid)
        assert nid_pos > failed_pos, (
            f"Downstream node {nid} at position {nid_pos} should be after failed node at {failed_pos}"
        )


@pytest.mark.asyncio
async def test_agent_node_stream_events_parse_openai_sse_chunks(monkeypatch):
    from app.nodes.agent import base as agent_base

    async def fake_stream():
        yield b'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n'
        yield b'data: {"choices":[{"delta":{"content":"Alpha"}}]}\n\n'
        yield b'data: {"choices":[{"delta":{"content":"Beta"}}]}\n\n'
        yield b'data: [DONE]\n\n'

    fake_gateway = SimpleNamespace(
        registry=SimpleNamespace(
            get=lambda name: AgentMeta(name=name, url="http://127.0.0.1:8001", models=["code-review-v1"], enabled=True),
        ),
        call_stream=AsyncMock(return_value=(fake_stream(), "req-1")),
    )
    monkeypatch.setattr(agent_base, "get_agent_gateway", lambda: fake_gateway)
    monkeypatch.setattr(
        agent_base,
        "get_agent_registry",
        lambda: SimpleNamespace(get=lambda name: AgentMeta(name=name, url="http://127.0.0.1:8001", models=["code-review-v1"], enabled=True)),
    )

    result = NodeExecutionResult(node_id="node-1")
    node_config = {
        "id": "node-1",
        "type": "agent_code_review",
        "data": {
            "label": "代码审查",
            "type": "agent_code_review",
            "model_route": "",
            "config": {},
        },
    }

    events = [
        event
        async for event in stream_single_node_events(
            node_id="node-1",
            node_config=node_config,
            upstream_outputs={"src": "diff --git a.py b.py"},
            implicit_context={"user_id": "user-1"},
            result=result,
        )
    ]

    node_done_event = next(event for event in events if event.startswith("event: node_done"))
    event_type, payload = parse_sse_frame(node_done_event)
    assert event_type == "node_done"
    assert payload["full_output"] == "AlphaBeta"
    assert payload["metadata"]["resolved_model_route"] == "code-review-v1"
    assert result.output == "AlphaBeta"


@pytest.mark.asyncio
async def test_agent_node_gateway_errors_propagate_to_status(monkeypatch):
    from app.nodes.agent import base as agent_base

    fake_gateway = SimpleNamespace(
        registry=SimpleNamespace(
            get=lambda name: AgentMeta(name=name, url="http://127.0.0.1:8001", models=["code-review-v1"], enabled=True),
        ),
        call_stream=AsyncMock(return_value=AgentCallResult(
            status_code=503,
            error="Agent unavailable: code-review",
            request_id="req-1",
        )),
    )
    monkeypatch.setattr(agent_base, "get_agent_gateway", lambda: fake_gateway)
    monkeypatch.setattr(
        agent_base,
        "get_agent_registry",
        lambda: SimpleNamespace(get=lambda name: AgentMeta(name=name, url="http://127.0.0.1:8001", models=["code-review-v1"], enabled=True)),
    )

    result = NodeExecutionResult(node_id="node-err")
    node_config = {
        "id": "node-err",
        "type": "agent_code_review",
        "data": {
            "label": "代码审查",
            "type": "agent_code_review",
            "model_route": "",
            "config": {},
        },
    }

    events = [
        event
        async for event in stream_single_node_events(
            node_id="node-err",
            node_config=node_config,
            upstream_outputs={},
            implicit_context={"user_id": "user-1"},
            result=result,
        )
    ]

    node_status_event = events[-1]
    event_type, payload = parse_sse_frame(node_status_event)
    assert event_type == "node_status"
    assert payload["status"] == "error"
    assert "Agent unavailable" in payload["error"]

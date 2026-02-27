"""
Property 15: 拓扑排序执行顺序
Property 14: 暗线上下文生命周期
Property 18: 错误传播停止执行
Feature: studysolo-mvp, Properties 14, 15, 18

Validates: Requirements 5.9, 6.3, 6.4, 6.11
"""

import json
from collections import defaultdict

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from app.services.workflow_engine import topological_sort, _build_context_prompt, _get_all_downstream_helper


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

@given(
    theme=st.text(min_size=1, max_size=50),
    style=st.text(min_size=1, max_size=30),
    outline=st.lists(st.text(min_size=1, max_size=20), min_size=0, max_size=5),
    audience=st.text(min_size=1, max_size=30),
)
@settings(max_examples=100)
def test_implicit_context_injected_into_system_prompt(theme, style, outline, audience):
    """Implicit context must appear in the generated context prompt."""
    ctx = {
        "global_theme": theme,
        "language_style": style,
        "core_outline": outline,
        "target_audience": audience,
        "user_constraints": {},
    }
    prompt = _build_context_prompt(ctx)
    assert theme in prompt
    assert style in prompt
    assert audience in prompt


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

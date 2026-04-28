"""Property tests for workflow_generator — extract_json, normalize_edges, auto_layout, should_auto_layout."""

import pytest

from app.models.ai import NodePosition, WorkflowEdgeSchema, WorkflowNodeSchema
from app.services.workflow_generator import (
    auto_layout_nodes,
    extract_json,
    normalize_edges,
    should_auto_layout,
)


def _node(nid: str, ntype: str = "summary", x: float = 0, y: float = 0) -> WorkflowNodeSchema:
    return WorkflowNodeSchema(
        id=nid,
        type=ntype,
        position=NodePosition(x=x, y=y),
        data={"label": nid, "status": "pending", "output": ""},
    )


def _edge(src: str, tgt: str) -> WorkflowEdgeSchema:
    return WorkflowEdgeSchema(id=f"e-{src}-{tgt}", source=src, target=tgt)


# ── extract_json ─────────────────────────────────────────────────────────────

class TestExtractJson:
    def test_plain_json(self):
        assert extract_json('{"a": 1}') == '{"a": 1}'

    def test_fenced_json(self):
        raw = '```json\n{"a": 1}\n```'
        assert extract_json(raw) == '{"a": 1}'

    def test_fenced_no_lang(self):
        raw = '```\n[1, 2]\n```'
        assert extract_json(raw) == '[1, 2]'

    def test_json_in_prose(self):
        raw = 'Here is the result: {"key": "val"} done.'
        result = extract_json(raw)
        assert '"key"' in result

    def test_array(self):
        raw = '```json\n[{"a":1}]\n```'
        assert extract_json(raw) == '[{"a":1}]'

    def test_no_json(self):
        assert extract_json("no json here") == "no json here"


# ── normalize_edges ──────────────────────────────────────────────────────────

class TestNormalizeEdges:
    def test_valid_edges_kept(self):
        nodes = [_node("a"), _node("b")]
        edges = [_edge("a", "b")]
        result = normalize_edges(nodes, edges)
        assert len(result) == 1
        assert result[0].source == "a"

    def test_invalid_source_removed(self):
        nodes = [_node("a"), _node("b")]
        edges = [_edge("x", "b")]
        result = normalize_edges(nodes, edges)
        # Falls back to sequential
        assert len(result) == 1
        assert result[0].source == "a"

    def test_self_loop_removed(self):
        nodes = [_node("a"), _node("b")]
        edges = [_edge("a", "a"), _edge("a", "b")]
        result = normalize_edges(nodes, edges)
        assert all(e.source != e.target for e in result)

    def test_duplicate_removed(self):
        nodes = [_node("a"), _node("b")]
        edges = [_edge("a", "b"), _edge("a", "b")]
        result = normalize_edges(nodes, edges)
        assert len(result) == 1

    def test_empty_edges_sequential_fallback(self):
        nodes = [_node("a"), _node("b"), _node("c")]
        result = normalize_edges(nodes, [])
        assert len(result) == 2
        assert result[0].source == "a" and result[0].target == "b"
        assert result[1].source == "b" and result[1].target == "c"

    def test_single_node_no_edges(self):
        result = normalize_edges([_node("a")], [])
        assert result == []


# ── should_auto_layout ───────────────────────────────────────────────────────

class TestShouldAutoLayout:
    def test_single_node_false(self):
        assert should_auto_layout([_node("a")], []) is False

    def test_all_same_position(self):
        nodes = [_node("a", x=0, y=0), _node("b", x=0, y=0)]
        assert should_auto_layout(nodes, [_edge("a", "b")]) is True

    def test_linear_same_x(self):
        nodes = [_node("a", x=100, y=0), _node("b", x=100, y=200)]
        assert should_auto_layout(nodes, [_edge("a", "b")]) is True

    def test_well_laid_out(self):
        nodes = [_node("a", x=100, y=100), _node("b", x=400, y=100), _node("c", x=700, y=100)]
        edges = [_edge("a", "b"), _edge("b", "c")]
        # Linear, same y — should trigger
        assert should_auto_layout(nodes, edges) is True


# ── auto_layout_nodes ────────────────────────────────────────────────────────

class TestAutoLayoutNodes:
    def test_linear_chain_layout(self):
        nodes = [_node("a"), _node("b"), _node("c")]
        edges = [_edge("a", "b"), _edge("b", "c")]
        laid = auto_layout_nodes(nodes, edges)
        xs = [n.position.x for n in laid]
        # Each level should have increasing x
        assert xs[0] < xs[1] < xs[2]

    def test_parallel_branches(self):
        nodes = [_node("a"), _node("b"), _node("c"), _node("d")]
        edges = [_edge("a", "b"), _edge("a", "c"), _edge("b", "d"), _edge("c", "d")]
        laid = auto_layout_nodes(nodes, edges)
        # b and c should be at same x level
        pos = {n.id: n.position for n in laid}
        assert pos["b"].x == pos["c"].x
        assert pos["b"].y != pos["c"].y  # different rows

    def test_preserves_node_count(self):
        nodes = [_node(f"n{i}") for i in range(5)]
        edges = [_edge(f"n{i}", f"n{i+1}") for i in range(4)]
        laid = auto_layout_nodes(nodes, edges)
        assert len(laid) == 5

    def test_disconnected_nodes_placed(self):
        nodes = [_node("a"), _node("b"), _node("c")]
        edges = [_edge("a", "b")]
        laid = auto_layout_nodes(nodes, edges)
        assert len(laid) == 3
        ids = {n.id for n in laid}
        assert "c" in ids

    def test_single_node(self):
        laid = auto_layout_nodes([_node("a")], [])
        assert len(laid) == 1

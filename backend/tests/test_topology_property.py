"""Property tests for app.engine.topology — topological sort, branch filtering, wait helpers."""

import pytest

from app.engine.topology import (
    MAX_WAIT_SECONDS,
    get_branch_filtered_downstream,
    get_max_wait_seconds,
    topological_sort,
    topological_sort_levels,
)
from app.engine.context import build_downstream_map


# ── helpers ──────────────────────────────────────────────────────────────────

def _n(nid: str, parent_id: str | None = None) -> dict:
    """Shorthand node dict."""
    d: dict = {"id": nid}
    if parent_id:
        d["parentId"] = parent_id
    return d


def _e(src: str, tgt: str, *, branch: str = "", wait: float = 0) -> dict:
    """Shorthand edge dict."""
    d: dict = {"source": src, "target": tgt, "data": {}}
    if branch:
        d["data"]["branch"] = branch
    if wait:
        d["data"]["waitSeconds"] = wait
    return d


# ── topological_sort_levels ──────────────────────────────────────────────────

class TestTopologicalSortLevels:
    def test_single_node(self):
        levels = topological_sort_levels([_n("a")], [])
        assert levels == [["a"]]

    def test_linear_chain(self):
        nodes = [_n("a"), _n("b"), _n("c")]
        edges = [_e("a", "b"), _e("b", "c")]
        levels = topological_sort_levels(nodes, edges)
        assert levels == [["a"], ["b"], ["c"]]

    def test_diamond_dag(self):
        """a → b, a → c, b → d, c → d"""
        nodes = [_n("a"), _n("b"), _n("c"), _n("d")]
        edges = [_e("a", "b"), _e("a", "c"), _e("b", "d"), _e("c", "d")]
        levels = topological_sort_levels(nodes, edges)
        assert levels[0] == ["a"]
        assert set(levels[1]) == {"b", "c"}
        assert levels[2] == ["d"]

    def test_parallel_roots(self):
        nodes = [_n("a"), _n("b"), _n("c")]
        edges = [_e("a", "c"), _e("b", "c")]
        levels = topological_sort_levels(nodes, edges)
        assert set(levels[0]) == {"a", "b"}
        assert levels[1] == ["c"]

    def test_cycle_raises(self):
        nodes = [_n("a"), _n("b")]
        edges = [_e("a", "b"), _e("b", "a")]
        with pytest.raises(ValueError, match="cycle"):
            topological_sort_levels(nodes, edges)

    def test_self_loop_raises(self):
        nodes = [_n("a")]
        edges = [_e("a", "a")]
        with pytest.raises(ValueError, match="cycle"):
            topological_sort_levels(nodes, edges)

    def test_child_nodes_excluded(self):
        """Nodes with parentId should be excluded from top-level sort."""
        nodes = [_n("loop"), _n("child1", parent_id="loop"), _n("child2", parent_id="loop"), _n("after")]
        edges = [_e("loop", "after")]
        levels = topological_sort_levels(nodes, edges)
        flat = [nid for lvl in levels for nid in lvl]
        assert "child1" not in flat
        assert "child2" not in flat
        assert "loop" in flat
        assert "after" in flat

    def test_edges_involving_children_ignored(self):
        nodes = [_n("a"), _n("b"), _n("c1", parent_id="a")]
        edges = [_e("c1", "b"), _e("a", "b")]
        levels = topological_sort_levels(nodes, edges)
        flat = [nid for lvl in levels for nid in lvl]
        assert "c1" not in flat

    def test_empty_graph(self):
        levels = topological_sort_levels([], [])
        assert levels == []

    def test_disconnected_nodes(self):
        nodes = [_n("a"), _n("b"), _n("c")]
        levels = topological_sort_levels(nodes, [])
        assert len(levels) == 1
        assert set(levels[0]) == {"a", "b", "c"}

    def test_wide_fan_out(self):
        """a → b1..b5, all b → c"""
        nodes = [_n("a")] + [_n(f"b{i}") for i in range(5)] + [_n("c")]
        edges = [_e("a", f"b{i}") for i in range(5)] + [_e(f"b{i}", "c") for i in range(5)]
        levels = topological_sort_levels(nodes, edges)
        assert levels[0] == ["a"]
        assert set(levels[1]) == {f"b{i}" for i in range(5)}
        assert levels[2] == ["c"]

    def test_complex_multi_level(self):
        """a→b, a→c, b→d, c→d, d→e, d→f, e→g, f→g"""
        nodes = [_n(x) for x in "abcdefg"]
        edges = [
            _e("a", "b"), _e("a", "c"), _e("b", "d"), _e("c", "d"),
            _e("d", "e"), _e("d", "f"), _e("e", "g"), _e("f", "g"),
        ]
        levels = topological_sort_levels(nodes, edges)
        flat = [nid for lvl in levels for nid in lvl]
        assert flat.index("a") < flat.index("b") < flat.index("d") < flat.index("e") < flat.index("g")
        assert flat.index("a") < flat.index("c") < flat.index("d") < flat.index("f") < flat.index("g")


# ── topological_sort (flat) ──────────────────────────────────────────────────

class TestTopologicalSort:
    def test_flat_preserves_order(self):
        nodes = [_n("a"), _n("b"), _n("c")]
        edges = [_e("a", "b"), _e("b", "c")]
        result = topological_sort(nodes, edges)
        assert result == ["a", "b", "c"]

    def test_flat_empty(self):
        assert topological_sort([], []) == []


# ── get_max_wait_seconds ─────────────────────────────────────────────────────

class TestGetMaxWaitSeconds:
    def test_no_incoming_edges(self):
        assert get_max_wait_seconds("a", []) == 0.0

    def test_single_wait(self):
        edges = [_e("a", "b", wait=5)]
        assert get_max_wait_seconds("b", edges) == 5.0

    def test_max_of_multiple(self):
        edges = [_e("a", "c", wait=3), _e("b", "c", wait=7)]
        assert get_max_wait_seconds("c", edges) == 7.0

    def test_capped_at_max(self):
        edges = [_e("a", "b", wait=9999)]
        assert get_max_wait_seconds("b", edges) == MAX_WAIT_SECONDS

    def test_negative_ignored(self):
        edges = [{"source": "a", "target": "b", "data": {"waitSeconds": -5}}]
        assert get_max_wait_seconds("b", edges) == 0.0

    def test_non_numeric_ignored(self):
        edges = [{"source": "a", "target": "b", "data": {"waitSeconds": "abc"}}]
        assert get_max_wait_seconds("b", edges) == 0.0

    def test_missing_data_key(self):
        edges = [{"source": "a", "target": "b"}]
        assert get_max_wait_seconds("b", edges) == 0.0

    def test_zero_wait(self):
        edges = [_e("a", "b", wait=0)]
        assert get_max_wait_seconds("b", edges) == 0.0


# ── get_branch_filtered_downstream ───────────────────────────────────────────

class TestBranchFilteredDownstream:
    def _build(self, edges):
        return build_downstream_map(edges)

    def test_skip_non_chosen_branch(self):
        """switch → A (branch=yes), switch → B (branch=no); choose yes → skip B"""
        edges = [
            _e("switch", "A", branch="yes"),
            _e("switch", "B", branch="no"),
            _e("B", "C"),
        ]
        dm = self._build(edges)
        skipped = get_branch_filtered_downstream("switch", "yes", edges, dm)
        assert "B" in skipped
        assert "C" in skipped
        assert "A" not in skipped

    def test_no_skip_when_branch_matches(self):
        edges = [
            _e("switch", "A", branch="yes"),
            _e("switch", "B", branch="no"),
        ]
        dm = self._build(edges)
        skipped = get_branch_filtered_downstream("switch", "yes", edges, dm)
        assert "A" not in skipped

    def test_edge_without_branch_always_active(self):
        edges = [
            _e("switch", "A"),
            _e("switch", "B", branch="no"),
        ]
        dm = self._build(edges)
        skipped = get_branch_filtered_downstream("switch", "yes", edges, dm)
        assert "A" not in skipped
        assert "B" in skipped

    def test_shared_downstream_not_skipped(self):
        """switch → A (yes), switch → B (no), A → merge, B → merge; merge should NOT be skipped."""
        edges = [
            _e("switch", "A", branch="yes"),
            _e("switch", "B", branch="no"),
            _e("A", "merge"),
            _e("B", "merge"),
        ]
        dm = self._build(edges)
        skipped = get_branch_filtered_downstream("switch", "yes", edges, dm)
        assert "B" in skipped
        assert "merge" not in skipped

    def test_case_insensitive_branch(self):
        edges = [
            _e("switch", "A", branch="Yes"),
            _e("switch", "B", branch="No"),
        ]
        dm = self._build(edges)
        skipped = get_branch_filtered_downstream("switch", "yes", edges, dm)
        assert "A" not in skipped
        assert "B" in skipped

    def test_no_branches_nothing_skipped(self):
        edges = [_e("switch", "A"), _e("switch", "B")]
        dm = self._build(edges)
        skipped = get_branch_filtered_downstream("switch", "yes", edges, dm)
        assert len(skipped) == 0

    def test_deep_downstream_chain_skipped(self):
        edges = [
            _e("switch", "A", branch="yes"),
            _e("switch", "B", branch="no"),
            _e("B", "C"),
            _e("C", "D"),
            _e("D", "E"),
        ]
        dm = self._build(edges)
        skipped = get_branch_filtered_downstream("switch", "yes", edges, dm)
        assert {"B", "C", "D", "E"} <= skipped

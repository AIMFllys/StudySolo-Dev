"""Property tests for app.engine.context — upstream/downstream maps and transitive closure."""

from app.engine.context import build_downstream_map, build_upstream_map, get_all_downstream


def _e(src: str, tgt: str) -> dict:
    return {"source": src, "target": tgt}


# ── build_upstream_map ───────────────────────────────────────────────────────

class TestBuildUpstreamMap:
    def test_empty(self):
        assert build_upstream_map([]) == {}

    def test_single_edge(self):
        m = build_upstream_map([_e("a", "b")])
        assert m == {"b": ["a"]}

    def test_multiple_sources(self):
        m = build_upstream_map([_e("a", "c"), _e("b", "c")])
        assert set(m["c"]) == {"a", "b"}

    def test_chain(self):
        m = build_upstream_map([_e("a", "b"), _e("b", "c")])
        assert m["b"] == ["a"]
        assert m["c"] == ["b"]
        assert "a" not in m

    def test_fan_out(self):
        m = build_upstream_map([_e("a", "b"), _e("a", "c")])
        assert m["b"] == ["a"]
        assert m["c"] == ["a"]


# ── build_downstream_map ─────────────────────────────────────────────────────

class TestBuildDownstreamMap:
    def test_empty(self):
        assert build_downstream_map([]) == {}

    def test_single_edge(self):
        m = build_downstream_map([_e("a", "b")])
        assert m == {"a": {"b"}}

    def test_fan_out(self):
        m = build_downstream_map([_e("a", "b"), _e("a", "c")])
        assert m["a"] == {"b", "c"}

    def test_chain(self):
        m = build_downstream_map([_e("a", "b"), _e("b", "c")])
        assert m["a"] == {"b"}
        assert m["b"] == {"c"}

    def test_diamond(self):
        m = build_downstream_map([_e("a", "b"), _e("a", "c"), _e("b", "d"), _e("c", "d")])
        assert m["a"] == {"b", "c"}
        assert m["b"] == {"d"}
        assert m["c"] == {"d"}


# ── get_all_downstream ───────────────────────────────────────────────────────

class TestGetAllDownstream:
    def test_empty_map(self):
        assert get_all_downstream("a", {}) == set()

    def test_no_downstream(self):
        dm = {"a": {"b"}}
        assert get_all_downstream("b", dm) == set()

    def test_linear_chain(self):
        dm = {"a": {"b"}, "b": {"c"}, "c": {"d"}}
        assert get_all_downstream("a", dm) == {"b", "c", "d"}

    def test_diamond(self):
        dm = {"a": {"b", "c"}, "b": {"d"}, "c": {"d"}}
        assert get_all_downstream("a", dm) == {"b", "c", "d"}

    def test_cycle_terminates(self):
        """Even with a cycle in the map, BFS should terminate (visited check)."""
        dm = {"a": {"b"}, "b": {"a"}}
        result = get_all_downstream("a", dm)
        assert "b" in result
        assert "a" in result

    def test_deep_chain(self):
        dm = {f"n{i}": {f"n{i+1}"} for i in range(100)}
        result = get_all_downstream("n0", dm)
        assert len(result) == 100
        assert "n100" in result

    def test_wide_fan(self):
        dm = {"root": {f"c{i}" for i in range(50)}}
        result = get_all_downstream("root", dm)
        assert len(result) == 50

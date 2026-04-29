"""Property tests for app.engine.level_runner — _finalize_node_result logic."""


from app.engine.level_runner import _finalize_node_result
from app.engine.node_runner import NodeExecutionResult


def _e(src: str, tgt: str, *, branch: str = "") -> dict:
    d: dict = {"source": src, "target": tgt, "data": {}}
    if branch:
        d["data"]["branch"] = branch
    return d


class TestFinalizeNodeResult:
    """Unit tests for the synchronous _finalize_node_result helper."""

    def _base_kwargs(self, edges=None):
        from app.engine.context import build_downstream_map
        edges = edges or []
        return dict(
            edges=edges,
            downstream_map=build_downstream_map(edges),
            accumulated_outputs={},
            error_nodes=set(),
            failed_nodes=set(),
            skipped_nodes=set(),
            accumulated_metadata={},
        )

    def test_success_stores_output(self):
        result = NodeExecutionResult(node_id="n1", output="hello")
        kw = self._base_kwargs()
        _finalize_node_result("n1", {"type": "summary"}, result, **kw)
        assert kw["accumulated_outputs"]["n1"] == "hello"
        assert "n1" not in kw["error_nodes"]

    def test_error_marks_node_and_downstream(self):
        edges = [_e("n1", "n2"), _e("n2", "n3")]
        result = NodeExecutionResult(node_id="n1", error="boom")
        kw = self._base_kwargs(edges)
        _finalize_node_result("n1", {"type": "summary"}, result, **kw)
        assert "n1" in kw["error_nodes"]
        assert "n2" in kw["failed_nodes"]
        assert "n3" in kw["failed_nodes"]

    def test_none_output_stored_as_empty(self):
        result = NodeExecutionResult(node_id="n1", output=None)
        kw = self._base_kwargs()
        _finalize_node_result("n1", {"type": "summary"}, result, **kw)
        assert kw["accumulated_outputs"]["n1"] == ""

    def test_metadata_stored(self):
        result = NodeExecutionResult(node_id="n1", output="ok", metadata={"key": "val"})
        kw = self._base_kwargs()
        _finalize_node_result("n1", {"type": "summary"}, result, **kw)
        assert kw["accumulated_metadata"]["n1"] == {"key": "val"}

    def test_logic_switch_skips_non_chosen_branch(self):
        edges = [
            _e("sw", "A", branch="yes"),
            _e("sw", "B", branch="no"),
            _e("B", "C"),
        ]
        result = NodeExecutionResult(node_id="sw", output="ok", metadata={"branch": "yes"})
        kw = self._base_kwargs(edges)
        _finalize_node_result("sw", {"type": "logic_switch"}, result, **kw)
        assert "B" in kw["skipped_nodes"]
        assert "C" in kw["skipped_nodes"]
        assert "A" not in kw["skipped_nodes"]

    def test_logic_switch_no_branch_metadata_no_skip(self):
        edges = [_e("sw", "A", branch="yes"), _e("sw", "B", branch="no")]
        result = NodeExecutionResult(node_id="sw", output="ok", metadata={})
        kw = self._base_kwargs(edges)
        _finalize_node_result("sw", {"type": "logic_switch"}, result, **kw)
        assert len(kw["skipped_nodes"]) == 0

    def test_error_does_not_store_output(self):
        result = NodeExecutionResult(node_id="n1", error="fail", output="partial")
        kw = self._base_kwargs()
        _finalize_node_result("n1", {"type": "summary"}, result, **kw)
        assert "n1" not in kw["accumulated_outputs"]
        assert "n1" in kw["error_nodes"]

    def test_accumulated_metadata_none_safe(self):
        """When accumulated_metadata is None, should not crash."""
        result = NodeExecutionResult(node_id="n1", output="ok", metadata={"k": "v"})
        kw = self._base_kwargs()
        kw["accumulated_metadata"] = None
        _finalize_node_result("n1", {"type": "summary"}, result, **kw)
        assert kw["accumulated_outputs"]["n1"] == "ok"

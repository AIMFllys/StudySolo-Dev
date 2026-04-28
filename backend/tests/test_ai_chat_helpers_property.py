"""Property tests for app.services.ai_chat.helpers — JSON extraction, reasoning sanitizer, canvas summary."""

import json
from types import SimpleNamespace

from app.services.ai_chat.helpers import (
    ReasoningStreamSanitizer,
    build_canvas_summary,
    extract_json_obj,
    strip_reasoning_blocks,
)


# ── extract_json_obj ─────────────────────────────────────────────────────────

class TestExtractJsonObj:
    def test_plain_json(self):
        assert extract_json_obj('{"a": 1}') == {"a": 1}

    def test_fenced_json(self):
        assert extract_json_obj('```json\n{"a": 1}\n```') == {"a": 1}

    def test_json_in_prose(self):
        result = extract_json_obj('Here: {"key": "val"} done.')
        assert result == {"key": "val"}

    def test_nested_json(self):
        raw = '{"outer": {"inner": 1}}'
        assert extract_json_obj(raw)["outer"]["inner"] == 1

    def test_invalid_json_raises(self):
        import pytest
        with pytest.raises(json.JSONDecodeError):
            extract_json_obj("not json at all")


# ── strip_reasoning_blocks ───────────────────────────────────────────────────

class TestStripReasoningBlocks:
    def test_removes_thinking(self):
        text = "before<thinking>secret</thinking>after"
        assert strip_reasoning_blocks(text) == "beforeafter"

    def test_removes_think(self):
        text = "<think>hmm</think>answer"
        assert strip_reasoning_blocks(text) == "answer"

    def test_removes_reasoning(self):
        text = "a<reasoning>step</reasoning>b"
        assert strip_reasoning_blocks(text) == "ab"

    def test_no_tags_unchanged(self):
        text = "plain text"
        assert strip_reasoning_blocks(text) == "plain text"

    def test_case_insensitive(self):
        text = "<THINKING>x</THINKING>y"
        assert strip_reasoning_blocks(text) == "y"

    def test_multiple_blocks(self):
        text = "<think>a</think>mid<thinking>b</thinking>end"
        assert strip_reasoning_blocks(text) == "midend"


# ── ReasoningStreamSanitizer ─────────────────────────────────────────────────

class TestReasoningStreamSanitizer:
    def test_plain_text_passthrough(self):
        s = ReasoningStreamSanitizer()
        assert s.feed("hello") == "hello"

    def test_strips_thinking_block(self):
        s = ReasoningStreamSanitizer()
        result = s.feed("<thinking>secret</thinking>answer")
        assert "secret" not in result
        assert "answer" in result

    def test_incremental_feeding(self):
        s = ReasoningStreamSanitizer()
        parts = []
        parts.append(s.feed("<think"))
        parts.append(s.feed("ing>hidden"))
        parts.append(s.feed("</thinking>"))
        parts.append(s.feed("visible"))
        full = "".join(parts)
        assert "hidden" not in full
        assert "visible" in full

    def test_flush_clears_buffer(self):
        s = ReasoningStreamSanitizer()
        s.feed("<thinking>partial")
        result = s.flush()
        assert "partial" not in result

    def test_non_reasoning_tags_preserved(self):
        s = ReasoningStreamSanitizer()
        result = s.feed("<b>bold</b>")
        assert "<b>" in result
        assert "bold" in result

    def test_empty_input(self):
        s = ReasoningStreamSanitizer()
        assert s.feed("") == ""


# ── build_canvas_summary ─────────────────────────────────────────────────────

class TestBuildCanvasSummary:
    def test_none_context(self):
        assert build_canvas_summary(None) == "Canvas is empty."

    def test_empty_nodes(self):
        ctx = SimpleNamespace(
            workflow_name="Test", workflow_id="w1",
            nodes=[], execution_status=None,
            dag_description=None, selected_node_id=None,
        )
        result = build_canvas_summary(ctx)
        assert "Test" in result
        assert "empty" in result.lower()

    def test_with_nodes(self):
        node = SimpleNamespace(
            index=0, id="n1", type="summary", label="总结",
            status="done", upstream_labels=["输入"],
            downstream_labels=[], has_output=True,
            output_preview="preview...",
            position={"x": 100, "y": 200},
        )
        ctx = SimpleNamespace(
            workflow_name="WF", workflow_id="w1",
            nodes=[node], execution_status="completed",
            dag_description="linear", selected_node_id="n1",
        )
        result = build_canvas_summary(ctx)
        assert "总结" in result
        assert "summary" in result
        assert "Selected" in result

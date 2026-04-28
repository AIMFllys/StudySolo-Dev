"""Property tests for engine/events.py — SSE event formatting and parsing."""

import json

from app.engine.events import sse_event, event_message, parse_sse_frame


class TestSseEvent:
    def test_basic_format(self):
        result = sse_event("node_status", {"node_id": "n1", "status": "running"})
        assert result.startswith("event: node_status\n")
        assert "data: " in result
        assert result.endswith("\n\n")

    def test_data_is_valid_json(self):
        result = sse_event("test", {"key": "val"})
        data_line = [l for l in result.split("\n") if l.startswith("data: ")][0]
        parsed = json.loads(data_line[6:])
        assert parsed["key"] == "val"

    def test_chinese_not_escaped(self):
        result = sse_event("test", {"msg": "你好"})
        assert "你好" in result

    def test_meta_merged(self):
        result = sse_event("test", {"a": 1}, {"group": "g1"})
        data_line = [l for l in result.split("\n") if l.startswith("data: ")][0]
        parsed = json.loads(data_line[6:])
        assert parsed["a"] == 1
        assert parsed["group"] == "g1"

    def test_none_meta_ignored(self):
        result = sse_event("test", {"a": 1}, None)
        data_line = [l for l in result.split("\n") if l.startswith("data: ")][0]
        parsed = json.loads(data_line[6:])
        assert "group" not in parsed

    def test_meta_none_values_stripped(self):
        result = sse_event("test", {"a": 1}, {"b": None, "c": "ok"})
        data_line = [l for l in result.split("\n") if l.startswith("data: ")][0]
        parsed = json.loads(data_line[6:])
        assert "b" not in parsed
        assert parsed["c"] == "ok"


class TestEventMessage:
    def test_returns_dict(self):
        msg = event_message("node_done", {"node_id": "n1"})
        assert msg["event"] == "node_done"
        assert isinstance(msg["data"], str)
        parsed = json.loads(msg["data"])
        assert parsed["node_id"] == "n1"


class TestParseSseFrame:
    def test_parse_valid(self):
        frame = 'event: node_status\ndata: {"node_id":"n1","status":"done"}'
        event_type, payload = parse_sse_frame(frame)
        assert event_type == "node_status"
        assert payload["node_id"] == "n1"

    def test_no_data(self):
        frame = "event: heartbeat"
        event_type, payload = parse_sse_frame(frame)
        assert event_type == "heartbeat"
        assert payload is None

    def test_no_event_type(self):
        frame = 'data: {"key":"val"}'
        event_type, payload = parse_sse_frame(frame)
        assert event_type is None
        assert payload["key"] == "val"

    def test_roundtrip(self):
        original = {"node_id": "n1", "status": "running"}
        frame = sse_event("node_status", original)
        event_type, payload = parse_sse_frame(frame)
        assert event_type == "node_status"
        assert payload["node_id"] == "n1"
        assert payload["status"] == "running"

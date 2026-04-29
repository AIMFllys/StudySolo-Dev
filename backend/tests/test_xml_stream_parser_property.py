"""Property tests for app.services.ai_chat.xml_stream_parser."""


from app.services.ai_chat.xml_stream_parser import XmlStreamParser, TOP_LEVEL_TAGS


class TestBasicText:
    def test_plain_text(self):
        p = XmlStreamParser()
        events = p.feed("hello world")
        assert events == [{"type": "text", "delta": "hello world"}]

    def test_empty_token(self):
        p = XmlStreamParser()
        assert p.feed("") == []

    def test_multiple_plain_tokens(self):
        p = XmlStreamParser()
        e1 = p.feed("hello ")
        e2 = p.feed("world")
        assert e1 == [{"type": "text", "delta": "hello "}]
        assert e2 == [{"type": "text", "delta": "world"}]


class TestTopLevelTags:
    def test_thinking_segment(self):
        p = XmlStreamParser()
        events = p.feed("<thinking>I need to think</thinking>")
        types = [e["type"] for e in events]
        assert "segment_start" in types
        assert "segment_delta" in types
        assert "segment_end" in types
        start = next(e for e in events if e["type"] == "segment_start")
        assert start["tag"] == "thinking"

    def test_answer_segment(self):
        p = XmlStreamParser()
        events = p.feed("<answer>The answer is 42</answer>")
        deltas = [e["delta"] for e in events if e["type"] == "segment_delta"]
        assert "The answer is 42" in "".join(deltas)

    def test_all_top_level_tags_recognized(self):
        for tag in TOP_LEVEL_TAGS:
            p = XmlStreamParser()
            events = p.feed(f"<{tag}>content</{tag}>")
            tags = [e.get("tag") for e in events if e["type"] == "segment_start"]
            assert tag in tags, f"Tag {tag} not recognized"


class TestTagAliases:
    def test_think_alias(self):
        p = XmlStreamParser()
        events = p.feed("<think>deep thought</think>")
        start = next(e for e in events if e["type"] == "segment_start")
        assert start["tag"] == "thinking"

    def test_reasoning_alias(self):
        p = XmlStreamParser()
        events = p.feed("<reasoning>step by step</reasoning>")
        start = next(e for e in events if e["type"] == "segment_start")
        assert start["tag"] == "thinking"


class TestToolUse:
    def test_tool_call_ready(self):
        p = XmlStreamParser()
        xml = '<tool_use name="rename_workflow"><params>{"new_name": "test"}</params></tool_use>'
        events = p.feed(xml)
        ready = [e for e in events if e["type"] == "tool_call_ready"]
        assert len(ready) == 1
        assert ready[0]["tool"] == "rename_workflow"
        assert ready[0]["params"] == {"new_name": "test"}

    def test_tool_name_from_child(self):
        p = XmlStreamParser()
        xml = "<tool_use><name>my_tool</name><params>{}</params></tool_use>"
        events = p.feed(xml)
        ready = next(e for e in events if e["type"] == "tool_call_ready")
        assert ready["tool"] == "my_tool"

    def test_tool_invalid_json_params(self):
        p = XmlStreamParser()
        xml = '<tool_use name="t"><params>not json</params></tool_use>'
        events = p.feed(xml)
        ready = next(e for e in events if e["type"] == "tool_call_ready")
        assert "_raw" in ready["params"]

    def test_tool_empty_params(self):
        p = XmlStreamParser()
        xml = '<tool_use name="t"></tool_use>'
        events = p.feed(xml)
        ready = next(e for e in events if e["type"] == "tool_call_ready")
        assert ready["params"] == {}

    def test_tool_call_id_generated(self):
        p = XmlStreamParser()
        xml = '<tool_use name="t"></tool_use>'
        events = p.feed(xml)
        ready = next(e for e in events if e["type"] == "tool_call_ready")
        assert ready["call_id"].startswith("tc-")

    def test_tool_call_id_from_attr(self):
        p = XmlStreamParser()
        xml = '<tool_use name="t" call_id="my-id"></tool_use>'
        events = p.feed(xml)
        ready = next(e for e in events if e["type"] == "tool_call_ready")
        assert ready["call_id"] == "my-id"


class TestIncrementalFeeding:
    def test_split_across_tokens(self):
        p = XmlStreamParser()
        e1 = p.feed("<think")
        e2 = p.feed("ing>hel")
        e3 = p.feed("lo</thinking>")
        all_events = e1 + e2 + e3
        deltas = [e["delta"] for e in all_events if e["type"] == "segment_delta"]
        assert "hello" in "".join(deltas)

    def test_split_in_middle_of_tag(self):
        p = XmlStreamParser()
        p.feed("<ans")
        p.feed("wer>")
        events = p.feed("text</answer>")
        deltas = [e["delta"] for e in events if e["type"] == "segment_delta"]
        assert "text" in "".join(deltas)


class TestClose:
    def test_close_flushes_buffer(self):
        p = XmlStreamParser()
        p.feed("<thinking>unclosed")
        events = p.close()
        assert any(e["type"] == "segment_end" for e in events)

    def test_close_on_empty(self):
        p = XmlStreamParser()
        assert p.close() == []

    def test_close_flushes_remaining_text(self):
        p = XmlStreamParser()
        p.feed("trailing text")
        events = p.close()
        # Buffer was already flushed in feed, close should be empty
        assert events == []


class TestEdgeCases:
    def test_unknown_root_tag_wraps_in_answer(self):
        p = XmlStreamParser()
        events = p.feed("<unknown>content</unknown>")
        starts = [e for e in events if e["type"] == "segment_start"]
        assert any(e["tag"] == "answer" for e in starts)

    def test_done_tag(self):
        p = XmlStreamParser()
        events = p.feed("<done/>")
        assert any(e["type"] == "done" for e in events)

    def test_self_closing_tag(self):
        p = XmlStreamParser()
        events = p.feed("<done />")
        assert any(e["type"] == "done" for e in events)

    def test_stray_close_tag_ignored(self):
        p = XmlStreamParser()
        events = p.feed("</nonexistent>")
        # Should not crash
        assert isinstance(events, list)

    def test_nested_tags(self):
        p = XmlStreamParser()
        events = p.feed("<tool_use><name>test</name></tool_use>")
        paths = [e.get("tag") for e in events if e["type"] == "segment_start"]
        assert "tool_use" in paths
        assert "tool_use.name" in paths

    def test_comment_lines_ignored(self):
        """SSE comment lines starting with : should be handled."""
        p = XmlStreamParser()
        events = p.feed("<thinking>: comment\nreal text</thinking>")
        deltas = "".join(e.get("delta", "") for e in events if e["type"] == "segment_delta")
        assert "real text" in deltas

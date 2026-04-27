"""Property tests for news-agent models and progress SSE."""

import sys
from pathlib import Path

# Ensure src is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from core.news.models import (
    CreateResponseRequest,
    ResponseObject,
    AVAILABLE_MODELS,
)
from core.news.progress_sse import ProgressSSE


class TestCreateResponseRequest:
    def test_get_topic_string(self):
        req = CreateResponseRequest(input="AI news")
        assert req.get_topic() == "AI news"

    def test_get_topic_message_array(self):
        req = CreateResponseRequest(input=[{"role": "user", "content": "test topic"}])
        assert req.get_topic() == "test topic"

    def test_get_topic_input_text_format(self):
        req = CreateResponseRequest(input=[
            {"role": "user", "content": [{"type": "input_text", "text": "deep topic"}]}
        ])
        assert req.get_topic() == "deep topic"

    def test_get_topic_empty(self):
        req = CreateResponseRequest(input=[{"role": "system", "content": "sys"}])
        assert req.get_topic() == ""

    def test_get_depth_quick(self):
        assert CreateResponseRequest(input="x", model="last30days-quick").get_depth() == "quick"

    def test_get_depth_deep(self):
        assert CreateResponseRequest(input="x", model="last30days-deep").get_depth() == "deep"

    def test_get_depth_default(self):
        assert CreateResponseRequest(input="x", model="last30days").get_depth() == "default"

    def test_output_mode_streaming(self):
        assert CreateResponseRequest(input="x", stream=True).get_output_mode() == "streaming"

    def test_output_mode_background(self):
        assert CreateResponseRequest(input="x", stream=False, background=True).get_output_mode() == "background"

    def test_output_mode_sync(self):
        assert CreateResponseRequest(input="x").get_output_mode() == "sync"


class TestResponseObject:
    def test_error_response(self):
        resp = ResponseObject.error_response("boom", "test_error")
        assert resp.status == "failed"
        assert resp.error["message"] == "boom"

    def test_queued(self):
        assert ResponseObject.queued().status == "queued"

    def test_id_generated(self):
        assert ResponseObject().id.startswith("resp_")


class TestAvailableModels:
    def test_three_models(self):
        assert len(AVAILABLE_MODELS.data) == 3

    def test_model_ids(self):
        ids = {m.id for m in AVAILABLE_MODELS.data}
        assert {"last30days-quick", "last30days", "last30days-deep"} <= ids


class TestProgressSSE:
    def test_push_and_read(self):
        p = ProgressSSE()
        p.start_reddit()
        assert "Reddit" in p.get_queue().get_nowait()

    def test_mark_done(self):
        p = ProgressSSE()
        p.mark_done()
        assert p.is_done() is True
        assert p.get_queue().get_nowait() is None

    def test_error_message(self):
        p = ProgressSSE()
        p.show_error("test error")
        assert "test error" in p.get_queue().get_nowait()

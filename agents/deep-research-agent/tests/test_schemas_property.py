"""Property tests for deep-research-agent schemas."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from schemas.request import ChatCompletionRequest, ResearchConfig, ChatMessage
from schemas.response import (
    ChatCompletionResponse, ChatCompletionChoice, UsageInfo,
    AgentHTTPError, ErrorResponse, AgentError,
    HealthResponse, new_chat_completion_id,
)


class TestResearchConfig:
    def test_defaults(self):
        c = ResearchConfig()
        assert c.depth == "standard"
        assert c.language == "zh-CN"
        assert c.max_sources == 15
        assert c.focus_areas == []


class TestChatCompletionRequest:
    def test_defaults(self):
        r = ChatCompletionRequest()
        assert r.stream is True
        assert r.format == "default"

    def test_with_messages(self):
        r = ChatCompletionRequest(messages=[
            ChatMessage(role="user", content="研究 AI")
        ])
        assert len(r.messages) == 1

    def test_with_research_config(self):
        r = ChatCompletionRequest(
            research_config=ResearchConfig(depth="deep", max_sources=30)
        )
        assert r.research_config.depth == "deep"


class TestChatCompletionResponse:
    def test_build(self):
        resp = ChatCompletionResponse(
            model="research-agent",
            choices=[ChatCompletionChoice(
                message={"role": "assistant", "content": "result"}
            )],
            usage=UsageInfo(prompt_tokens=10, completion_tokens=20, total_tokens=30),
        )
        assert resp.choices[0].message.content == "result"
        assert resp.usage.total_tokens == 30
        assert resp.id.startswith("chatcmpl-")


class TestAgentHTTPError:
    def test_attributes(self):
        err = AgentHTTPError(503, "unavailable", "service_error", "agent_down")
        assert err.status_code == 503
        assert err.code == "agent_down"
        assert isinstance(err, Exception)


class TestHealthResponse:
    def test_defaults(self):
        h = HealthResponse(agent="deep-research", version="1.0", uptime_seconds=100, models=["m1"])
        assert h.status == "ok"


class TestNewChatCompletionId:
    def test_format(self):
        cid = new_chat_completion_id()
        assert cid.startswith("chatcmpl-")
        assert len(cid) > 15

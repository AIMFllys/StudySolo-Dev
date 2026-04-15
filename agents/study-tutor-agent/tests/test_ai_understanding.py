import asyncio

from src.core.ai_understanding import (
    AIUnderstandingSettings,
    AIUnderstandingError,
    call_openai_compatible_understanding,
    has_live_ai_understanding_configuration,
    parse_ai_understanding_payload,
)
from src.core.agent import StudyTutorAgent


def test_has_live_ai_understanding_configuration_requires_complete_settings():
    settings = AIUnderstandingSettings(
        backend="openai_compatible",
        model="test-model",
        base_url="https://example.test/v1",
        api_key="secret",
    )

    assert has_live_ai_understanding_configuration(settings) is True


def test_parse_ai_understanding_payload_returns_understanding_result():
    result = parse_ai_understanding_payload(
        '{"primary_topic":"格雷码","related_topics":["二进制编码"],"user_intent":"clarify_confusion","difficulty_state":"confused","focus":"先澄清核心概念。"}'
    )

    assert result.topic == "格雷码"
    assert result.primary_topic == "格雷码"
    assert result.related_topics == ("二进制编码",)
    assert result.user_intent == "clarify_confusion"
    assert result.difficulty_state == "confused"


def test_call_openai_compatible_understanding_with_fake_httpx(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": '{"primary_topic":"格雷码","related_topics":[],"user_intent":"review","difficulty_state":"reviewing","focus":"先快速回顾核心框架。"}'
                        }
                    }
                ]
            }

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url, headers, json):
            assert url == "https://example.test/v1/chat/completions"
            assert json["model"] == "test-model"
            return FakeResponse()

    monkeypatch.setattr("src.core.ai_understanding.httpx.AsyncClient", FakeAsyncClient)

    result = asyncio.run(
        call_openai_compatible_understanding(
            settings=AIUnderstandingSettings(
                backend="openai_compatible",
                model="test-model",
                base_url="https://example.test/v1",
                api_key="secret",
                timeout_seconds=10,
            ),
            user_message="请帮我复习一下格雷码",
        ),
    )

    assert result.topic == "格雷码"
    assert result.related_topics == ()
    assert result.user_intent == "review"
    assert result.difficulty_state == "reviewing"


def test_agent_falls_back_to_heuristic_understanding_and_logs_warning(monkeypatch, caplog):
    async def fake_call_openai_compatible_understanding(*, settings, user_message):
        raise AIUnderstandingError("ai understanding exploded")

    monkeypatch.setattr(
        "src.core.agent.call_openai_compatible_understanding",
        fake_call_openai_compatible_understanding,
    )

    agent = StudyTutorAgent(
        agent_name="study-tutor",
        ai_understanding_settings=AIUnderstandingSettings(
            backend="openai_compatible",
            model="test-model",
            base_url="https://example.test/v1",
            api_key="secret",
        ),
    )

    with caplog.at_level("WARNING", logger="src.core.agent"):
        understanding = asyncio.run(agent._understand_request("请帮我复习牛顿第二定律"))

    assert understanding.topic == "牛顿第二定律"
    assert understanding.user_intent == "review"
    assert any(
        "AI understanding failed, fallback to heuristic" in record.getMessage()
        and "AIUnderstandingError" in record.getMessage()
        for record in caplog.records
    )

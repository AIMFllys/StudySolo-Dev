import asyncio

from src.core.ai_understanding import (
    AIUnderstandingSettings,
    call_openai_compatible_understanding,
    has_live_ai_understanding_configuration,
    parse_ai_understanding_payload,
)


def test_has_live_ai_understanding_configuration_requires_complete_settings():
    settings = AIUnderstandingSettings(
        backend="openai_compatible",
        model="test-model",
        base_url="https://example.test/v1",
        api_key="secret",
    )

    assert has_live_ai_understanding_configuration(settings) is True


def test_parse_ai_understanding_payload_returns_page_understanding():
    result = parse_ai_understanding_payload(
        '{"page_topic":"学习报告","page_goal":"清晰展示学习成果和阶段总结。","page_type":"report_page","style_direction":"clean"}'
    )

    assert result.page_topic == "学习报告"
    assert result.page_type == "report_page"
    assert result.style_direction == "clean"


def test_call_openai_compatible_understanding_with_fake_httpx(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": '{"page_topic":"学习报告","page_goal":"清晰展示学习成果和阶段总结。","page_type":"report_page","style_direction":"clean"}'
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
            user_message="请帮我做一个展示学习报告的网页",
        )
    )

    assert result.page_topic == "学习报告"
    assert result.page_type == "report_page"

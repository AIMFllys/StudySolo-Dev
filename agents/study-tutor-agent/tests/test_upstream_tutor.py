import asyncio

from src.core.agent import StudyTutorAgent
from src.core.types import UnderstandingResult
from src.core.upstream_tutor import (
    UpstreamTutorError,
    UpstreamTutorSettings,
    build_upstream_tutor_request,
    call_openai_compatible_tutor,
    has_live_upstream_configuration,
    parse_upstream_tutor_payload,
)


def test_has_live_upstream_configuration_requires_complete_settings():
    settings = UpstreamTutorSettings(
        backend="upstream_openai_compatible",
        model="test-model",
        base_url="https://example.test/v1",
        api_key="secret",
    )

    assert has_live_upstream_configuration(settings) is True


def test_build_upstream_tutor_request_uses_understanding_result():
    request = build_upstream_tutor_request(
        settings=UpstreamTutorSettings(
            backend="upstream_reserved",
            model="test-model",
            base_url="https://example.test/v1",
            api_key="secret",
        ),
        understanding=UnderstandingResult(
            primary_topic="格雷码",
            related_topics=(),
            user_intent="review",
            difficulty_state="reviewing",
            focus="先回顾核心框架。",
        ),
    )

    assert request.model == "test-model"
    assert "Topic: 格雷码" in request.messages[1]["content"]
    assert "Related topics: (none)" in request.messages[1]["content"]


def test_parse_upstream_tutor_payload_returns_tutor_plan():
    plan = parse_upstream_tutor_payload(
        '{"topic":"格雷码","focus":"先回顾核心框架。","definition":"定义","core_idea":"核心","common_confusion":"误区","first_step":"步骤1","next_step":"步骤2","checkpoint":"检查","practice_basic":"基础题","practice_understanding":"理解题","practice_application":"应用题"}'
    )

    assert plan.topic == "格雷码"
    assert plan.core_idea == "核心"


def test_call_openai_compatible_tutor_with_fake_openai(monkeypatch):
    class FakeCompletions:
        async def create(self, **kwargs):
            assert kwargs["model"] == "test-model"
            return type(
                "Response",
                (),
                {
                    "choices": [
                        type(
                            "Choice",
                            (),
                            {
                                "message": type(
                                    "Message",
                                    (),
                                    {
                                        "content": '{"topic":"格雷码","focus":"先回顾核心框架。","definition":"定义","core_idea":"核心","common_confusion":"误区","first_step":"步骤1","next_step":"步骤2","checkpoint":"检查","practice_basic":"基础题","practice_understanding":"理解题","practice_application":"应用题"}'
                                    },
                                )()
                            },
                        )()
                    ]
                },
            )()

    class FakeAsyncOpenAI:
        def __init__(self, *, base_url, api_key, timeout):
            self.base_url = base_url
            self.api_key = api_key
            self.timeout = timeout
            self.chat = type("Chat", (), {"completions": FakeCompletions()})()

    monkeypatch.setattr("src.core.upstream_tutor.AsyncOpenAI", FakeAsyncOpenAI)

    plan = asyncio.run(
        call_openai_compatible_tutor(
            build_upstream_tutor_request(
                settings=UpstreamTutorSettings(
                    backend="upstream_openai_compatible",
                    model="test-model",
                    base_url="https://example.test/v1",
                    api_key="secret",
                ),
                understanding=UnderstandingResult(
                    primary_topic="格雷码",
                    related_topics=(),
                    user_intent="review",
                    difficulty_state="reviewing",
                    focus="先回顾核心框架。",
                ),
            )
        )
    )

    assert plan.topic == "格雷码"
    assert plan.practice_application == "应用题"


def test_study_tutor_agent_falls_back_to_heuristic_plan_and_logs_warning(monkeypatch, caplog):
    async def fake_call_openai_compatible_tutor(request):
        raise UpstreamTutorError("upstream exploded")

    monkeypatch.setattr(
        "src.core.agent.call_openai_compatible_tutor",
        fake_call_openai_compatible_tutor,
    )

    agent = StudyTutorAgent(
        agent_name="study-tutor",
        tutor_settings=UpstreamTutorSettings(
            backend="upstream_openai_compatible",
            model="test-model",
            base_url="https://example.test/v1",
            api_key="secret",
        ),
    )

    with caplog.at_level("WARNING", logger="src.core.agent"):
        plan = asyncio.run(agent._build_tutor_plan("请帮我复习牛顿第二定律"))

    assert plan.topic == "牛顿第二定律"
    assert "合力、质量和加速度之间的关系" in plan.definition
    assert any(
        "Upstream tutor generation failed, fallback to heuristic planning" in record.getMessage()
        and "UpstreamTutorError" in record.getMessage()
        for record in caplog.records
    )

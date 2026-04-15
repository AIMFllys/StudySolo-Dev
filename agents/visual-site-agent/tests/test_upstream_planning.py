import asyncio

from src.core.agent import VisualSiteAgent
from src.core.types import PageUnderstanding
from src.core.upstream_planning import (
    UpstreamPlanningError,
    UpstreamPlanningSettings,
    build_upstream_planning_request,
    call_openai_compatible_planning,
    has_live_upstream_configuration,
    parse_upstream_planning_payload,
)


def test_has_live_upstream_configuration_requires_complete_settings():
    settings = UpstreamPlanningSettings(
        backend="upstream_openai_compatible",
        model="test-model",
        base_url="https://example.test/v1",
        api_key="secret",
    )

    assert has_live_upstream_configuration(settings) is True


def test_build_upstream_planning_request_uses_page_understanding():
    request = build_upstream_planning_request(
        settings=UpstreamPlanningSettings(
            backend="upstream_reserved",
            model="test-model",
            base_url="https://example.test/v1",
            api_key="secret",
        ),
        understanding=PageUnderstanding(
            page_topic="学习报告",
            page_goal="清晰展示学习成果和阶段总结。",
            page_type="report_page",
            style_direction="clean",
        ),
    )

    assert request.model == "test-model"
    assert "Topic: 学习报告" in request.messages[1]["content"]
    assert "Page type: report_page" in request.messages[1]["content"]


def test_parse_upstream_planning_payload_returns_page_plan():
    plan = parse_upstream_planning_payload(
        '{"page_topic":"学习报告","page_goal":"清晰展示学习成果和阶段总结。","hero":"首屏概览","main_sections":"主体区块","supporting_elements":"统计卡片","visual_direction":"简洁风格","layout_advice":"双层分区","interaction_hint":"轻量 hover","starter_html":"<!DOCTYPE html><html><body><h1>学习报告</h1></body></html>"}'
    )

    assert plan.page_topic == "学习报告"
    assert plan.hero == "首屏概览"


def test_call_openai_compatible_planning_with_fake_httpx(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": '{"page_topic":"学习报告","page_goal":"清晰展示学习成果和阶段总结。","hero":"首屏概览","main_sections":"主体区块","supporting_elements":"统计卡片","visual_direction":"简洁风格","layout_advice":"双层分区","interaction_hint":"轻量 hover","starter_html":"<!DOCTYPE html><html><body><h1>学习报告</h1></body></html>"}'
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

    monkeypatch.setattr("src.core.upstream_planning.httpx.AsyncClient", FakeAsyncClient)

    plan = asyncio.run(
        call_openai_compatible_planning(
            build_upstream_planning_request(
                settings=UpstreamPlanningSettings(
                    backend="upstream_openai_compatible",
                    model="test-model",
                    base_url="https://example.test/v1",
                    api_key="secret",
                    timeout_seconds=10,
                ),
                understanding=PageUnderstanding(
                    page_topic="学习报告",
                    page_goal="清晰展示学习成果和阶段总结。",
                    page_type="report_page",
                    style_direction="clean",
                ),
            )
        )
    )

    assert plan.page_topic == "学习报告"
    assert "<!DOCTYPE html>" in plan.starter_html


def test_visual_site_agent_falls_back_to_heuristic_plan_and_logs_warning(monkeypatch, caplog):
    async def fake_call_openai_compatible_planning(request):
        raise UpstreamPlanningError("upstream exploded")

    monkeypatch.setattr(
        "src.core.agent.call_openai_compatible_planning",
        fake_call_openai_compatible_planning,
    )

    agent = VisualSiteAgent(
        agent_name="visual-site",
        planning_settings=UpstreamPlanningSettings(
            backend="upstream_openai_compatible",
            model="test-model",
            base_url="https://example.test/v1",
            api_key="secret",
        ),
    )

    with caplog.at_level("WARNING", logger="src.core.agent"):
        plan = asyncio.run(agent._build_page_plan("请帮我做一个展示学习报告的网页"))

    assert plan.page_topic == "学习报告"
    assert "阶段总结" in plan.page_goal or "成果" in plan.page_goal
    assert any(
        "Upstream page planning failed, fallback to heuristic planning" in record.getMessage()
        and "UpstreamPlanningError" in record.getMessage()
        for record in caplog.records
    )

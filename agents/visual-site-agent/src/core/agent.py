import logging

from src.core.ai_understanding import (
    AIUnderstandingSettings,
    call_openai_compatible_understanding,
    has_live_ai_understanding_configuration,
)
from src.core.planning import PagePlanBuilder
from src.core.upstream_planning import (
    UpstreamPlanningSettings,
    build_upstream_planning_request,
    call_openai_compatible_planning,
    has_live_upstream_configuration,
)
from src.core.types import CompletionResult, PagePlan, PageUnderstanding, estimate_tokens, iter_text_chunks
from src.core.understanding import VisualSiteUnderstanding

logger = logging.getLogger(__name__)


class VisualSiteAgent:
    def __init__(
        self,
        agent_name: str,
        *,
        ai_understanding_settings: AIUnderstandingSettings | None = None,
        planning_settings: UpstreamPlanningSettings | None = None,
    ) -> None:
        self.agent_name = agent_name
        self.understanding = VisualSiteUnderstanding()
        self.plan_builder = PagePlanBuilder()
        self.ai_understanding_settings = ai_understanding_settings or AIUnderstandingSettings()
        self.planning_settings = planning_settings or UpstreamPlanningSettings()

    async def complete(self, messages: list[dict[str, str]]) -> CompletionResult:
        prompt_text = "\n".join(message.get("content", "") for message in messages)
        latest_user_message = self._latest_user_message(messages)
        content = await self._build_response(latest_user_message)
        return CompletionResult(
            content=content,
            prompt_tokens=estimate_tokens(prompt_text),
            completion_tokens=estimate_tokens(content),
        )

    def stream_chunks(self, content: str) -> list[str]:
        return iter_text_chunks(content)

    def _latest_user_message(self, messages: list[dict[str, str]]) -> str:
        for message in reversed(messages):
            if message.get("role") == "user":
                return " ".join(message.get("content", "").split())
        return ""

    async def _build_response(self, latest_user_message: str) -> str:
        plan = await self._build_page_plan(latest_user_message)
        return (
            "Page Summary\n"
            f"- Topic: {plan.page_topic}\n"
            f"- Goal: {plan.page_goal}\n\n"
            "Page Structure\n"
            f"1. Hero: {plan.hero}\n"
            f"2. Main Sections: {plan.main_sections}\n"
            f"3. Supporting Elements: {plan.supporting_elements}\n\n"
            "Design Notes\n"
            f"1. Visual Direction: {plan.visual_direction}\n"
            f"2. Layout Advice: {plan.layout_advice}\n"
            f"3. Interaction Hint: {plan.interaction_hint}\n\n"
            "Starter HTML\n"
            f"{plan.starter_html}"
        )

    async def _build_page_plan(self, latest_user_message: str) -> PagePlan:
        understanding = await self._understand_request(latest_user_message)
        if self.planning_settings.backend == "upstream_reserved":
            self._build_reserved_planning_request(understanding)
        if has_live_upstream_configuration(self.planning_settings):
            plan = await self._collect_live_upstream_page_plan(understanding)
            if plan is not None:
                return plan
        return self.plan_builder.build(understanding)

    async def _understand_request(self, latest_user_message: str) -> PageUnderstanding:
        if has_live_ai_understanding_configuration(self.ai_understanding_settings):
            try:
                understanding = await call_openai_compatible_understanding(
                    settings=self.ai_understanding_settings,
                    user_message=latest_user_message,
                )
                logger.info(
                    "AI understanding used: topic=%s type=%s style=%s",
                    understanding.page_topic,
                    understanding.page_type,
                    understanding.style_direction,
                    extra={"agent": self.agent_name},
                )
                return understanding
            except Exception as exc:
                logger.warning(
                    "AI understanding failed, fallback to heuristic: exception_type=%s detail=%r",
                    type(exc).__name__,
                    exc,
                    extra={"agent": self.agent_name},
                )
        else:
            logger.info(
                "Heuristic understanding used: AI understanding not configured",
                extra={"agent": self.agent_name},
            )

        understanding = self.understanding.understand(latest_user_message)
        logger.info(
            "Heuristic understanding used: topic=%s type=%s style=%s",
            understanding.page_topic,
            understanding.page_type,
            understanding.style_direction,
            extra={"agent": self.agent_name},
        )
        return understanding

    def _build_reserved_planning_request(
        self,
        understanding: PageUnderstanding,
    ):
        return build_upstream_planning_request(
            settings=self.planning_settings,
            understanding=understanding,
        )

    async def _collect_live_upstream_page_plan(
        self,
        understanding: PageUnderstanding,
    ) -> PagePlan | None:
        try:
            request = build_upstream_planning_request(
                settings=self.planning_settings,
                understanding=understanding,
            )
            plan = await call_openai_compatible_planning(request)
            logger.info(
                "AI page planning used: topic=%s type=%s style=%s",
                plan.page_topic,
                understanding.page_type,
                understanding.style_direction,
                extra={"agent": self.agent_name},
            )
            return plan
        except Exception as exc:
            logger.warning(
                "Upstream page planning failed, fallback to heuristic planning: "
                "exception_type=%s detail=%r topic=%s type=%s",
                type(exc).__name__,
                exc,
                understanding.page_topic,
                understanding.page_type,
                extra={"agent": self.agent_name},
            )
            return None

    def _extract_page_topic(self, latest_user_message: str) -> str:
        return self.understanding.extract_page_topic(latest_user_message)

    def _detect_page_type(self, latest_user_message: str) -> str:
        return self.understanding.detect_page_type(latest_user_message)

    def _detect_style_direction(self, latest_user_message: str, page_type: str) -> str:
        return self.understanding.detect_style_direction(latest_user_message, page_type)

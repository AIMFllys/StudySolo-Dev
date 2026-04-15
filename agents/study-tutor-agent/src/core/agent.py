import logging

from src.core.ai_understanding import (
    AIUnderstandingSettings,
    call_openai_compatible_understanding,
    has_live_ai_understanding_configuration,
)
from src.core.planning import TutorPlanBuilder
from src.core.upstream_tutor import (
    UpstreamTutorSettings,
    build_upstream_tutor_request,
    call_openai_compatible_tutor,
    has_live_upstream_configuration,
)
from src.core.types import (
    CompletionResult,
    UnderstandingResult,
    TutorPlan,
    estimate_tokens,
    iter_text_chunks,
)
from src.core.understanding import StudyRequestUnderstanding


logger = logging.getLogger(__name__)


class StudyTutorAgent:
    def __init__(
        self,
        agent_name: str,
        *,
        ai_understanding_settings: AIUnderstandingSettings | None = None,
        tutor_settings: UpstreamTutorSettings | None = None,
    ) -> None:
        self.agent_name = agent_name
        self.understanding = StudyRequestUnderstanding()
        self.plan_builder = TutorPlanBuilder()
        self.ai_understanding_settings = ai_understanding_settings or AIUnderstandingSettings()
        self.tutor_settings = tutor_settings or UpstreamTutorSettings()

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
        plan = await self._build_tutor_plan(latest_user_message)
        return (
            "Topic Summary\n"
            f"- Topic: {plan.topic}\n"
            f"- Focus: {plan.focus}\n\n"
            "Key Concepts\n"
            f"1. Definition: {plan.definition}\n"
            f"2. Core Idea: {plan.core_idea}\n"
            f"3. Common Confusion: {plan.common_confusion}\n\n"
            "Study Suggestions\n"
            f"1. First Step: {plan.first_step}\n"
            f"2. Next Step: {plan.next_step}\n"
            f"3. Checkpoint: {plan.checkpoint}\n\n"
            "Practice\n"
            f"1. Basic: {plan.practice_basic}\n"
            f"2. Understanding: {plan.practice_understanding}\n"
            f"3. Application: {plan.practice_application}"
        )

    async def _build_tutor_plan(self, latest_user_message: str) -> TutorPlan:
        understanding = await self._understand_request(latest_user_message)
        if self.tutor_settings.backend == "upstream_reserved":
            self._build_reserved_tutor_request(understanding)
        if has_live_upstream_configuration(self.tutor_settings):
            plan = await self._collect_live_upstream_tutor_plan(understanding)
            if plan is not None:
                return plan
        return self.plan_builder.build(understanding)

    async def _understand_request(self, latest_user_message: str) -> UnderstandingResult:
        if has_live_ai_understanding_configuration(self.ai_understanding_settings):
            try:
                understanding = await call_openai_compatible_understanding(
                    settings=self.ai_understanding_settings,
                    user_message=latest_user_message,
                )
                logger.info(
                    "AI understanding used: topic=%s intent=%s difficulty=%s",
                    understanding.topic,
                    understanding.user_intent,
                    understanding.difficulty_state,
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
            "Heuristic understanding used: topic=%s intent=%s difficulty=%s",
            understanding.topic,
            understanding.user_intent,
            understanding.difficulty_state,
            extra={"agent": self.agent_name},
        )
        return understanding

    def _extract_topic(self, latest_user_message: str) -> str:
        return self.understanding.extract_topic(latest_user_message)

    def _build_reserved_tutor_request(
        self,
        understanding: UnderstandingResult,
    ):
        return build_upstream_tutor_request(
            settings=self.tutor_settings,
            understanding=understanding,
        )

    async def _collect_live_upstream_tutor_plan(
        self,
        understanding: UnderstandingResult,
    ) -> TutorPlan | None:
        try:
            request = build_upstream_tutor_request(
                settings=self.tutor_settings,
                understanding=understanding,
            )
            plan = await call_openai_compatible_tutor(request)
            logger.info(
                "AI tutor generation used: topic=%s intent=%s difficulty=%s",
                plan.topic,
                understanding.user_intent,
                understanding.difficulty_state,
                extra={"agent": self.agent_name},
            )
            return plan
        except Exception as exc:
            logger.warning(
                "Upstream tutor generation failed, fallback to heuristic planning: "
                "exception_type=%s detail=%r topic=%s intent=%s",
                type(exc).__name__,
                exc,
                understanding.topic,
                understanding.user_intent,
                extra={"agent": self.agent_name},
            )
            return None

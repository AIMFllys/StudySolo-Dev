import json
from dataclasses import dataclass
from typing import Literal

from openai import AsyncOpenAI
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from src.core.types import TutorPlan, UnderstandingResult


UPSTREAM_TUTOR_SYSTEM_PROMPT = """You are StudySolo's study tutor generation module.
Given a structured understanding result, produce a concise tutoring plan.
Return JSON only with exactly this schema:
{
  "topic": "string",
  "focus": "string",
  "definition": "string",
  "core_idea": "string",
  "common_confusion": "string",
  "first_step": "string",
  "next_step": "string",
  "checkpoint": "string",
  "practice_basic": "string",
  "practice_understanding": "string",
  "practice_application": "string"
}

Rules:
- Keep the same topic unless it is clearly malformed.
- Keep each field short, concrete, and educational.
- Match the user's intent and difficulty state.
- Do not return Markdown.
"""


class UpstreamTutorError(Exception):
    """Raised when upstream tutor generation cannot be used safely."""


class UpstreamTutorPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    topic: str
    focus: str
    definition: str
    core_idea: str
    common_confusion: str
    first_step: str
    next_step: str
    checkpoint: str
    practice_basic: str
    practice_understanding: str
    practice_application: str

    @field_validator(
        "topic",
        "focus",
        "definition",
        "core_idea",
        "common_confusion",
        "first_step",
        "next_step",
        "checkpoint",
        "practice_basic",
        "practice_understanding",
        "practice_application",
    )
    @classmethod
    def validate_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be empty")
        return normalized


@dataclass(frozen=True, slots=True)
class UpstreamTutorSettings:
    backend: Literal["heuristic", "upstream_reserved", "upstream_openai_compatible"] = "heuristic"
    model: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    timeout_seconds: float = 30.0


@dataclass(frozen=True, slots=True)
class UpstreamTutorRequest:
    model: str | None
    base_url: str | None
    api_key: str | None
    timeout_seconds: float
    messages: tuple[dict[str, str], ...]


def has_live_upstream_configuration(settings: UpstreamTutorSettings) -> bool:
    return bool(
        settings.backend == "upstream_openai_compatible"
        and (settings.model or "").strip()
        and (settings.base_url or "").strip()
        and (settings.api_key or "").strip()
    )


def build_upstream_tutor_request(
    *,
    settings: UpstreamTutorSettings,
    understanding: UnderstandingResult,
) -> UpstreamTutorRequest:
    user_prompt = "\n".join(
        [
            "Understanding result",
            f"- Topic: {understanding.topic}",
            f"- Related topics: {', '.join(understanding.related_topics) if understanding.related_topics else '(none)'}",
            f"- User intent: {understanding.user_intent}",
            f"- Difficulty state: {understanding.difficulty_state}",
            f"- Focus: {understanding.focus}",
        ]
    )
    return UpstreamTutorRequest(
        model=settings.model,
        base_url=settings.base_url,
        api_key=settings.api_key,
        timeout_seconds=settings.timeout_seconds,
        messages=(
            {"role": "system", "content": UPSTREAM_TUTOR_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ),
    )


def _extract_json_text(content: str) -> str:
    stripped = content.strip()
    if not stripped:
        raise UpstreamTutorError("Upstream tutor returned empty content")
    if stripped.startswith("```") and stripped.endswith("```"):
        stripped = stripped.strip("`").replace("json", "", 1).strip()
    return stripped


def parse_upstream_tutor_payload(content: str) -> TutorPlan:
    try:
        payload = json.loads(_extract_json_text(content))
    except json.JSONDecodeError as exc:
        raise UpstreamTutorError("Upstream tutor did not return valid JSON") from exc

    try:
        data = UpstreamTutorPayload.model_validate(payload)
    except ValidationError as exc:
        raise UpstreamTutorError("Upstream tutor JSON did not match schema") from exc

    return TutorPlan(
        topic=data.topic,
        focus=data.focus,
        definition=data.definition,
        core_idea=data.core_idea,
        common_confusion=data.common_confusion,
        first_step=data.first_step,
        next_step=data.next_step,
        checkpoint=data.checkpoint,
        practice_basic=data.practice_basic,
        practice_understanding=data.practice_understanding,
        practice_application=data.practice_application,
    )


async def call_openai_compatible_tutor(
    request: UpstreamTutorRequest,
) -> TutorPlan:
    if not request.model or not request.base_url or not request.api_key:
        raise UpstreamTutorError("Upstream tutor configuration is incomplete")

    client = AsyncOpenAI(
        base_url=request.base_url,
        api_key=request.api_key,
        timeout=request.timeout_seconds,
    )
    response = await client.chat.completions.create(
        model=request.model,
        messages=list(request.messages),
        stream=False,
        temperature=0,
    )
    choice = response.choices[0] if response.choices else None
    content = getattr(getattr(choice, "message", None), "content", None) or ""
    return parse_upstream_tutor_payload(content)

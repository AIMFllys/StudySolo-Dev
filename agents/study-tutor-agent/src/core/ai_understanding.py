import json
from dataclasses import dataclass
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from src.core.types import UnderstandingResult


UNDERSTANDING_SYSTEM_PROMPT = """You are StudySolo's study tutor understanding module.
Extract the user's learning intent from the final user message.
Return JSON only with exactly these fields:
{
  "primary_topic": "string",
  "related_topics": ["string"],
  "user_intent": "explain|review|clarify_confusion|learn_path",
  "difficulty_state": "unknown|beginner|confused|reviewing",
  "focus": "string"
}

Rules:
- `primary_topic` should be the main learning topic, not the whole sentence.
- `related_topics` should include only clearly mentioned secondary topics that matter for comparison or confusion.
- Prefer a single main topic even if the user casually mentions another concept.
- Remove conversational wrappers such as "我不太清楚", "请帮我复习", "解释一下什么是".
- Keep `focus` short, concrete, and teacher-like.
- If the main topic is unclear, set `primary_topic` to "学习主题待确认" and return an empty `related_topics` list.
"""


class AIUnderstandingError(Exception):
    """Raised when AI understanding cannot be used safely."""


class AIUnderstandingPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    primary_topic: str | None = None
    topic: str | None = None
    related_topics: list[str] = []
    user_intent: Literal["explain", "review", "clarify_confusion", "learn_path"]
    difficulty_state: Literal["unknown", "beginner", "confused", "reviewing"]
    focus: str

    @field_validator("primary_topic", "topic", "focus")
    @classmethod
    def validate_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be empty")
        return normalized

    @field_validator("related_topics")
    @classmethod
    def validate_related_topics(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        for item in value:
            cleaned = item.strip()
            if cleaned and cleaned not in normalized:
                normalized.append(cleaned)
        return normalized


@dataclass(frozen=True, slots=True)
class AIUnderstandingSettings:
    backend: Literal["heuristic", "openai_compatible"] = "heuristic"
    model: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    timeout_seconds: float = 30.0


def _summarize_text(value: str, limit: int = 200) -> str:
    normalized = " ".join((value or "").split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[:limit]}..."


def has_live_ai_understanding_configuration(settings: AIUnderstandingSettings) -> bool:
    return bool(
        settings.backend == "openai_compatible"
        and (settings.model or "").strip()
        and (settings.base_url or "").strip()
        and (settings.api_key or "").strip()
    )


def _extract_json_text(content: str) -> str:
    stripped = content.strip()
    if not stripped:
        raise AIUnderstandingError("AI understanding returned empty content")
    if stripped.startswith("```") and stripped.endswith("```"):
        stripped = stripped.strip("`").replace("json", "", 1).strip()
    return stripped


def parse_ai_understanding_payload(content: str) -> UnderstandingResult:
    try:
        payload = json.loads(_extract_json_text(content))
    except json.JSONDecodeError as exc:
        raise AIUnderstandingError(
            "AI understanding did not return valid JSON. "
            f"preview={_summarize_text(content)!r}"
        ) from exc

    try:
        data = AIUnderstandingPayload.model_validate(payload)
    except ValidationError as exc:
        raise AIUnderstandingError(
            "AI understanding JSON did not match schema. "
            f"payload_preview={_summarize_text(json.dumps(payload, ensure_ascii=False))!r}"
        ) from exc

    return UnderstandingResult(
        primary_topic=data.primary_topic or data.topic or "学习主题待确认",
        related_topics=tuple(data.related_topics),
        user_intent=data.user_intent,
        difficulty_state=data.difficulty_state,
        focus=data.focus,
    )


async def call_openai_compatible_understanding(
    *,
    settings: AIUnderstandingSettings,
    user_message: str,
) -> UnderstandingResult:
    if not has_live_ai_understanding_configuration(settings):
        raise AIUnderstandingError("AI understanding configuration is incomplete")

    base_url = (settings.base_url or "").rstrip("/")
    url = f"{base_url}/chat/completions"
    payload = {
        "model": settings.model,
        "messages": [
            {"role": "system", "content": UNDERSTANDING_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "stream": False,
        "temperature": 0,
    }
    headers = {
        "Authorization": f"Bearer {settings.api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=settings.timeout_seconds) as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code if exc.response is not None else "unknown"
            body_preview = (
                _summarize_text(exc.response.text) if exc.response is not None else ""
            )
            raise AIUnderstandingError(
                "AI understanding request returned non-2xx status. "
                f"status={status_code} url={url!r} body_preview={body_preview!r}"
            ) from exc
        except httpx.TimeoutException as exc:
            raise AIUnderstandingError(
                "AI understanding request timed out. "
                f"url={url!r} timeout_seconds={settings.timeout_seconds}"
            ) from exc
        except httpx.HTTPError as exc:
            raise AIUnderstandingError(
                "AI understanding request failed. "
                f"type={type(exc).__name__} url={url!r} detail={exc!r}"
            ) from exc

    data = response.json()
    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    return parse_ai_understanding_payload(content)

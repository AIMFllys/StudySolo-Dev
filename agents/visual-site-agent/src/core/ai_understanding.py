import json
from dataclasses import dataclass
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from src.core.types import GENERIC_PAGE_TOPIC_FALLBACK, PageUnderstanding


UNDERSTANDING_SYSTEM_PROMPT = """You are StudySolo's visual site understanding module.
Extract the page requirement from the final user message.
Return JSON only with exactly these fields:
{
  "page_topic": "string",
  "page_goal": "string",
  "page_type": "report_page|teaching_page|summary_page|landing_page",
  "style_direction": "clean|academic|showcase|friendly"
}

Rules:
- `page_topic` should be the clean page topic, not the whole sentence.
- `page_goal` should describe the main display goal of the page.
- Keep the result short, concrete, and implementation-friendly.
- If the topic is unclear, set `page_topic` to "页面主题待确认".
"""


class AIUnderstandingError(Exception):
    pass


class AIUnderstandingPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    page_topic: str
    page_goal: str
    page_type: Literal["report_page", "teaching_page", "summary_page", "landing_page"]
    style_direction: Literal["clean", "academic", "showcase", "friendly"]

    @field_validator("page_topic", "page_goal")
    @classmethod
    def validate_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be empty")
        return normalized


@dataclass(frozen=True, slots=True)
class AIUnderstandingSettings:
    backend: Literal["heuristic", "openai_compatible"] = "heuristic"
    model: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    timeout_seconds: float = 30.0


def has_live_ai_understanding_configuration(settings: AIUnderstandingSettings) -> bool:
    return bool(
        settings.backend == "openai_compatible"
        and (settings.model or "").strip()
        and (settings.base_url or "").strip()
        and (settings.api_key or "").strip()
    )


def _summarize_text(value: str, limit: int = 200) -> str:
    normalized = " ".join((value or "").split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[:limit]}..."


def _extract_json_text(content: str) -> str:
    stripped = content.strip()
    if not stripped:
        raise AIUnderstandingError("AI understanding returned empty content")
    if stripped.startswith("```") and stripped.endswith("```"):
        stripped = stripped.strip("`").replace("json", "", 1).strip()
    return stripped


def parse_ai_understanding_payload(content: str) -> PageUnderstanding:
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

    return PageUnderstanding(
        page_topic=data.page_topic or GENERIC_PAGE_TOPIC_FALLBACK,
        page_goal=data.page_goal,
        page_type=data.page_type,
        style_direction=data.style_direction,
    )


async def call_openai_compatible_understanding(
    *,
    settings: AIUnderstandingSettings,
    user_message: str,
) -> PageUnderstanding:
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
            body_preview = _summarize_text(exc.response.text) if exc.response is not None else ""
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
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return parse_ai_understanding_payload(content)

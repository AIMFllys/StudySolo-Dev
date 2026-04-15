import json
from dataclasses import dataclass
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from src.core.types import PagePlan, PageUnderstanding


UPSTREAM_PLANNING_SYSTEM_PROMPT = """You are StudySolo's visual site planning module.
Given a structured page understanding result, produce a concise page plan.
Return JSON only with exactly this schema:
{
  "page_topic": "string",
  "page_goal": "string",
  "hero": "string",
  "main_sections": "string",
  "supporting_elements": "string",
  "visual_direction": "string",
  "layout_advice": "string",
  "interaction_hint": "string",
  "starter_html": "string"
}

Rules:
- Keep the same page topic unless it is clearly malformed.
- Keep every field concise, implementation-friendly, and suitable for a first webpage draft.
- `starter_html` must be a minimal but valid HTML page skeleton.
- Do not return Markdown or code fences.
"""


class UpstreamPlanningError(Exception):
    """Raised when upstream page planning cannot be used safely."""


class UpstreamPlanningPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    page_topic: str
    page_goal: str
    hero: str
    main_sections: str
    supporting_elements: str
    visual_direction: str
    layout_advice: str
    interaction_hint: str
    starter_html: str

    @field_validator(
        "page_topic",
        "page_goal",
        "hero",
        "main_sections",
        "supporting_elements",
        "visual_direction",
        "layout_advice",
        "interaction_hint",
        "starter_html",
    )
    @classmethod
    def validate_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be empty")
        return normalized


@dataclass(frozen=True, slots=True)
class UpstreamPlanningSettings:
    backend: Literal["heuristic", "upstream_reserved", "upstream_openai_compatible"] = "heuristic"
    model: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    timeout_seconds: float = 30.0


@dataclass(frozen=True, slots=True)
class UpstreamPlanningRequest:
    model: str | None
    base_url: str | None
    api_key: str | None
    timeout_seconds: float
    messages: tuple[dict[str, str], ...]


def has_live_upstream_configuration(settings: UpstreamPlanningSettings) -> bool:
    return bool(
        settings.backend == "upstream_openai_compatible"
        and (settings.model or "").strip()
        and (settings.base_url or "").strip()
        and (settings.api_key or "").strip()
    )


def build_upstream_planning_request(
    *,
    settings: UpstreamPlanningSettings,
    understanding: PageUnderstanding,
) -> UpstreamPlanningRequest:
    user_prompt = "\n".join(
        [
            "Page understanding result",
            f"- Topic: {understanding.page_topic}",
            f"- Goal: {understanding.page_goal}",
            f"- Page type: {understanding.page_type}",
            f"- Style direction: {understanding.style_direction}",
        ]
    )
    return UpstreamPlanningRequest(
        model=settings.model,
        base_url=settings.base_url,
        api_key=settings.api_key,
        timeout_seconds=settings.timeout_seconds,
        messages=(
            {"role": "system", "content": UPSTREAM_PLANNING_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ),
    )


def _summarize_text(value: str, limit: int = 240) -> str:
    normalized = " ".join((value or "").split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[:limit]}..."


def _extract_json_text(content: str) -> str:
    stripped = content.strip()
    if not stripped:
        raise UpstreamPlanningError("Upstream planning returned empty content")
    if stripped.startswith("```") and stripped.endswith("```"):
        stripped = stripped.strip("`").replace("json", "", 1).strip()
    return stripped


def parse_upstream_planning_payload(content: str) -> PagePlan:
    try:
        payload = json.loads(_extract_json_text(content))
    except json.JSONDecodeError as exc:
        raise UpstreamPlanningError(
            "Upstream planning did not return valid JSON. "
            f"preview={_summarize_text(content)!r}"
        ) from exc

    try:
        data = UpstreamPlanningPayload.model_validate(payload)
    except ValidationError as exc:
        raise UpstreamPlanningError(
            "Upstream planning JSON did not match schema. "
            f"payload_preview={_summarize_text(json.dumps(payload, ensure_ascii=False))!r}"
        ) from exc

    return PagePlan(
        page_topic=data.page_topic,
        page_goal=data.page_goal,
        hero=data.hero,
        main_sections=data.main_sections,
        supporting_elements=data.supporting_elements,
        visual_direction=data.visual_direction,
        layout_advice=data.layout_advice,
        interaction_hint=data.interaction_hint,
        starter_html=data.starter_html,
    )


async def call_openai_compatible_planning(
    request: UpstreamPlanningRequest,
) -> PagePlan:
    if not request.model or not request.base_url or not request.api_key:
        raise UpstreamPlanningError("Upstream planning configuration is incomplete")

    url = f"{request.base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": request.model,
        "messages": list(request.messages),
        "stream": False,
        "temperature": 0,
    }
    headers = {
        "Authorization": f"Bearer {request.api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=request.timeout_seconds) as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code if exc.response is not None else "unknown"
            body_preview = _summarize_text(exc.response.text) if exc.response is not None else ""
            raise UpstreamPlanningError(
                "Upstream planning request returned non-2xx status. "
                f"status={status_code} url={url!r} body_preview={body_preview!r}"
            ) from exc
        except httpx.TimeoutException as exc:
            raise UpstreamPlanningError(
                "Upstream planning request timed out. "
                f"url={url!r} timeout_seconds={request.timeout_seconds}"
            ) from exc
        except httpx.HTTPError as exc:
            raise UpstreamPlanningError(
                "Upstream planning request failed. "
                f"type={type(exc).__name__} url={url!r} detail={exc!r}"
            ) from exc

    data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return parse_upstream_planning_payload(content)

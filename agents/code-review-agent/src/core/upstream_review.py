import json
import re
from dataclasses import dataclass
from typing import Any, Literal

from openai import AsyncOpenAI
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


UPSTREAM_REVIEW_SYSTEM_PROMPT = """You are StudySolo's code review agent.
Review only the supplied review target.
Repo context is supporting reference only and must never produce standalone findings.

Return JSON only. Do not return Markdown or prose.
Use exactly this schema:
{
  "findings": [
    {
      "title": "string",
      "rule_id": "string",
      "severity": "high|medium|low",
      "file_path": "string|null",
      "line_number": "integer|null",
      "evidence": "string",
      "fix": "string"
    }
  ]
}

If there are no justified findings, return {"findings": []}.
"""

JSON_CODE_BLOCK_PATTERN = re.compile(r"^```(?:json)?\s*(?P<body>.*?)\s*```$", re.DOTALL)


class UpstreamReviewError(Exception):
    """Raised when the optional upstream review path cannot be used safely."""


class UpstreamFindingPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    rule_id: str
    severity: Literal["high", "medium", "low"]
    file_path: str | None = None
    line_number: int | None = Field(default=None, ge=1)
    evidence: str
    fix: str

    @field_validator("title", "rule_id", "evidence", "fix")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be empty")
        return normalized

    @field_validator("file_path")
    @classmethod
    def normalize_file_path(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class UpstreamFindingsPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    findings: list[UpstreamFindingPayload]


@dataclass(frozen=True, slots=True)
class UpstreamReviewSettings:
    model: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    timeout_seconds: float = 30.0


@dataclass(frozen=True, slots=True)
class UpstreamReviewRequest:
    model: str | None
    base_url: str | None
    api_key: str | None
    timeout_seconds: float
    messages: tuple[dict[str, str], ...]


def has_live_upstream_configuration(settings: UpstreamReviewSettings) -> bool:
    return bool(
        (settings.model or "").strip()
        and (settings.base_url or "").strip()
        and (settings.api_key or "").strip()
    )


def build_upstream_review_request(
    *,
    settings: UpstreamReviewSettings,
    input_kind: str,
    review_target_text: str,
    review_target_path: str | None,
    context_blocks: tuple[tuple[str, str], ...],
    uses_structured_input: bool,
) -> UpstreamReviewRequest:
    target_path = review_target_path or "<none>"
    sections = [
        "Review target",
        f"- Input type: {input_kind}",
        f"- Structured input supplied: {'yes' if uses_structured_input else 'no'}",
        f"- Review target path: {target_path}",
        "",
        "Review target content:",
        review_target_text or "<empty>",
        "",
        "Repo context",
        f"- Repo context files supplied: {len(context_blocks)}",
    ]

    for index, (path, content) in enumerate(context_blocks, start=1):
        sections.extend(
            [
                f"- Context file {index} path: {path}",
                "Context content:",
                content or "<empty>",
            ]
        )

    user_prompt = "\n".join(sections)
    return UpstreamReviewRequest(
        model=settings.model,
        base_url=settings.base_url,
        api_key=settings.api_key,
        timeout_seconds=settings.timeout_seconds,
        messages=(
            {"role": "system", "content": UPSTREAM_REVIEW_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ),
    )


def _extract_json_text(content: str) -> str:
    stripped = content.strip()
    if not stripped:
        raise UpstreamReviewError("Upstream review returned empty content")

    code_block_match = JSON_CODE_BLOCK_PATTERN.match(stripped)
    if code_block_match:
        stripped = code_block_match.group("body").strip()

    return stripped


def parse_upstream_review_payload(content: str) -> UpstreamFindingsPayload:
    try:
        payload = json.loads(_extract_json_text(content))
    except json.JSONDecodeError as exc:
        raise UpstreamReviewError("Upstream review did not return valid JSON") from exc

    try:
        return UpstreamFindingsPayload.model_validate(payload)
    except ValidationError as exc:
        raise UpstreamReviewError("Upstream review JSON did not match the findings schema") from exc


async def call_openai_compatible_review(
    request: UpstreamReviewRequest,
) -> UpstreamFindingsPayload:
    if not request.model or not request.base_url or not request.api_key:
        raise UpstreamReviewError("Upstream review configuration is incomplete")

    client = AsyncOpenAI(
        base_url=request.base_url,
        api_key=request.api_key,
        timeout=request.timeout_seconds,
    )
    response = await client.chat.completions.create(
        model=request.model,
        messages=list(request.messages),
        stream=False,
    )
    choice = response.choices[0] if response.choices else None
    content = getattr(getattr(choice, "message", None), "content", None) or ""
    return parse_upstream_review_payload(content)


def _extract_stream_chunk_content(chunk: Any) -> str:
    choices = getattr(chunk, "choices", None) or ()
    pieces: list[str] = []

    for choice in choices:
        delta = getattr(choice, "delta", None)
        content = getattr(delta, "content", None)
        if isinstance(content, str) and content:
            pieces.append(content)

    return "".join(pieces)


async def call_openai_compatible_review_stream(
    request: UpstreamReviewRequest,
) -> UpstreamFindingsPayload:
    if not request.model or not request.base_url or not request.api_key:
        raise UpstreamReviewError("Upstream review configuration is incomplete")

    client = AsyncOpenAI(
        base_url=request.base_url,
        api_key=request.api_key,
        timeout=request.timeout_seconds,
    )
    response_stream = await client.chat.completions.create(
        model=request.model,
        messages=list(request.messages),
        stream=True,
    )

    collected_content: list[str] = []
    try:
        async for chunk in response_stream:
            chunk_content = _extract_stream_chunk_content(chunk)
            if chunk_content:
                collected_content.append(chunk_content)
    finally:
        aclose = getattr(response_stream, "aclose", None)
        if callable(aclose):
            await aclose()

    return parse_upstream_review_payload("".join(collected_content))

import json
import re
from dataclasses import dataclass
from typing import Any, Literal

from openai import AsyncOpenAI
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


UPSTREAM_REVIEW_SYSTEM_PROMPT = """You are StudySolo's code review agent.
Review only the supplied review target.
Repo context is supporting reference only and must never produce standalone findings.
Use repo context only when it helps explain a justified risk in the review target.
Never report a finding that exists only in repo context.
If repo context suggests a risk but you cannot tie it back to the review target, return {"findings": []}.
If you use repo context to support a finding, the final file_path and line_number must still point to the review target or be null.

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
IDENTIFIER_PATTERN = re.compile(r"\b[A-Za-z_][A-Za-z0-9_]{2,}\b")
IDENTIFIER_SUBTOKEN_PATTERN = re.compile(
    r"[A-Z]+(?=[A-Z][a-z]|[0-9]|$)|[A-Z]?[a-z]+|[0-9]+"
)
MAX_SHARED_IDENTIFIERS = 5
LOW_INFO_IDENTIFIERS = {
    "and",
    "args",
    "async",
    "await",
    "attr",
    "bool",
    "break",
    "call",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "def",
    "dict",
    "else",
    "enum",
    "export",
    "false",
    "finally",
    "float",
    "for",
    "from",
    "function",
    "if",
    "import",
    "int",
    "interface",
    "json",
    "let",
    "list",
    "map",
    "new",
    "none",
    "null",
    "pass",
    "print",
    "raise",
    "return",
    "self",
    "set",
    "str",
    "switch",
    "then",
    "this",
    "throw",
    "true",
    "try",
    "type",
    "var",
    "void",
    "while",
    "with",
}
LOW_SIGNAL_SHARED_IDENTIFIER_TOKENS = {
    "body",
    "data",
    "error",
    "errors",
    "item",
    "items",
    "message",
    "messages",
    "number",
    "path",
    "payload",
    "request",
    "requests",
    "response",
    "responses",
    "result",
    "results",
    "status",
    "string",
    "value",
    "values",
}


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


ContextRelationship = Literal["same_dir", "same_top_level", "same_extension", "other"]
UsagePriority = Literal["high", "medium", "low"]


@dataclass(frozen=True, slots=True)
class UpstreamContextBlock:
    path: str
    content: str
    relationship: ContextRelationship
    shared_identifiers: tuple[str, ...] = ()
    usage_priority: UsagePriority = "low"
    truncated: bool = False


def review_scope_hint(input_kind: str) -> str:
    if input_kind == "unified_diff":
        return (
            "Review only the added lines in the review target diff. "
            "Repo context may only help explain those added lines."
        )
    return (
        "Review only the supplied review target text. "
        "Repo context may only help explain symbols, types, constraints, or call relationships "
        "that appear in the review target."
    )


def extract_identifiers(text: str) -> set[str]:
    identifiers: set[str] = set()
    for match in IDENTIFIER_PATTERN.findall(text):
        normalized = match.lower()
        if normalized in LOW_INFO_IDENTIFIERS:
            continue
        identifiers.add(normalized)
    return identifiers


def canonical_shared_identifier(identifier: str) -> str:
    canonical_parts: list[str] = []
    for segment in identifier.split("_"):
        if not segment:
            continue
        subtokens = IDENTIFIER_SUBTOKEN_PATTERN.findall(segment)
        if not subtokens:
            canonical_parts.append(segment.lower())
            continue
        canonical_parts.extend(subtoken.lower() for subtoken in subtokens)
    return "_".join(canonical_parts)


def repo_aware_identifiers(text: str) -> set[str]:
    identifiers: set[str] = set()
    for match in IDENTIFIER_PATTERN.findall(text):
        normalized = canonical_shared_identifier(match)
        if not normalized or normalized in LOW_INFO_IDENTIFIERS:
            continue
        identifiers.add(normalized)
    return identifiers


def _filter_shared_identifier_candidates(identifiers: set[str]) -> set[str]:
    return {
        identifier
        for identifier in identifiers
        if identifier not in LOW_SIGNAL_SHARED_IDENTIFIER_TOKENS
    }


def _shared_identifier_candidates(
    review_target_text: str,
    context_text: str,
) -> tuple[str, ...]:
    shared = repo_aware_identifiers(review_target_text).intersection(
        repo_aware_identifiers(context_text)
    )
    shared = _filter_shared_identifier_candidates(shared)
    return tuple(sorted(shared))


def shared_identifiers(review_target_text: str, context_text: str) -> tuple[str, ...]:
    return _shared_identifier_candidates(review_target_text, context_text)[:MAX_SHARED_IDENTIFIERS]


def usage_priority(
    relationship: ContextRelationship,
    shared_identifier_count: int,
) -> UsagePriority:
    if shared_identifier_count >= 2:
        return "high"
    if relationship == "same_dir":
        return "high" if shared_identifier_count >= 1 else "medium"
    if relationship in {"same_top_level", "same_extension"} or shared_identifier_count == 1:
        return "medium"
    return "low"


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
    context_file_count: int,
    forwarded_context: tuple[UpstreamContextBlock, ...],
    uses_structured_input: bool,
) -> UpstreamReviewRequest:
    target_path = review_target_path or "<none>"
    sections = [
        "Review target",
        f"- Input type: {input_kind}",
        f"- Structured input supplied: {'yes' if uses_structured_input else 'no'}",
        f"- Review target path: {target_path}",
        f"- Review scope: {review_scope_hint(input_kind)}",
        "",
        "Review target content:",
        review_target_text or "<empty>",
        "",
        "Repo context",
        f"- Repo context files supplied: {context_file_count}",
        f"- Repo context files forwarded: {len(forwarded_context)}",
    ]

    for index, context_block in enumerate(forwarded_context, start=1):
        shared_identifier_text = (
            ", ".join(context_block.shared_identifiers)
            if context_block.shared_identifiers
            else "<none>"
        )
        sections.extend(
            [
                f"- Context file {index} path: {context_block.path}",
                f"- Context file {index} relationship: {context_block.relationship}",
                f"- Context file {index} usage priority: {context_block.usage_priority}",
                f"- Context file {index} shared identifiers: {shared_identifier_text}",
                f"- Context file {index} truncated: {'yes' if context_block.truncated else 'no'}",
                "Context content:",
                context_block.content or "<empty>",
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

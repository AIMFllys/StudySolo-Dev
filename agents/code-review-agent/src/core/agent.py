import asyncio
import re
from dataclasses import dataclass
from math import ceil
from typing import AsyncIterator, Literal

import src.core.upstream_review as upstream_review


def estimate_tokens(text: str) -> int:
    return max(1, ceil(len(text.strip()) / 4)) if text.strip() else 0


def iter_text_chunks(text: str, chunk_size: int = 48) -> list[str]:
    if not text:
        return []
    return [text[index:index + chunk_size] for index in range(0, len(text), chunk_size)]


@dataclass(slots=True)
class CompletionResult:
    content: str
    prompt_tokens: int
    completion_tokens: int

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


Severity = Literal["high", "medium", "low"]
InputKind = Literal["unified_diff", "code_snippet", "plain_text"]
ReviewBackend = Literal["heuristic", "upstream_reserved", "upstream_openai_compatible"]

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}
MAX_FINDINGS = 5
PLACEHOLDER_FILE_PATHS = {"", "none", "null", "<none>", "<unknown>"}
CODE_BLOCK_PATTERN = re.compile(r"```[^\n]*\n(.*?)```", re.DOTALL)
STRUCTURED_BLOCK_PATTERN = re.compile(
    r"<(?P<tag>review_target|repo_context)\s+path\s*=\s*(?P<quote>[\"'])(?P<path>[^\"']+)(?P=quote)\s*>(?P<content>.*?)</(?P=tag)>",
    re.IGNORECASE | re.DOTALL,
)
DIFF_FILE_PATTERN = re.compile(r"^diff --git (?P<old>\S+) (?P<new>\S+)$")
DIFF_HUNK_PATTERN = re.compile(
    r"^@@ -\d+(?:,\d+)? \+(?P<new_start>\d+)(?:,\d+)? @@(?: .*)?$"
)

CODE_HINTS = (
    "def ",
    "class ",
    "import ",
    "from ",
    "const ",
    "let ",
    "function ",
    "return ",
    "=>",
    "{",
    "}",
)

BROAD_EXCEPTION_HEADER_PATTERN = re.compile(
    r"^\s*except(?:\s+(?:Exception|BaseException)(?:\s+as\s+\w+)?)?\s*:\s*(?P<inline>.*)$",
    re.IGNORECASE,
)
SWALLOW_ACTION_PATTERN = re.compile(r"^(?:pass\b|continue\b|return\s+None\b)")
MAX_SWALLOW_LOOKAHEAD = 3
MAX_SWALLOW_POSITION_GAP = 4
MAX_FORWARDED_CONTEXT_FILES = 4
MAX_FORWARDED_CONTEXT_LINES_PER_FILE = 80
MAX_FORWARDED_CONTEXT_LINES_TOTAL = 200
UNVALIDATED_UPSTREAM_RULE_ID = "external_review_issue"
UNVALIDATED_UPSTREAM_TITLE = "Potential issue in review target"
UNVALIDATED_UPSTREAM_FIX_ADVICE = (
    "Review manually; the upstream fix suggestion was not validated against the review target."
)
PATH_LIKE_TOKEN_PATTERN = re.compile(
    r"""(?ix)
    \b(
        [a-z]:[\\/][^\s"'`]+
        |
        [A-Za-z0-9_.-]+(?:[\\/][A-Za-z0-9_.-]+)+
        |
        [A-Za-z0-9_.-]+\.(?:py|ts|tsx|js|jsx|json|yaml|yml|md|java|go|rb|rs|cs|cpp|c|h)
    )\b
    """
)


@dataclass(slots=True)
class ReviewLine:
    text: str
    evidence: str
    position: int
    file_path: str | None = None
    line_number: int | None = None


@dataclass(slots=True)
class ReviewInput:
    kind: InputKind
    raw_text: str
    lines: list[ReviewLine]
    files_reviewed: tuple[str, ...] = ()
    context_file_paths: tuple[str, ...] = ()
    review_target_path: str | None = None


@dataclass(frozen=True, slots=True)
class StructuredReviewPayload:
    review_target_text: str
    review_target_path: str | None = None
    context_file_paths: tuple[str, ...] = ()
    context_blocks: tuple[tuple[str, str], ...] = ()
    uses_structured_input: bool = False


@dataclass(slots=True)
class ReviewFinding:
    rule_id: str
    title: str
    severity: Severity
    evidence: str
    advice: str
    position: int
    file_path: str | None = None
    line_number: int | None = None


@dataclass(frozen=True, slots=True)
class RuleSpec:
    rule_id: str
    title: str
    severity: Severity
    patterns: tuple[re.Pattern[str], ...]
    advice: str


@dataclass(frozen=True, slots=True)
class PreparedReview:
    payload: StructuredReviewPayload
    review_input: ReviewInput
    forwarded_context: tuple[upstream_review.UpstreamContextBlock, ...] = ()


RULES: tuple[RuleSpec, ...] = (
    RuleSpec(
        rule_id="hardcoded_secret",
        title="Hardcoded secret",
        severity="high",
        patterns=(
            re.compile(
                r"""(?ix)
                \b(?:api[_-]?key|secret|token|password|passwd|access_token|client_secret)\b
                [^=\n:]{0,20}
                (?:
                    =|:
                )
                \s*
                (?:
                    ["'][^"'\n]{6,}["']
                )
                """
            ),
            re.compile(r"Bearer\s+[A-Za-z0-9._-]{10,}", re.IGNORECASE),
            re.compile(r"\bsk-[A-Za-z0-9]{10,}\b"),
        ),
        advice=(
            "Move the credential into environment variables or secret storage and load it at runtime."
        ),
    ),
    RuleSpec(
        rule_id="dangerous_eval_or_exec",
        title="Dangerous dynamic execution",
        severity="high",
        patterns=(
            re.compile(r"\beval\s*\("),
            re.compile(r"\bexec\s*\("),
            re.compile(r"\bnew\s+Function\s*\("),
        ),
        advice="Replace dynamic execution with explicit parsing or a constrained dispatch table.",
    ),
    RuleSpec(
        rule_id="unsafe_html_sink",
        title="Unsafe HTML sink",
        severity="high",
        patterns=(
            re.compile(r"\binnerHTML\s*="),
            re.compile(r"\bdangerouslySetInnerHTML\b"),
        ),
        advice="Avoid raw HTML sinks; sanitize trusted content or render structured data instead.",
    ),
    RuleSpec(
        rule_id="shell_command_execution",
        title="Shell command execution",
        severity="high",
        patterns=(
            re.compile(
                r"\bsubprocess\.(?:run|Popen|call|check_call|check_output)\s*\([^)]*\bshell\s*=\s*True\b"
            ),
            re.compile(r"\bos\.system\s*\("),
            re.compile(r"\bchild_process\.(?:exec|execSync)\s*\("),
        ),
        advice=(
            "Avoid shell-based execution when possible; prefer argument arrays, allowlists, and explicit escaping."
        ),
    ),
    RuleSpec(
        rule_id="tls_verification_disabled",
        title="TLS verification disabled",
        severity="high",
        patterns=(
            re.compile(r"\bverify\s*=\s*False\b"),
            re.compile(r"\brejectUnauthorized\s*:\s*false\b"),
            re.compile(r"\bssl\._create_unverified_context\s*\("),
        ),
        advice="Keep certificate verification enabled and trust only known CAs or pinned certificates.",
    ),
    RuleSpec(
        rule_id="debug_artifact",
        title="Debug artifact",
        severity="low",
        patterns=(
            re.compile(r"\bconsole\.log\s*\("),
            re.compile(r"\bprint\s*\("),
            re.compile(r"\bdebugger\b"),
            re.compile(r"\bpdb\.set_trace\s*\("),
        ),
        advice="Remove the debug statement or replace it with structured, production-safe logging.",
    ),
)

BROAD_EXCEPTION_SWALLOW_RULE = RuleSpec(
    rule_id="broad_exception_swallow",
    title="Broad exception swallow",
    severity="medium",
    patterns=(),
    advice=(
        "Catch a narrower exception type and handle or re-raise it with context instead of swallowing everything."
    ),
)

KNOWN_RULE_SPECS: dict[str, RuleSpec] = {
    rule.rule_id: rule for rule in (*RULES, BROAD_EXCEPTION_SWALLOW_RULE)
}


def extract_review_text(text: str) -> str:
    blocks = [block.strip() for block in CODE_BLOCK_PATTERN.findall(text) if block.strip()]
    if blocks:
        return "\n\n".join(blocks)
    return text.strip()


def detect_input_kind(text: str, source_text: str) -> InputKind:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    diff_markers = ("diff --git", "@@", "--- ", "+++ ")
    if any(any(line.startswith(marker) for marker in diff_markers) for line in lines):
        return "unified_diff"
    if "```" in source_text or any(hint in text for hint in CODE_HINTS):
        return "code_snippet"
    return "plain_text"


def normalize_diff_path(path: str) -> str | None:
    normalized = path.strip().strip('"')
    if not normalized or normalized == "/dev/null":
        return None
    if normalized.startswith(("a/", "b/")):
        return normalized[2:]
    return normalized


def normalize_live_finding_path(path: str | None) -> str | None:
    if path is None:
        return None

    normalized = path.strip().strip('"').strip("'")
    if normalized.startswith(("a/", "b/")):
        normalized = normalized[2:].strip()

    if not normalized or normalized.lower() in PLACEHOLDER_FILE_PATHS:
        return None
    if normalized == "/dev/null":
        return None
    return normalized


def normalize_context_path(path: str | None) -> str | None:
    return normalize_live_finding_path(path)


def normalize_context_content(content: str) -> str:
    return "\n".join(line for line in content.splitlines() if line.strip())


def ordered_unique(values: list[str]) -> tuple[str, ...]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            unique.append(value)
    return tuple(unique)


def split_path_parts(path: str | None) -> tuple[str, ...]:
    if not path:
        return ()
    return tuple(part for part in path.split("/") if part)


def context_relationship_priority(
    relationship: upstream_review.ContextRelationship,
) -> int:
    return {"same_dir": 0, "same_top_level": 1, "same_extension": 2, "other": 3}[relationship]


def path_relationship(
    review_target_path: str | None,
    context_path: str,
) -> upstream_review.ContextRelationship:
    target_parts = split_path_parts(review_target_path)
    context_parts = split_path_parts(context_path)
    if not target_parts or not context_parts:
        return "other"

    target_dir = target_parts[:-1]
    context_dir = context_parts[:-1]
    if target_dir == context_dir:
        return "same_dir"
    if target_parts[0] == context_parts[0]:
        return "same_top_level"

    target_name = target_parts[-1]
    context_name = context_parts[-1]
    if "." in target_name and "." in context_name:
        target_ext = target_name.rsplit(".", 1)[1]
        context_ext = context_name.rsplit(".", 1)[1]
        if target_ext == context_ext:
            return "same_extension"
    return "other"


def preprocess_forwarded_context(
    payload: StructuredReviewPayload,
) -> tuple[upstream_review.UpstreamContextBlock, ...]:
    normalized_target_path = normalize_context_path(payload.review_target_path)
    unique_contexts: list[tuple[str, str, int]] = []
    seen_paths: set[str] = set()

    for index, (raw_path, raw_content) in enumerate(payload.context_blocks):
        normalized_path = normalize_context_path(raw_path)
        if normalized_path is None or normalized_path == normalized_target_path:
            continue

        normalized_content = normalize_context_content(raw_content)
        if not normalized_content or normalized_path in seen_paths:
            continue

        seen_paths.add(normalized_path)
        unique_contexts.append((normalized_path, normalized_content, index))

    if normalized_target_path is not None:
        unique_contexts.sort(
            key=lambda item: (
                context_relationship_priority(
                    path_relationship(normalized_target_path, item[0])
                ),
                item[2],
            )
        )

    forwarded_context: list[upstream_review.UpstreamContextBlock] = []
    remaining_total_lines = MAX_FORWARDED_CONTEXT_LINES_TOTAL

    for normalized_path, normalized_content, _ in unique_contexts:
        if len(forwarded_context) >= MAX_FORWARDED_CONTEXT_FILES or remaining_total_lines <= 0:
            break

        content_lines = normalized_content.splitlines()
        line_limit = min(MAX_FORWARDED_CONTEXT_LINES_PER_FILE, remaining_total_lines)
        kept_lines = content_lines[:line_limit]
        if not kept_lines:
            continue

        truncated = len(kept_lines) < len(content_lines)
        forwarded_content = "\n".join(kept_lines)
        if truncated:
            forwarded_content = f"{forwarded_content}\n... [truncated]"

        forwarded_context.append(
            upstream_review.UpstreamContextBlock(
                path=normalized_path,
                content=forwarded_content,
                relationship=path_relationship(normalized_target_path, normalized_path),
                truncated=truncated,
            )
        )
        remaining_total_lines -= len(kept_lines)

    return tuple(forwarded_context)


def extract_structured_review_payload(text: str) -> StructuredReviewPayload:
    stripped = text.strip()
    review_target_match = STRUCTURED_BLOCK_PATTERN.search(text)
    if not review_target_match:
        return StructuredReviewPayload(review_target_text=stripped)

    if review_target_match.group("tag").lower() != "review_target":
        return StructuredReviewPayload(review_target_text=stripped)

    review_target_content = review_target_match.group("content").strip()
    review_target_path = review_target_match.group("path").strip()
    if not review_target_path or not extract_review_text(review_target_content):
        return StructuredReviewPayload(review_target_text=stripped)

    context_paths: list[str] = []
    context_blocks: list[tuple[str, str]] = []
    for match in STRUCTURED_BLOCK_PATTERN.finditer(text):
        if match.group("tag").lower() != "repo_context":
            continue
        context_content = match.group("content").strip()
        context_path = match.group("path").strip()
        normalized_context = extract_review_text(context_content)
        if not context_path or not normalized_context:
            continue
        context_paths.append(context_path)
        context_blocks.append((context_path, normalized_context))

    return StructuredReviewPayload(
        review_target_text=review_target_content,
        review_target_path=review_target_path,
        context_file_paths=ordered_unique(context_paths),
        context_blocks=tuple(context_blocks),
        uses_structured_input=True,
    )


def build_diff_review_input(
    source_text: str,
    *,
    default_file_path: str | None = None,
    context_file_paths: tuple[str, ...] = (),
) -> ReviewInput:
    raw_lines = source_text.splitlines()
    lines: list[ReviewLine] = []
    files_reviewed: list[str] = []
    current_file: str | None = None
    current_new_line: int | None = None

    for position, raw_line in enumerate(raw_lines, start=1):
        header_match = DIFF_FILE_PATTERN.match(raw_line)
        if header_match:
            current_file = normalize_diff_path(header_match.group("new"))
            current_new_line = None
            if current_file:
                files_reviewed.append(current_file)
            continue

        if raw_line.startswith("--- "):
            continue

        if raw_line.startswith("+++ "):
            current_file = normalize_diff_path(raw_line[4:]) or current_file
            if current_file:
                files_reviewed.append(current_file)
            continue

        hunk_match = DIFF_HUNK_PATTERN.match(raw_line)
        if hunk_match:
            current_new_line = int(hunk_match.group("new_start"))
            continue

        if raw_line.startswith("+") and not raw_line.startswith("+++"):
            file_path = current_file or default_file_path or "<unknown>"
            files_reviewed.append(file_path)
            content = raw_line[1:]
            if content.strip():
                lines.append(
                    ReviewLine(
                        text=content,
                        evidence=content,
                        position=position,
                        file_path=file_path,
                        line_number=current_new_line,
                    )
                )
            if current_new_line is not None:
                current_new_line += 1
            continue

        if raw_line.startswith(" ") and current_new_line is not None:
            current_new_line += 1
            continue

        if raw_line.startswith("-") and not raw_line.startswith("---"):
            continue

    return ReviewInput(
        kind="unified_diff",
        raw_text=source_text,
        lines=lines,
        files_reviewed=ordered_unique(files_reviewed),
        context_file_paths=context_file_paths,
        review_target_path=default_file_path,
    )


def build_review_input(
    text: str,
    *,
    default_file_path: str | None = None,
    context_file_paths: tuple[str, ...] = (),
) -> ReviewInput:
    source_text = extract_review_text(text)
    kind = detect_input_kind(source_text, text)

    if kind == "unified_diff":
        return build_diff_review_input(
            source_text,
            default_file_path=default_file_path,
            context_file_paths=context_file_paths,
        )

    raw_lines = source_text.splitlines() or ([source_text] if source_text else [])
    lines: list[ReviewLine] = []

    for position, raw_line in enumerate(raw_lines, start=1):
        if raw_line.strip():
            lines.append(
                ReviewLine(
                    text=raw_line,
                    evidence=raw_line,
                    position=position,
                    file_path=default_file_path,
                    line_number=position if default_file_path else None,
                )
            )

    files_reviewed = (default_file_path,) if default_file_path else ()
    return ReviewInput(
        kind=kind,
        raw_text=source_text,
        lines=lines,
        files_reviewed=files_reviewed,
        context_file_paths=context_file_paths,
        review_target_path=default_file_path,
    )


def shorten_evidence(text: str, limit: int = 96) -> str:
    compact = " ".join(text.strip().split())
    if len(compact) <= limit:
        return compact
    return f"{compact[: limit - 3]}..."


def normalize_anchor_text(text: str) -> str:
    return " ".join(text.strip().split())


def normalize_path_reference(text: str) -> str:
    return text.strip().strip("\"'`").rstrip(".,:;!?)]}").replace("\\", "/")


def allowed_governed_path_references(*paths: str | None) -> set[str]:
    references: set[str] = set()
    for path in paths:
        if not path:
            continue
        normalized = normalize_path_reference(path)
        if not normalized:
            continue
        references.add(normalized)
        basename = normalized.rsplit("/", 1)[-1]
        if basename:
            references.add(basename)
    return references


def extract_substantive_governed_identifiers(
    text: str,
    reference_identifiers: set[str],
) -> set[str]:
    substantive: set[str] = set()
    for token in upstream_review.IDENTIFIER_PATTERN.findall(text):
        normalized = token.lower()
        if normalized in upstream_review.LOW_INFO_IDENTIFIERS:
            continue
        if (
            normalized in reference_identifiers
            or "_" in token
            or any(character.isdigit() for character in token)
            or any(character.isupper() for character in token[1:])
        ):
            substantive.add(normalized)
    return substantive


def collect_live_upstream_reference_identifiers(
    review_input: ReviewInput,
    *,
    review_target_path: str | None,
    file_path: str | None,
    evidence: str,
) -> set[str]:
    reference_identifiers = set(upstream_review.extract_identifiers(review_input.raw_text))
    reference_identifiers.update(upstream_review.extract_identifiers(evidence))
    reference_identifiers.update(upstream_review.extract_identifiers(file_path or ""))
    reference_identifiers.update(upstream_review.extract_identifiers(review_target_path or ""))
    return reference_identifiers


def normalize_unknown_live_rule_id(rule_id: str) -> str:
    normalized_rule_id = rule_id.strip()
    if len(normalized_rule_id) < 3 or len(normalized_rule_id) > 64:
        return UNVALIDATED_UPSTREAM_RULE_ID

    if normalized_rule_id != normalized_rule_id.lower():
        return UNVALIDATED_UPSTREAM_RULE_ID

    if not re.fullmatch(r"[a-z0-9_-]+", normalized_rule_id):
        return UNVALIDATED_UPSTREAM_RULE_ID

    if PATH_LIKE_TOKEN_PATTERN.search(normalized_rule_id):
        return UNVALIDATED_UPSTREAM_RULE_ID

    return normalized_rule_id


def normalize_unknown_live_title(
    review_input: ReviewInput,
    *,
    review_target_path: str | None,
    file_path: str | None,
    evidence: str,
    title: str,
) -> str:
    normalized_title = normalize_anchor_text(title)
    if not normalized_title:
        return UNVALIDATED_UPSTREAM_TITLE

    allowed_paths = allowed_governed_path_references(file_path, review_target_path)
    referenced_paths = {
        normalize_path_reference(match.group(1))
        for match in PATH_LIKE_TOKEN_PATTERN.finditer(title)
    }
    if referenced_paths and not referenced_paths.issubset(allowed_paths):
        return UNVALIDATED_UPSTREAM_TITLE

    reference_identifiers = collect_live_upstream_reference_identifiers(
        review_input,
        review_target_path=review_target_path,
        file_path=file_path,
        evidence=evidence,
    )
    substantive_identifiers = extract_substantive_governed_identifiers(
        title,
        reference_identifiers,
    )
    if not substantive_identifiers or substantive_identifiers.intersection(reference_identifiers):
        return normalized_title

    return UNVALIDATED_UPSTREAM_TITLE


def normalize_unknown_live_fix_advice(
    review_input: ReviewInput,
    *,
    review_target_path: str | None,
    file_path: str | None,
    evidence: str,
    fix: str,
) -> str:
    normalized_fix = normalize_anchor_text(fix)
    if not normalized_fix:
        return UNVALIDATED_UPSTREAM_FIX_ADVICE

    allowed_paths = allowed_governed_path_references(file_path, review_target_path)
    referenced_paths = {
        normalize_path_reference(match.group(1))
        for match in PATH_LIKE_TOKEN_PATTERN.finditer(fix)
    }
    if referenced_paths and not referenced_paths.issubset(allowed_paths):
        return UNVALIDATED_UPSTREAM_FIX_ADVICE

    reference_identifiers = collect_live_upstream_reference_identifiers(
        review_input,
        review_target_path=review_target_path,
        file_path=file_path,
        evidence=evidence,
    )
    substantive_identifiers = extract_substantive_governed_identifiers(
        fix,
        reference_identifiers,
    )
    if not substantive_identifiers or substantive_identifiers.intersection(reference_identifiers):
        return normalized_fix

    return UNVALIDATED_UPSTREAM_FIX_ADVICE


def line_indent(text: str) -> int:
    return len(text) - len(text.lstrip(" \t"))


def build_rule_finding(
    rule: RuleSpec,
    line: ReviewLine,
    evidence: str | None = None,
) -> ReviewFinding:
    return ReviewFinding(
        rule_id=rule.rule_id,
        title=rule.title,
        severity=rule.severity,
        evidence=shorten_evidence(evidence or line.evidence),
        advice=rule.advice,
        position=line.position,
        file_path=line.file_path,
        line_number=line.line_number,
    )


def collect_broad_exception_findings(review_input: ReviewInput) -> list[ReviewFinding]:
    findings: list[ReviewFinding] = []
    seen_files: set[str | None] = set()

    for index, line in enumerate(review_input.lines):
        match = BROAD_EXCEPTION_HEADER_PATTERN.match(line.text)
        if not match:
            continue
        if line.file_path in seen_files:
            continue

        inline_action = match.group("inline").strip()
        if inline_action and SWALLOW_ACTION_PATTERN.match(inline_action):
            findings.append(
                build_rule_finding(
                    BROAD_EXCEPTION_SWALLOW_RULE,
                    line,
                    f"{line.text.strip()} -> {inline_action}",
                )
            )
            seen_files.add(line.file_path)
            continue

        header_indent = line_indent(line.text)
        for next_line in review_input.lines[index + 1:index + 1 + MAX_SWALLOW_LOOKAHEAD]:
            if next_line.file_path != line.file_path:
                break
            if next_line.position - line.position > MAX_SWALLOW_POSITION_GAP:
                break
            if line_indent(next_line.text) <= header_indent:
                break

            nested_text = next_line.text.strip()
            if not nested_text or nested_text.startswith("#"):
                continue
            if SWALLOW_ACTION_PATTERN.match(nested_text):
                findings.append(
                    build_rule_finding(
                        BROAD_EXCEPTION_SWALLOW_RULE,
                        line,
                        f"{line.text.strip()} -> {nested_text}",
                    )
                )
                seen_files.add(line.file_path)
            break

    return findings


def collect_findings(review_input: ReviewInput) -> list[ReviewFinding]:
    findings: list[ReviewFinding] = []
    seen_rule_locations: set[tuple[str, str | None]] = set()

    for rule in RULES:
        for line in review_input.lines:
            if any(pattern.search(line.text) for pattern in rule.patterns):
                dedupe_key = (rule.rule_id, line.file_path)
                if dedupe_key in seen_rule_locations:
                    continue
                seen_rule_locations.add(dedupe_key)
                findings.append(build_rule_finding(rule, line))

    findings.extend(collect_broad_exception_findings(review_input))

    return sort_and_limit_findings(findings)


def sort_and_limit_findings(findings: list[ReviewFinding]) -> list[ReviewFinding]:
    findings.sort(
        key=lambda finding: (
            SEVERITY_ORDER[finding.severity],
            1 if finding.file_path is None else 0,
            finding.file_path or "",
            float("inf") if finding.line_number is None else finding.line_number,
            finding.position,
            finding.rule_id,
        )
    )
    return findings[:MAX_FINDINGS]


def collect_reviewable_line_numbers(review_input: ReviewInput) -> dict[str, set[int]]:
    reviewable_line_numbers: dict[str, set[int]] = {}
    for line in review_input.lines:
        if line.file_path is None or line.line_number is None:
            continue
        reviewable_line_numbers.setdefault(line.file_path, set()).add(line.line_number)
    return reviewable_line_numbers


def evidence_is_anchored_to_review_target(
    review_input: ReviewInput,
    *,
    file_path: str | None,
    line_number: int | None,
    evidence: str,
) -> bool:
    normalized_evidence = normalize_anchor_text(evidence)
    if not normalized_evidence:
        return False

    candidate_lines = [
        line
        for line in review_input.lines
        if (
            (file_path is None or line.file_path == file_path)
            and (line_number is None or line.line_number == line_number)
        )
    ]
    if candidate_lines:
        return any(
            normalized_evidence in normalize_anchor_text(line.evidence)
            for line in candidate_lines
        )

    if file_path is not None:
        file_lines = [line for line in review_input.lines if line.file_path == file_path]
        if file_lines:
            return any(
                normalized_evidence in normalize_anchor_text(line.evidence)
                for line in file_lines
            )

    return normalized_evidence in normalize_anchor_text(review_input.raw_text)


def normalize_live_finding_line_number(
    review_input: ReviewInput,
    *,
    file_path: str | None,
    line_number: int | None,
    reviewable_line_numbers: dict[str, set[int]],
) -> int | None:
    if file_path is None or line_number is None:
        return None if file_path is None else line_number

    if review_input.kind == "unified_diff":
        allowed_line_numbers = reviewable_line_numbers.get(file_path, set())
        return line_number if line_number in allowed_line_numbers else None

    return line_number if 1 <= line_number <= len(review_input.lines) else None


def normalize_live_upstream_findings(
    prepared_review: PreparedReview,
    findings: list[upstream_review.UpstreamFindingPayload],
) -> list[ReviewFinding] | None:
    if not findings:
        return []

    review_input = prepared_review.review_input
    review_target_path = normalize_live_finding_path(review_input.review_target_path)
    context_paths = {
        path
        for path in (
            normalize_live_finding_path(context_path)
            for context_path in prepared_review.payload.context_file_paths
        )
        if path is not None
    }
    allowed_diff_paths = {
        path
        for path in (
            normalize_live_finding_path(file_path)
            for file_path in review_input.files_reviewed
        )
        if path is not None
    }
    reviewable_line_numbers = collect_reviewable_line_numbers(review_input)

    normalized_findings: list[ReviewFinding] = []
    seen_display_keys: set[tuple[str, str | None, int | None, str, str]] = set()

    for position, finding in enumerate(findings, start=1):
        file_path = normalize_live_finding_path(finding.file_path)
        if file_path in context_paths:
            continue

        if review_input.kind == "unified_diff":
            if file_path is not None and file_path not in allowed_diff_paths:
                continue
        elif file_path is not None and file_path != review_target_path:
            file_path = review_target_path

        evidence = shorten_evidence(finding.evidence)
        line_number = normalize_live_finding_line_number(
            review_input,
            file_path=file_path,
            line_number=finding.line_number,
            reviewable_line_numbers=reviewable_line_numbers,
        )
        if not evidence_is_anchored_to_review_target(
            review_input,
            file_path=file_path,
            line_number=line_number,
            evidence=evidence,
        ):
            continue

        known_rule = KNOWN_RULE_SPECS.get(finding.rule_id)
        rule_id = (
            known_rule.rule_id
            if known_rule
            else normalize_unknown_live_rule_id(finding.rule_id)
        )
        title = (
            known_rule.title
            if known_rule
            else normalize_unknown_live_title(
                review_input,
                review_target_path=review_target_path,
                file_path=file_path,
                evidence=evidence,
                title=finding.title,
            )
        )
        severity = known_rule.severity if known_rule else finding.severity
        advice = (
            known_rule.advice
            if known_rule
            else normalize_unknown_live_fix_advice(
                review_input,
                review_target_path=review_target_path,
                file_path=file_path,
                evidence=evidence,
                fix=finding.fix,
            )
        )

        display_key = (
            rule_id,
            file_path,
            line_number,
            evidence,
            advice,
        )
        if display_key in seen_display_keys:
            continue
        seen_display_keys.add(display_key)

        normalized_findings.append(
            ReviewFinding(
                rule_id=rule_id,
                title=title,
                severity=severity,
                evidence=evidence,
                advice=advice,
                position=position,
                file_path=file_path,
                line_number=line_number,
            )
        )

    return normalized_findings or None


def format_file_location(file_path: str, line_number: int | None) -> str:
    return f"{file_path}:{line_number}" if line_number is not None else file_path


def format_review(
    review_input: ReviewInput,
    findings: list[ReviewFinding],
    *,
    external_model_used: bool = False,
) -> str:
    sections = [
        "Summary",
        f"- Input type: {review_input.kind}",
        f"- Files reviewed: {len(review_input.files_reviewed)}",
        f"- Reviewed lines: {len(review_input.lines)}",
        f"- Context files supplied: {len(review_input.context_file_paths)}",
        f"- Findings found: {len(findings)}",
    ]

    if review_input.review_target_path:
        sections.append(f"- Review target path: {review_input.review_target_path}")

    sections.extend(["", "Findings"])

    if findings:
        for index, finding in enumerate(findings, start=1):
            file_location = (
                format_file_location(finding.file_path, finding.line_number)
                if finding.file_path
                else "<none>"
            )
            sections.extend(
                [
                    f"{index}. Title: {finding.title}",
                    f"   Rule ID: {finding.rule_id}",
                    f"   Severity: {finding.severity}",
                    f"   File: {file_location}",
                    f"   Evidence: {finding.evidence}",
                    f"   Fix: {finding.advice}",
                ]
            )
    else:
        sections.extend(
            [
                "- None",
                "  Note: No deterministic findings. This heuristic review only checks a small fixed rule set and does not prove the code is safe.",
            ]
        )

    sections.extend(
        [
            "",
            "Limitations",
            "- Deterministic heuristics only; only the latest user message was analyzed.",
            "- Structured repo context input is supported, but findings are only produced from the review target.",
            (
                "- No cross-file control-flow analysis or full-repository reasoning is used; external model reasoning is limited to the review target and supplied repo context."
                if external_model_used
                else "- No cross-file control-flow analysis, full-repository reasoning, or external model reasoning is used."
            ),
            "- A clean result does not prove the code is safe.",
        ]
    )
    return "\n".join(sections)


class CodeReviewAgent:
    def __init__(
        self,
        agent_name: str,
        *,
        review_backend: ReviewBackend = "heuristic",
        upstream_settings: upstream_review.UpstreamReviewSettings | None = None,
    ) -> None:
        self.agent_name = agent_name
        self.review_backend = review_backend
        self.upstream_settings = upstream_settings or upstream_review.UpstreamReviewSettings()

    def _prepare_messages(
        self,
        messages: list[dict[str, str]],
    ) -> tuple[str, PreparedReview]:
        prompt_text = "\n".join(message.get("content", "") for message in messages)
        latest_user_message = self._latest_user_message(messages)
        prepared_review = self.prepare_review_text(latest_user_message)
        return prompt_text, prepared_review

    async def complete(self, messages: list[dict[str, str]]) -> CompletionResult:
        prompt_text, prepared_review = self._prepare_messages(messages)
        content = await self._render_review_async(prepared_review)
        return CompletionResult(
            content=content,
            prompt_tokens=estimate_tokens(prompt_text),
            completion_tokens=estimate_tokens(content),
        )

    def stream_chunks(self, content: str) -> list[str]:
        return iter_text_chunks(content)

    async def stream_review_chunks(
        self,
        messages: list[dict[str, str]],
    ) -> AsyncIterator[str]:
        _, prepared_review = self._prepare_messages(messages)
        content = await self._render_review_async(
            prepared_review,
            prefer_upstream_streaming=True,
        )
        for piece in iter_text_chunks(content):
            yield piece

    def prepare_review_text(self, text: str) -> PreparedReview:
        payload = extract_structured_review_payload(text)
        review_input = build_review_input(
            payload.review_target_text,
            default_file_path=payload.review_target_path,
            context_file_paths=payload.context_file_paths,
        )
        return PreparedReview(
            payload=payload,
            review_input=review_input,
            forwarded_context=preprocess_forwarded_context(payload),
        )

    def review_text(self, text: str) -> str:
        prepared_review = self.prepare_review_text(text)
        if self.review_backend == "upstream_openai_compatible":
            return asyncio.run(self._render_review_async(prepared_review))
        return self._render_review_sync(prepared_review)

    async def review_text_async(self, text: str) -> str:
        prepared_review = self.prepare_review_text(text)
        return await self._render_review_async(prepared_review)

    def _latest_user_message(self, messages: list[dict[str, str]]) -> str:
        for message in reversed(messages):
            if message.get("role") == "user":
                return str(message.get("content", "")).strip()
        return ""

    def _render_review_sync(self, prepared_review: PreparedReview) -> str:
        if self.review_backend == "upstream_reserved":
            self._build_reserved_upstream_request(prepared_review)
        findings = collect_findings(prepared_review.review_input)
        return format_review(prepared_review.review_input, findings)

    async def _render_review_async(
        self,
        prepared_review: PreparedReview,
        *,
        prefer_upstream_streaming: bool = False,
    ) -> str:
        if self.review_backend == "heuristic":
            findings = collect_findings(prepared_review.review_input)
            return format_review(prepared_review.review_input, findings)

        if self.review_backend == "upstream_reserved":
            self._build_reserved_upstream_request(prepared_review)
            findings = collect_findings(prepared_review.review_input)
            return format_review(prepared_review.review_input, findings)

        live_findings = await self._collect_live_upstream_findings(
            prepared_review,
            prefer_streaming=prefer_upstream_streaming,
        )
        if live_findings is not None:
            return format_review(
                prepared_review.review_input,
                sort_and_limit_findings(live_findings),
                external_model_used=True,
            )

        findings = collect_findings(prepared_review.review_input)
        return format_review(prepared_review.review_input, findings)

    def _build_reserved_upstream_request(
        self,
        prepared_review: PreparedReview,
    ) -> upstream_review.UpstreamReviewRequest:
        return upstream_review.build_upstream_review_request(
            settings=self.upstream_settings,
            input_kind=prepared_review.review_input.kind,
            review_target_text=prepared_review.review_input.raw_text,
            review_target_path=prepared_review.payload.review_target_path,
            context_file_count=len(prepared_review.payload.context_blocks),
            forwarded_context=prepared_review.forwarded_context,
            uses_structured_input=prepared_review.payload.uses_structured_input,
        )

    async def _collect_live_upstream_findings(
        self,
        prepared_review: PreparedReview,
        *,
        prefer_streaming: bool = False,
    ) -> list[ReviewFinding] | None:
        if not upstream_review.has_live_upstream_configuration(self.upstream_settings):
            return None

        try:
            request = upstream_review.build_upstream_review_request(
                settings=self.upstream_settings,
                input_kind=prepared_review.review_input.kind,
                review_target_text=prepared_review.review_input.raw_text,
                review_target_path=prepared_review.payload.review_target_path,
                context_file_count=len(prepared_review.payload.context_blocks),
                forwarded_context=prepared_review.forwarded_context,
                uses_structured_input=prepared_review.payload.uses_structured_input,
            )
            if prefer_streaming:
                payload = await upstream_review.call_openai_compatible_review_stream(request)
            else:
                payload = await upstream_review.call_openai_compatible_review(request)
        except Exception:
            return None

        return normalize_live_upstream_findings(prepared_review, payload.findings)

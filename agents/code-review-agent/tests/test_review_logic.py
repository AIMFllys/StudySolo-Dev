import asyncio
import json
from types import SimpleNamespace

import pytest

from src.core.agent import (
    CodeReviewAgent,
    StructuredReviewPayload,
    UNVALIDATED_UPSTREAM_FIX_ADVICE,
    UNVALIDATED_UPSTREAM_TITLE,
    normalize_unknown_live_title,
    normalize_unknown_live_fix_advice,
    preprocess_forwarded_context,
)
import src.core.upstream_review as upstream_review_module
from src.core.upstream_review import UpstreamReviewSettings, build_upstream_review_request


def render_review(
    text: str,
    *,
    review_backend: str = "heuristic",
    upstream_settings: UpstreamReviewSettings | None = None,
) -> str:
    agent = CodeReviewAgent(
        agent_name="code-review",
        review_backend=review_backend,
        upstream_settings=upstream_settings,
    )
    return agent.review_text(text)


async def collect_stream_review(
    agent: CodeReviewAgent,
    messages: list[dict[str, str]],
) -> str:
    pieces: list[str] = []
    async for piece in agent.stream_review_chunks(messages):
        pieces.append(piece)
    return "".join(pieces)


def install_fake_upstream(
    monkeypatch,
    *,
    content: str | None = None,
    error: Exception | None = None,
    stream_chunks: list[str] | None = None,
    stream_error: Exception | None = None,
):
    state = {"instances": []}

    class FakeAsyncStream:
        def __init__(self, chunks: list[str], trailing_error: Exception | None):
            self._chunks = list(chunks)
            self._trailing_error = trailing_error

        def __aiter__(self):
            return self

        async def __anext__(self):
            if self._chunks:
                return SimpleNamespace(
                    choices=[
                        SimpleNamespace(
                            delta=SimpleNamespace(content=self._chunks.pop(0)),
                        )
                    ]
                )
            if self._trailing_error is not None:
                error_to_raise = self._trailing_error
                self._trailing_error = None
                raise error_to_raise
            raise StopAsyncIteration

        async def aclose(self):
            return None

    class FakeAsyncOpenAI:
        def __init__(self, *, base_url, api_key, timeout):
            instance = {
                "base_url": base_url,
                "api_key": api_key,
                "timeout": timeout,
                "calls": [],
            }

            async def create(**kwargs):
                instance["calls"].append(kwargs)
                if error is not None:
                    raise error
                if kwargs.get("stream"):
                    chunks = list(stream_chunks) if stream_chunks is not None else []
                    if not chunks and content is not None:
                        chunks = [content]
                    return FakeAsyncStream(chunks, stream_error)
                return SimpleNamespace(
                    choices=[
                        SimpleNamespace(
                            message=SimpleNamespace(content=content),
                        )
                    ]
                )

            self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))
            state["instances"].append(instance)

    monkeypatch.setattr(upstream_review_module, "AsyncOpenAI", FakeAsyncOpenAI)
    return state


@pytest.mark.parametrize(
    ("text", "expected_title", "expected_kind"),
    [
        (
            "```diff\n@@\n+const API_KEY = \"sk-test-1234567890\";\n```",
            "Hardcoded secret [high]",
            "unified_diff",
        ),
        (
            "```ts\nconsole.log('debug');\n```",
            "Debug artifact [low]",
            "code_snippet",
        ),
        (
            "```python\nexcept Exception:\n    return None\n```",
            "Broad exception swallow [medium]",
            "code_snippet",
        ),
        (
            "```tsx\n<div dangerouslySetInnerHTML={{ __html: html }} />\n```",
            "Unsafe HTML sink [high]",
            "code_snippet",
        ),
        (
            "```js\nconst fn = new Function('value', 'return value')\n```",
            "Dangerous dynamic execution [high]",
            "code_snippet",
        ),
        (
            "```python\nsubprocess.run(command, shell=True)\n```",
            "Shell command execution [high]",
            "code_snippet",
        ),
        (
            "```python\nrequests.get(url, verify=False)\n```",
            "TLS verification disabled [high]",
            "code_snippet",
        ),
    ],
)
def test_rule_findings_are_reported(text, expected_title, expected_kind):
    review = render_review(text)

    assert "Summary" in review
    assert f"- Input type: {expected_kind}" in review
    assert "- Context files supplied: 0" in review
    assert f"Title: {expected_title.removesuffix(' [high]').removesuffix(' [medium]').removesuffix(' [low]')}" in review
    assert "Limitations" in review


def test_clean_input_reports_no_findings():
    review = render_review("```ts\nconst total = items.length;\nreturn total;\n```")

    assert review.splitlines()[:6] == [
        "Summary",
        "- Input type: code_snippet",
        "- Files reviewed: 0",
        "- Reviewed lines: 2",
        "- Context files supplied: 0",
        "- Findings found: 0",
    ]
    assert "Findings found: 0" in review
    assert "Findings\n- None\n  Note: No deterministic findings." in review


def test_structured_review_target_assigns_path_to_snippet_findings():
    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
console.log('debug');
```
</review_target>"""
    )

    assert "- Review target path: frontend/app.tsx" in review
    assert "1. Title: Debug artifact" in review
    assert "Rule ID: debug_artifact" in review
    assert "Severity: low" in review
    assert "File: frontend/app.tsx:1" in review


def test_structured_review_target_path_is_used_for_headerless_diff():
    review = render_review(
        """<review_target path="frontend/unsafe.tsx">
```diff
@@ -4,0 +12,1 @@
+dangerouslySetInnerHTML = html
```
</review_target>"""
    )

    assert "1. Title: Unsafe HTML sink" in review
    assert "Rule ID: unsafe_html_sink" in review
    assert "Severity: high" in review
    assert "File: frontend/unsafe.tsx:12" in review


def test_repo_context_is_counted_but_not_reviewed():
    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>
<repo_context path="frontend/helper.ts">
```ts
console.log('debug');
```
</repo_context>
<repo_context path="backend/service.py">
```python
os.system("whoami")
```
</repo_context>"""
    )

    assert "- Context files supplied: 2" in review
    assert "Findings found: 0" in review
    assert "1. Title:" not in review
    assert "Shell command execution" not in review


def test_malformed_review_target_falls_back_to_legacy_parsing():
    review = render_review(
        """Please review this snippet:
<review_target path="frontend/app.tsx">
```ts
console.log('debug');
```"""
    )

    assert "1. Title: Debug artifact" in review
    assert "- Context files supplied: 0" in review
    assert "File: frontend/app.tsx:1" not in review


def test_broad_exception_swallow_detects_bare_except_with_nested_continue():
    review = render_review(
        "```python\ntry:\n    sync()\nexcept:\n    continue\n```"
    )

    assert "1. Title: Broad exception swallow" in review
    assert "Rule ID: broad_exception_swallow" in review
    assert "Severity: medium" in review


def test_safe_shell_and_tls_usage_do_not_trigger_findings():
    review = render_review(
        """```python
subprocess.run(["git", "status"], shell=False)
response = requests.get(url, verify=True)
ssl.create_default_context()
```"""
    )

    assert "Findings found: 0" in review
    assert "1. Title:" not in review
    assert "Shell command execution" not in review
    assert "TLS verification disabled" not in review


def test_complete_only_analyzes_latest_user_message():
    agent = CodeReviewAgent(agent_name="code-review")
    result = asyncio.run(
        agent.complete(
            [
                {"role": "user", "content": "```ts\nconsole.log('debug');\n```"},
                {"role": "assistant", "content": "Please send the next snippet."},
                {"role": "user", "content": "```ts\nconst total = items.length;\n```"},
            ]
        )
    )

    assert "No deterministic findings" in result.content
    assert "Title: Debug artifact" not in result.content


def test_complete_only_uses_latest_user_message_for_structured_repo_context():
    agent = CodeReviewAgent(agent_name="code-review")
    result = asyncio.run(
        agent.complete(
            [
                {
                    "role": "user",
                    "content": """<review_target path="frontend/old.tsx">
```ts
console.log('debug');
```
</review_target>""",
                },
                {"role": "assistant", "content": "Send the latest target."},
                {
                    "role": "user",
                    "content": """<review_target path="frontend/new.tsx">
```ts
const total = items.length;
```
</review_target>
<repo_context path="frontend/helper.ts">
```ts
console.log('debug');
```
</repo_context>""",
                },
            ]
        )
    )

    assert "Findings found: 0" in result.content
    assert "- Context files supplied: 1" in result.content
    assert "Title: Debug artifact" not in result.content


def test_unified_diff_only_reviews_added_lines():
    review = render_review("```diff\n@@\n- eval(userInput)\n+ safeCall(userInput)\n```")

    assert "- Input type: unified_diff" in review
    assert "No deterministic findings" in review


def test_multi_file_diff_reports_file_path_and_line_number():
    review = render_review(
        """```diff
diff --git a/frontend/app.tsx b/frontend/app.tsx
--- a/frontend/app.tsx
+++ b/frontend/app.tsx
@@ -8,2 +8,3 @@
 const ready = true;
+console.log('debug');
 export default ready;
diff --git a/backend/service.py b/backend/service.py
--- a/backend/service.py
+++ b/backend/service.py
@@ -20,2 +20,3 @@
 def handler():
+    token = "sk-test-1234567890"
     return "ok"
```"""
    )

    assert "- Files reviewed: 2" in review
    assert "- Reviewed lines: 2" in review
    assert "1. Title: Hardcoded secret" in review
    assert "Rule ID: hardcoded_secret" in review
    assert "2. Title: Debug artifact" in review
    assert "File: backend/service.py:21" in review
    assert "File: frontend/app.tsx:9" in review


def test_multi_file_diff_reports_new_rule_paths_and_line_numbers():
    review = render_review(
        """```diff
diff --git a/backend/runner.py b/backend/runner.py
--- a/backend/runner.py
+++ b/backend/runner.py
@@ -10,1 +10,2 @@
 def execute(command):
+    subprocess.run(command, shell=True)
diff --git a/frontend/http.ts b/frontend/http.ts
--- a/frontend/http.ts
+++ b/frontend/http.ts
@@ -4,1 +4,2 @@
 export async function load() {
+  return fetch(url, { agent: new https.Agent({ rejectUnauthorized: false }) })
```"""
    )

    assert "- Files reviewed: 2" in review
    assert "Title: Shell command execution" in review
    assert "Title: TLS verification disabled" in review
    assert "File: backend/runner.py:11" in review
    assert "File: frontend/http.ts:5" in review


def test_same_rule_same_file_only_reports_first_hit():
    review = render_review(
        """```diff
diff --git a/frontend/app.tsx b/frontend/app.tsx
--- a/frontend/app.tsx
+++ b/frontend/app.tsx
@@ -1,1 +1,3 @@
+console.log('first');
+console.log('second');
 export default true;
```"""
    )

    assert review.count("Rule ID: debug_artifact") == 1
    assert "File: frontend/app.tsx:1" in review


def test_same_broad_exception_rule_same_file_only_reports_first_hit():
    review = render_review(
        """```diff
diff --git a/backend/service.py b/backend/service.py
--- a/backend/service.py
+++ b/backend/service.py
@@ -1,1 +1,6 @@
+except Exception as exc:
+    pass
+except:
+    continue
```"""
    )

    assert review.count("Rule ID: broad_exception_swallow") == 1
    assert "File: backend/service.py:1" in review


def test_fragment_diff_falls_back_to_unknown_file_when_header_missing():
    review = render_review("```diff\n@@ -4,0 +12,1 @@\n+dangerouslySetInnerHTML: html\n```")

    assert "Title: Unsafe HTML sink" in review
    assert "File: <unknown>:12" in review


def test_clean_multi_file_diff_reports_no_findings():
    review = render_review(
        """```diff
diff --git a/frontend/app.tsx b/frontend/app.tsx
--- a/frontend/app.tsx
+++ b/frontend/app.tsx
@@ -2,1 +2,2 @@
 const total = items.length;
+const ready = total > 0;
diff --git a/backend/service.py b/backend/service.py
--- a/backend/service.py
+++ b/backend/service.py
@@ -10,1 +10,2 @@
 def handler():
+    return "ok"
```"""
    )

    assert "- Files reviewed: 2" in review
    assert "Findings found: 0" in review
    assert "Findings\n- None\n  Note: No deterministic findings." in review


def test_explicit_heuristic_backend_matches_default_output():
    text = "```ts\nconsole.log('debug');\n```"

    default_review = render_review(text)
    heuristic_review = render_review(text, review_backend="heuristic")

    assert heuristic_review == default_review


def test_upstream_reserved_backend_reuses_heuristic_output():
    text = """<review_target path="frontend/app.tsx">
```ts
console.log('debug');
```
</review_target>
<repo_context path="frontend/helper.ts">
```ts
export const helper = true;
```
</repo_context>"""

    heuristic_review = render_review(text)
    reserved_review = render_review(
        text,
        review_backend="upstream_reserved",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert reserved_review == heuristic_review


def test_upstream_openai_compatible_backend_normalizes_live_findings(monkeypatch):
    state = install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Temporary secret",
                        "rule_id": "hardcoded_secret",
                        "severity": "low",
                        "file_path": "frontend/app.tsx",
                        "line_number": 2,
                        "evidence": "token = 'sk-test-1234567890'",
                        "fix": "Delete the statement.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
const token = 'sk-test-1234567890';
return total;
```
</review_target>
<repo_context path="frontend/helper.ts">
```ts
export const helper = true;
```
</repo_context>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "1. Title: Hardcoded secret" in review
    assert "Rule ID: hardcoded_secret" in review
    assert "Severity: high" in review
    assert "File: frontend/app.tsx:2" in review
    assert (
        "Fix: Move the credential into environment variables or secret storage and load it at runtime."
        in review
    )
    assert "Temporary secret" not in review
    assert "Delete the statement." not in review
    assert (
        "external model reasoning is limited to the review target and supplied repo context"
        in review
    )
    assert len(state["instances"]) == 1
    assert state["instances"][0]["base_url"] == "https://example.test/v1"
    assert state["instances"][0]["calls"][0]["model"] == "review-upstream-v1"
    assert state["instances"][0]["calls"][0]["stream"] is False


def test_upstream_openai_compatible_backend_drops_repo_context_findings_and_falls_back(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Hardcoded secret",
                        "rule_id": "hardcoded_secret",
                        "severity": "high",
                        "file_path": "b/frontend/helper.ts",
                        "line_number": 1,
                        "evidence": "token = 'sk-test-1234567890'",
                        "fix": "Move the credential into environment variables.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
console.log('debug');
```
</review_target>
<repo_context path="frontend/helper.ts">
```ts
export const token = "sk-test-1234567890";
```
</repo_context>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "1. Title: Debug artifact" in review
    assert "Rule ID: debug_artifact" in review
    assert "Hardcoded secret" not in review
    assert "frontend/helper.ts" not in review
    assert "external model reasoning is limited" not in review


def test_upstream_openai_compatible_backend_canonicalizes_broad_exception_metadata(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Generic exception catch",
                        "rule_id": "broad_exception_swallow",
                        "severity": "low",
                        "file_path": "backend/service.py",
                        "line_number": 4,
                        "evidence": "except:",
                        "fix": "Ignore it.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="backend/service.py">
```py
def handler():
    try:
        call()
    except:
        continue
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "1. Title: Broad exception swallow" in review
    assert "Rule ID: broad_exception_swallow" in review
    assert "Severity: medium" in review
    assert "File: backend/service.py:4" in review
    assert (
        "Fix: Catch a narrower exception type and handle or re-raise it with context instead of swallowing everything."
        in review
    )
    assert "Generic exception catch" not in review
    assert "Ignore it." not in review


def test_upstream_openai_compatible_backend_maps_foreign_single_target_path_to_review_target(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Debug artifact",
                        "rule_id": "debug_artifact",
                        "severity": "low",
                        "file_path": " 'backend/service.py' ",
                        "line_number": 2,
                        "evidence": "return total;",
                        "fix": "Remove it.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "1. Title: Debug artifact" in review
    assert "Rule ID: debug_artifact" in review
    assert "File: frontend/app.tsx:2" in review
    assert "backend/service.py" not in review


def test_upstream_openai_compatible_backend_drops_unanchored_single_target_evidence_and_falls_back(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Debug artifact",
                        "rule_id": "debug_artifact",
                        "severity": "low",
                        "file_path": "frontend/app.tsx",
                        "line_number": 2,
                        "evidence": "console.log('debug')",
                        "fix": "Remove it.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "Findings found: 0" in review
    assert "Title: Debug artifact" not in review
    assert "external model reasoning is limited" not in review


def test_upstream_openai_compatible_backend_drops_foreign_multi_file_diff_findings(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Hardcoded secret",
                        "rule_id": "hardcoded_secret",
                        "severity": "high",
                        "file_path": " \"b/backend/service.py\" ",
                        "line_number": 21,
                        "evidence": "return \"ok\"",
                        "fix": "Move the credential into environment variables.",
                    },
                    {
                        "title": "Unsafe HTML sink",
                        "rule_id": "unsafe_html_sink",
                        "severity": "high",
                        "file_path": "docs/ignore.md",
                        "line_number": 1,
                        "evidence": "dangerouslySetInnerHTML = html",
                        "fix": "Avoid raw HTML sinks.",
                    },
                ]
            }
        ),
    )

    review = render_review(
        """```diff
diff --git a/frontend/app.tsx b/frontend/app.tsx
--- a/frontend/app.tsx
+++ b/frontend/app.tsx
@@ -8,2 +8,3 @@
 const ready = true;
+const total = items.length;
 export default ready;
diff --git a/backend/service.py b/backend/service.py
--- a/backend/service.py
+++ b/backend/service.py
@@ -20,2 +20,3 @@
 def handler():
+    return "ok"
     return "ok"
```""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "Findings found: 1" in review
    assert "1. Title: Hardcoded secret" in review
    assert "File: backend/service.py:21" in review
    assert "docs/ignore.md" not in review
    assert "Unsafe HTML sink" not in review


def test_upstream_openai_compatible_backend_drops_unanchored_multi_file_diff_evidence(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Hardcoded secret",
                        "rule_id": "hardcoded_secret",
                        "severity": "high",
                        "file_path": "backend/service.py",
                        "line_number": 21,
                        "evidence": "token = 'sk-test-1234567890'",
                        "fix": "Move the credential into environment variables.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """```diff
diff --git a/frontend/app.tsx b/frontend/app.tsx
--- a/frontend/app.tsx
+++ b/frontend/app.tsx
@@ -8,2 +8,3 @@
 const ready = true;
+const total = items.length;
 export default ready;
diff --git a/backend/service.py b/backend/service.py
--- a/backend/service.py
+++ b/backend/service.py
@@ -20,2 +20,3 @@
 def handler():
+    return "ok"
     return "ok"
```""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "Findings found: 0" in review
    assert "Title: Hardcoded secret" not in review
    assert "external model reasoning is limited" not in review


def test_upstream_openai_compatible_backend_clears_out_of_range_line_numbers(monkeypatch):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Hardcoded secret",
                        "rule_id": "hardcoded_secret",
                        "severity": "high",
                        "file_path": "frontend/app.tsx",
                        "line_number": 99,
                        "evidence": "const token = 'sk-test-1234567890';",
                        "fix": "Move the credential into environment variables.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
const token = 'sk-test-1234567890';
return total;
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "1. Title: Hardcoded secret" in review
    assert "File: frontend/app.tsx" in review
    assert "File: frontend/app.tsx:99" not in review


def test_upstream_openai_compatible_backend_keeps_anchored_evidence_after_line_number_is_cleared(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Hardcoded secret",
                        "rule_id": "hardcoded_secret",
                        "severity": "high",
                        "file_path": "frontend/app.tsx",
                        "line_number": 99,
                        "evidence": "return total;",
                        "fix": "Check the return path.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "1. Title: Hardcoded secret" in review
    assert "Evidence: return total;" in review
    assert "File: frontend/app.tsx" in review
    assert "File: frontend/app.tsx:99" not in review
    assert (
        "external model reasoning is limited to the review target and supplied repo context"
        in review
    )


def test_upstream_openai_compatible_backend_drops_unanchored_evidence_after_line_number_is_cleared(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Hardcoded secret",
                        "rule_id": "hardcoded_secret",
                        "severity": "high",
                        "file_path": "frontend/app.tsx",
                        "line_number": 99,
                        "evidence": "console.log('debug')",
                        "fix": "Remove it.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "Findings found: 0" in review
    assert "Title: Hardcoded secret" not in review
    assert "external model reasoning is limited" not in review


def test_upstream_openai_compatible_backend_deduplicates_normalized_findings(monkeypatch):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Debug artifact",
                        "rule_id": "debug_artifact",
                        "severity": "low",
                        "file_path": "frontend/app.tsx",
                        "line_number": 1,
                        "evidence": "console.log('debug')",
                        "fix": "Remove it.",
                    },
                    {
                        "title": "Temporary logger",
                        "rule_id": "debug_artifact",
                        "severity": "high",
                        "file_path": "a/frontend/app.tsx",
                        "line_number": 1,
                        "evidence": "console.log('debug')",
                        "fix": "Keep it for now.",
                    },
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
console.log('debug');
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "Findings found: 1" in review
    assert review.count("Rule ID: debug_artifact") == 1
    assert "Severity: low" in review
    assert (
        "Fix: Remove the debug statement or replace it with structured, production-safe logging."
        in review
    )
    assert "Temporary logger" not in review
    assert "Keep it for now." not in review
    assert (
        "external model reasoning is limited to the review target and supplied repo context"
        in review
    )


def test_upstream_openai_compatible_backend_preserves_unknown_rule_metadata_when_anchored(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Custom upstream rule",
                        "rule_id": "custom_rule",
                        "severity": "medium",
                        "file_path": "frontend/app.tsx",
                        "line_number": 2,
                        "evidence": "return total;",
                        "fix": "Use a safer helper.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "1. Title: Custom upstream rule" in review
    assert "Rule ID: custom_rule" in review
    assert "Severity: medium" in review
    assert "File: frontend/app.tsx:2" in review
    assert "Fix: Use a safer helper." in review


def test_upstream_openai_compatible_backend_preserves_unknown_rule_title_with_matching_identifier(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Total return issue",
                        "rule_id": "custom_rule",
                        "severity": "medium",
                        "file_path": "frontend/app.tsx",
                        "line_number": 2,
                        "evidence": "return total;",
                        "fix": "Review carefully.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "1. Title: Total return issue" in review
    assert "Rule ID: custom_rule" in review
    assert "Fix: Review carefully." in review


def test_upstream_openai_compatible_backend_rewrites_unknown_rule_title_with_foreign_identifier(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "CacheManager mismatch",
                        "rule_id": "custom_rule",
                        "severity": "medium",
                        "file_path": "frontend/app.tsx",
                        "line_number": 2,
                        "evidence": "return total;",
                        "fix": "Review carefully.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert f"1. Title: {UNVALIDATED_UPSTREAM_TITLE}" in review
    assert "Rule ID: custom_rule" in review
    assert "Fix: Review carefully." in review
    assert "CacheManager mismatch" not in review


def test_upstream_openai_compatible_backend_rewrites_unknown_rule_title_with_foreign_path(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Issue in backend/service.py",
                        "rule_id": "custom_rule",
                        "severity": "medium",
                        "file_path": "frontend/app.tsx",
                        "line_number": 2,
                        "evidence": "return total;",
                        "fix": "Review carefully.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert f"1. Title: {UNVALIDATED_UPSTREAM_TITLE}" in review
    assert "Rule ID: custom_rule" in review
    assert "Fix: Review carefully." in review
    assert "Issue in backend/service.py" not in review


def test_upstream_openai_compatible_backend_rewrites_unknown_rule_fix_with_foreign_identifier(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Custom upstream rule",
                        "rule_id": "custom_rule",
                        "severity": "medium",
                        "file_path": "frontend/app.tsx",
                        "line_number": 2,
                        "evidence": "return total;",
                        "fix": "Rename totalHelper before calling cacheManager.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "Rule ID: custom_rule" in review
    assert f"Fix: {UNVALIDATED_UPSTREAM_FIX_ADVICE}" in review
    assert "Rename totalHelper before calling cacheManager." not in review


def test_upstream_openai_compatible_backend_rewrites_unknown_rule_fix_with_foreign_path(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Custom upstream rule",
                        "rule_id": "custom_rule",
                        "severity": "medium",
                        "file_path": "frontend/app.tsx",
                        "line_number": 2,
                        "evidence": "return total;",
                        "fix": "Move the logic into backend/service.py.",
                    }
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "Rule ID: custom_rule" in review
    assert f"Fix: {UNVALIDATED_UPSTREAM_FIX_ADVICE}" in review
    assert "Move the logic into backend/service.py." not in review


def test_upstream_openai_compatible_backend_deduplicates_unknown_rule_fix_after_placeholder_rewrite(
    monkeypatch,
):
    install_fake_upstream(
        monkeypatch,
        content=json.dumps(
            {
                "findings": [
                    {
                        "title": "Custom upstream rule",
                        "rule_id": "custom_rule",
                        "severity": "medium",
                        "file_path": "frontend/app.tsx",
                        "line_number": 2,
                        "evidence": "return total;",
                        "fix": "Rename totalHelper before calling cacheManager.",
                    },
                    {
                        "title": "Custom upstream rule",
                        "rule_id": "custom_rule",
                        "severity": "medium",
                        "file_path": "frontend/app.tsx",
                        "line_number": 2,
                        "evidence": "return total;",
                        "fix": "Move the logic into backend/service.py.",
                    },
                ]
            }
        ),
    )

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "Findings found: 1" in review
    assert review.count("Rule ID: custom_rule") == 1
    assert review.count(UNVALIDATED_UPSTREAM_FIX_ADVICE) == 1


def test_normalize_unknown_live_title_rewrites_empty_title():
    review_input = CodeReviewAgent(agent_name="code-review").prepare_review_text(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>"""
    ).review_input

    title = normalize_unknown_live_title(
        review_input,
        review_target_path="frontend/app.tsx",
        file_path="frontend/app.tsx",
        evidence="return total;",
        title="   ",
    )

    assert title == UNVALIDATED_UPSTREAM_TITLE


def test_normalize_unknown_live_fix_advice_rewrites_empty_fix():
    review_input = CodeReviewAgent(agent_name="code-review").prepare_review_text(
        """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>"""
    ).review_input

    advice = normalize_unknown_live_fix_advice(
        review_input,
        review_target_path="frontend/app.tsx",
        file_path="frontend/app.tsx",
        evidence="return total;",
        fix="   ",
    )

    assert advice == UNVALIDATED_UPSTREAM_FIX_ADVICE


def test_upstream_openai_compatible_backend_accepts_empty_findings_without_fallback(
    monkeypatch,
):
    install_fake_upstream(monkeypatch, content='{"findings":[]}')

    review = render_review(
        """<review_target path="frontend/app.tsx">
```ts
console.log('debug');
```
</review_target>""",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    assert "Findings found: 0" in review
    assert "Title: Debug artifact" not in review
    assert (
        "external model reasoning is limited to the review target and supplied repo context"
        in review
    )


def test_upstream_openai_compatible_missing_config_falls_back_without_client(monkeypatch):
    state = install_fake_upstream(monkeypatch, content='{"findings":[]}')

    review = render_review(
        "```ts\nconsole.log('debug');\n```",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(model="review-upstream-v1"),
    )

    assert "1. Title: Debug artifact" in review
    assert len(state["instances"]) == 0


def test_upstream_openai_compatible_invalid_json_falls_back_to_heuristic(monkeypatch):
    install_fake_upstream(monkeypatch, content="not-json")

    review = render_review(
        "```ts\nconsole.log('debug');\n```",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
        ),
    )

    assert "1. Title: Debug artifact" in review
    assert "Rule ID: debug_artifact" in review


@pytest.mark.parametrize(
    "invalid_payload",
    [
        {
            "findings": [
                {
                    "title": "Debug artifact",
                    "rule_id": "debug_artifact",
                    "severity": "critical",
                    "file_path": "frontend/app.tsx",
                    "line_number": 1,
                    "evidence": "console.log('debug')",
                    "fix": "Remove it.",
                }
            ]
        },
        {
            "findings": [
                {
                    "title": "Debug artifact",
                    "rule_id": "debug_artifact",
                    "severity": "low",
                    "file_path": "frontend/app.tsx",
                    "line_number": 0,
                    "evidence": "console.log('debug')",
                    "fix": "Remove it.",
                }
            ]
        },
    ],
)
def test_upstream_openai_compatible_invalid_finding_fields_fall_back_to_heuristic(
    monkeypatch,
    invalid_payload,
):
    install_fake_upstream(monkeypatch, content=json.dumps(invalid_payload))

    review = render_review(
        "```ts\nconsole.log('debug');\n```",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
        ),
    )

    assert "1. Title: Debug artifact" in review
    assert "Severity: low" in review


def test_upstream_openai_compatible_exception_falls_back_to_heuristic(monkeypatch):
    install_fake_upstream(monkeypatch, error=TimeoutError("upstream timeout"))

    review = render_review(
        "```ts\nconsole.log('debug');\n```",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
        ),
    )

    assert "1. Title: Debug artifact" in review
    assert "external model reasoning is limited" not in review


def test_stream_review_chunks_with_upstream_openai_compatible_uses_provider_stream(monkeypatch):
    payload = json.dumps(
        {
            "findings": [
                {
                    "title": "Hardcoded secret",
                    "rule_id": "hardcoded_secret",
                    "severity": "high",
                    "file_path": "frontend/app.tsx",
                    "line_number": 2,
                    "evidence": "token = 'sk-test-1234567890'",
                    "fix": "Move the credential into environment variables.",
                }
            ]
        }
    )
    state = install_fake_upstream(
        monkeypatch,
        content=payload,
        stream_chunks=[payload[:24], payload[24:68], payload[68:]],
    )
    agent = CodeReviewAgent(
        agent_name="code-review",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )
    messages = [
        {
            "role": "user",
            "content": """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
const token = 'sk-test-1234567890';
return total;
```
</review_target>""",
        }
    ]

    stream_review = asyncio.run(collect_stream_review(agent, messages))
    non_stream_review = asyncio.run(agent.review_text_async(messages[0]["content"]))

    assert stream_review == non_stream_review
    assert "1. Title: Hardcoded secret" in stream_review
    assert state["instances"][0]["calls"][0]["stream"] is True


def test_stream_review_chunks_with_upstream_openai_compatible_falls_back_before_content(
    monkeypatch,
):
    state = install_fake_upstream(
        monkeypatch,
        stream_chunks=['{"findings": ['],
        stream_error=TimeoutError("upstream stream timeout"),
    )
    text = "```ts\nconsole.log('debug');\n```"
    agent = CodeReviewAgent(
        agent_name="code-review",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    stream_review = asyncio.run(
        collect_stream_review(agent, [{"role": "user", "content": text}])
    )
    heuristic_review = render_review(text)

    assert stream_review == heuristic_review
    assert "1. Title: Debug artifact" in stream_review
    assert "external model reasoning is limited" not in stream_review
    assert state["instances"][0]["calls"][0]["stream"] is True


def test_stream_review_chunks_with_upstream_openai_compatible_unanchored_evidence_falls_back(
    monkeypatch,
):
    payload = json.dumps(
        {
            "findings": [
                {
                    "title": "Hardcoded secret",
                    "rule_id": "hardcoded_secret",
                    "severity": "high",
                    "file_path": "frontend/app.tsx",
                    "line_number": 2,
                    "evidence": "console.log('debug')",
                    "fix": "Remove it.",
                }
            ]
        }
    )
    state = install_fake_upstream(
        monkeypatch,
        content=payload,
        stream_chunks=[payload[:24], payload[24:68], payload[68:]],
    )
    text = """<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>"""
    agent = CodeReviewAgent(
        agent_name="code-review",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    stream_review = asyncio.run(
        collect_stream_review(agent, [{"role": "user", "content": text}])
    )
    heuristic_review = render_review(text)

    assert stream_review == heuristic_review
    assert "Title: Hardcoded secret" not in stream_review
    assert "external model reasoning is limited" not in stream_review
    assert state["instances"][0]["calls"][0]["stream"] is True


def test_stream_review_chunks_with_upstream_openai_compatible_invalid_json_falls_back(
    monkeypatch,
):
    state = install_fake_upstream(
        monkeypatch,
        stream_chunks=["not-json"],
    )
    text = "```ts\nconsole.log('debug');\n```"
    agent = CodeReviewAgent(
        agent_name="code-review",
        review_backend="upstream_openai_compatible",
        upstream_settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=12.5,
        ),
    )

    stream_review = asyncio.run(
        collect_stream_review(agent, [{"role": "user", "content": text}])
    )
    heuristic_review = render_review(text)

    assert stream_review == heuristic_review
    assert "1. Title: Debug artifact" in stream_review
    assert state["instances"][0]["calls"][0]["stream"] is True


def test_prepare_review_text_legacy_message_uses_entire_text_as_target():
    agent = CodeReviewAgent(agent_name="code-review")
    prepared = agent.prepare_review_text("Please review:\n```ts\nconsole.log('debug');\n```")

    assert prepared.payload.review_target_path is None
    assert prepared.payload.context_blocks == ()
    assert prepared.review_input.raw_text == "console.log('debug');"


def test_prepare_review_text_malformed_structure_falls_back_to_legacy_target():
    agent = CodeReviewAgent(agent_name="code-review")
    prepared = agent.prepare_review_text(
        """Please review:
<review_target path="frontend/app.tsx">
```ts
console.log('debug');
```"""
    )

    assert prepared.payload.review_target_path is None
    assert prepared.payload.uses_structured_input is False
    assert "console.log('debug');" in prepared.review_input.raw_text


def test_prepare_review_text_drops_duplicate_and_review_target_repo_context_before_forwarding():
    agent = CodeReviewAgent(agent_name="code-review")
    prepared = agent.prepare_review_text(
        """<review_target path="frontend/app.tsx">
```ts
console.log('debug');
```
</review_target>
<repo_context path=" b/frontend/app.tsx ">
```ts
export const shouldNotForward = true;
```
</repo_context>
<repo_context path=" b/frontend/helper.ts ">
```ts
export const helper = "first";
```
</repo_context>
<repo_context path="frontend/helper.ts">
```ts
export const helper = "second";
```
</repo_context>
<repo_context path="<unknown>">
```ts
export const ignored = true;
```
</repo_context>"""
    )

    assert len(prepared.payload.context_blocks) == 4
    assert tuple(block.path for block in prepared.forwarded_context) == ("frontend/helper.ts",)
    assert prepared.forwarded_context[0].content == 'export const helper = "first";'
    assert prepared.forwarded_context[0].relationship == "same_dir"
    assert prepared.forwarded_context[0].truncated is False


def test_prepare_review_text_prioritizes_closer_repo_contexts_under_file_limit():
    agent = CodeReviewAgent(agent_name="code-review")
    prepared = agent.prepare_review_text(
        """<review_target path="frontend/components/app.tsx">
```tsx
export default function App() {
  return null;
}
```
</review_target>
<repo_context path="docs/readme.md">
```md
# docs
```
</repo_context>
<repo_context path="backend/render.tsx">
```tsx
export const backendView = true;
```
</repo_context>
<repo_context path="frontend/utils/math.ts">
```ts
export const add = (a, b) => a + b;
```
</repo_context>
<repo_context path="frontend/components/button.tsx">
```tsx
export function Button() {
  return null;
}
```
</repo_context>
<repo_context path="scripts/task.py">
```python
print("task")
```
</repo_context>"""
    )

    assert tuple(block.path for block in prepared.forwarded_context) == (
        "frontend/components/button.tsx",
        "frontend/utils/math.ts",
        "backend/render.tsx",
        "docs/readme.md",
    )
    assert tuple(block.relationship for block in prepared.forwarded_context) == (
        "same_dir",
        "same_top_level",
        "same_extension",
        "other",
    )


def test_prepare_review_text_truncates_long_repo_context_content():
    agent = CodeReviewAgent(agent_name="code-review")
    long_context = "\n".join(f"line {index}" for index in range(1, 86))
    prepared = agent.prepare_review_text(
        f"""<review_target path="frontend/app.tsx">
```ts
const total = items.length;
```
</review_target>
<repo_context path="frontend/logger.ts">
```ts
{long_context}
```
</repo_context>"""
    )

    forwarded = prepared.forwarded_context[0]
    assert forwarded.truncated is True
    assert "line 1" in forwarded.content
    assert "line 80" in forwarded.content
    assert "line 81" not in forwarded.content
    assert forwarded.content.endswith("... [truncated]")


def test_preprocess_forwarded_context_preserves_order_without_review_target_path():
    forwarded = preprocess_forwarded_context(
        StructuredReviewPayload(
            review_target_text="console.log('debug');",
            context_blocks=(
                (' "backend/a.py" ', "print('a')"),
                ("b/frontend/b.py", "print('b')"),
            ),
        )
    )

    assert tuple(block.path for block in forwarded) == ("backend/a.py", "frontend/b.py")
    assert tuple(block.relationship for block in forwarded) == ("other", "other")


def test_upstream_review_request_includes_review_target_and_repo_context():
    agent = CodeReviewAgent(agent_name="code-review")
    prepared = agent.prepare_review_text(
        """<review_target path="frontend/app.tsx">
```ts
console.log('debug');
```
</review_target>
<repo_context path="frontend/logger.ts">
```ts
export function debugLog(message: string) {
  return console.log(message);
}
```
</repo_context>"""
    )

    request = build_upstream_review_request(
        settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=18.0,
        ),
        input_kind=prepared.review_input.kind,
        review_target_text=prepared.review_input.raw_text,
        review_target_path=prepared.payload.review_target_path,
        context_file_count=len(prepared.payload.context_blocks),
        forwarded_context=prepared.forwarded_context,
        uses_structured_input=prepared.payload.uses_structured_input,
    )

    assert request.model == "review-upstream-v1"
    assert request.base_url == "https://example.test/v1"
    assert request.api_key == "upstream-key"
    assert request.timeout_seconds == 18.0
    assert request.messages[0]["role"] == "system"
    assert request.messages[1]["role"] == "user"
    assert "Return JSON only" in request.messages[0]["content"]
    assert "Never report a finding that exists only in repo context." in request.messages[0]["content"]
    assert "Review target path: frontend/app.tsx" in request.messages[1]["content"]
    assert (
        "Review scope: Review only the supplied review target text. Repo context may only help explain symbols, types, constraints, or call relationships that appear in the review target."
        in request.messages[1]["content"]
    )
    assert "Repo context files supplied: 1" in request.messages[1]["content"]
    assert "Repo context files forwarded: 1" in request.messages[1]["content"]
    assert "Context file 1 path: frontend/logger.ts" in request.messages[1]["content"]
    assert "Context file 1 relationship: same_dir" in request.messages[1]["content"]
    assert "Context file 1 usage priority: high" in request.messages[1]["content"]
    assert "Context file 1 shared identifiers: console, log" in request.messages[1]["content"]
    assert "Context file 1 truncated: no" in request.messages[1]["content"]
    assert "console.log('debug');" in request.messages[1]["content"]


def test_upstream_review_request_reports_forwarded_context_truncation_and_filtered_count():
    agent = CodeReviewAgent(agent_name="code-review")
    long_context = "\n".join(f"line {index}" for index in range(1, 86))
    prepared = agent.prepare_review_text(
        f"""<review_target path="frontend/app.tsx">
```ts
const total = items.length;
```
</review_target>
<repo_context path="frontend/app.tsx">
```ts
export const duplicateTarget = true;
```
</repo_context>
<repo_context path="frontend/logger.ts">
```ts
{long_context}
```
</repo_context>"""
    )

    request = build_upstream_review_request(
        settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=18.0,
        ),
        input_kind=prepared.review_input.kind,
        review_target_text=prepared.review_input.raw_text,
        review_target_path=prepared.payload.review_target_path,
        context_file_count=len(prepared.payload.context_blocks),
        forwarded_context=prepared.forwarded_context,
        uses_structured_input=prepared.payload.uses_structured_input,
    )

    assert "Repo context files supplied: 2" in request.messages[1]["content"]
    assert "Repo context files forwarded: 1" in request.messages[1]["content"]
    assert "Context file 1 path: frontend/logger.ts" in request.messages[1]["content"]
    assert "Context file 1 relationship: same_dir" in request.messages[1]["content"]
    assert "Context file 1 usage priority: high" in request.messages[1]["content"]
    assert "Context file 1 shared identifiers: <none>" in request.messages[1]["content"]
    assert "Context file 1 truncated: yes" in request.messages[1]["content"]
    assert "... [truncated]" in request.messages[1]["content"]


def test_upstream_review_request_uses_diff_scope_hint_and_medium_priority_with_single_overlap():
    agent = CodeReviewAgent(agent_name="code-review")
    prepared = agent.prepare_review_text(
        """<review_target path="frontend/app.tsx">
```diff
diff --git a/frontend/app.tsx b/frontend/app.tsx
--- a/frontend/app.tsx
+++ b/frontend/app.tsx
@@ -1,1 +1,2 @@
+debugLog(message)
```
</review_target>
<repo_context path="frontend/utils/logger.ts">
```ts
export function debugLog(input: string) {
  return input;
}
```
</repo_context>"""
    )

    request = build_upstream_review_request(
        settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=18.0,
        ),
        input_kind=prepared.review_input.kind,
        review_target_text=prepared.review_input.raw_text,
        review_target_path=prepared.payload.review_target_path,
        context_file_count=len(prepared.payload.context_blocks),
        forwarded_context=prepared.forwarded_context,
        uses_structured_input=prepared.payload.uses_structured_input,
    )

    assert (
        "Review scope: Review only the added lines in the review target diff. Repo context may only help explain those added lines."
        in request.messages[1]["content"]
    )
    assert "Context file 1 relationship: same_top_level" in request.messages[1]["content"]
    assert "Context file 1 usage priority: medium" in request.messages[1]["content"]
    assert "Context file 1 shared identifiers: debuglog" in request.messages[1]["content"]


def test_upstream_review_request_reports_low_priority_when_no_overlap_exists():
    request = build_upstream_review_request(
        settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=18.0,
        ),
        input_kind="plain_text",
        review_target_text="Please review the cache invalidation path.",
        review_target_path="frontend/app.tsx",
        context_file_count=1,
        forwarded_context=(
            upstream_review_module.UpstreamContextBlock(
                path="docs/readme.md",
                content="deployment steps and release notes",
                relationship="other",
                truncated=False,
            ),
        ),
        uses_structured_input=True,
    )

    assert (
        "Review scope: Review only the supplied review target text. Repo context may only help explain symbols, types, constraints, or call relationships that appear in the review target."
        in request.messages[1]["content"]
    )
    assert "Context file 1 usage priority: low" in request.messages[1]["content"]
    assert "Context file 1 shared identifiers: <none>" in request.messages[1]["content"]


def test_upstream_review_request_limits_shared_identifiers_to_five_sorted_values():
    request = build_upstream_review_request(
        settings=UpstreamReviewSettings(
            model="review-upstream-v1",
            base_url="https://example.test/v1",
            api_key="upstream-key",
            timeout_seconds=18.0,
        ),
        input_kind="code_snippet",
        review_target_text=(
            "alpha beta gamma delta epsilon zeta eta theta payload process result"
        ),
        review_target_path="frontend/app.tsx",
        context_file_count=1,
        forwarded_context=(
            upstream_review_module.UpstreamContextBlock(
                path="frontend/shared.ts",
                content=(
                    "theta eta zeta epsilon delta gamma beta alpha payload process result"
                ),
                relationship="same_top_level",
                truncated=False,
            ),
        ),
        uses_structured_input=True,
    )

    assert "Context file 1 usage priority: high" in request.messages[1]["content"]
    assert (
        "Context file 1 shared identifiers: alpha, beta, delta, epsilon, eta"
        in request.messages[1]["content"]
    )


def test_findings_sort_by_severity_then_file_path_then_line_number():
    review = render_review(
        """```diff
diff --git a/frontend/z-last.tsx b/frontend/z-last.tsx
--- a/frontend/z-last.tsx
+++ b/frontend/z-last.tsx
@@ -2,1 +2,2 @@
+dangerouslySetInnerHTML = html
diff --git a/backend/a-first.py b/backend/a-first.py
--- a/backend/a-first.py
+++ b/backend/a-first.py
@@ -10,1 +10,2 @@
+token = "sk-test-1234567890"
```"""
    )

    assert review.index("1. Title: Hardcoded secret") < review.index("2. Title: Unsafe HTML sink")
    assert "Rule ID: hardcoded_secret" in review
    assert "Rule ID: unsafe_html_sink" in review

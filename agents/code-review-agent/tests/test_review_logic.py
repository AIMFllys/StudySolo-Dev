import asyncio

import pytest

from src.core.agent import CodeReviewAgent


def render_review(text: str) -> str:
    agent = CodeReviewAgent(agent_name="code-review")
    return agent.review_text(text)


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
    ],
)
def test_rule_findings_are_reported(text, expected_title, expected_kind):
    review = render_review(text)

    assert "Summary" in review
    assert f"- Input type: {expected_kind}" in review
    assert expected_title in review
    assert "Limitations" in review


def test_clean_input_reports_no_findings():
    review = render_review("```ts\nconst total = items.length;\nreturn total;\n```")

    assert "Findings found: 0" in review
    assert "No deterministic findings" in review


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
    assert "Debug artifact" not in result.content


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
    assert "- Reviewed added lines: 2" in review
    assert "Hardcoded secret [high]" in review
    assert "Debug artifact [low]" in review
    assert "File: backend/service.py:21" in review
    assert "File: frontend/app.tsx:9" in review


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

    assert review.count("Debug artifact [low]") == 1
    assert "File: frontend/app.tsx:1" in review


def test_fragment_diff_falls_back_to_unknown_file_when_header_missing():
    review = render_review("```diff\n@@ -4,0 +12,1 @@\n+dangerouslySetInnerHTML: html\n```")

    assert "Unsafe HTML sink [high]" in review
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
    assert "No deterministic findings" in review

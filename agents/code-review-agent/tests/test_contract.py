import json
from types import SimpleNamespace

from fastapi.testclient import TestClient

import src.core.upstream_review as upstream_review_module
from src.config import get_settings
from src.main import create_app


def auth_headers(settings):
    return {
        "Authorization": f"Bearer {settings.api_key}",
        "X-Request-Id": "req-code-review-123",
    }


def completion_payload(settings, stream: bool = False):
    return {
        "model": settings.model_id,
        "messages": [
            {
                "role": "user",
                "content": "Review this snippet:\n```ts\nconsole.log('debug');\n```",
            }
        ],
        "stream": stream,
    }


def structured_completion_payload(settings, *, content: str, stream: bool = False):
    return {
        "model": settings.model_id,
        "messages": [{"role": "user", "content": content}],
        "stream": stream,
    }


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


def collect_stream_content(response) -> str:
    pieces: list[str] = []
    for raw_line in response.text.splitlines():
        if not raw_line.startswith("data: "):
            continue
        payload = raw_line[6:]
        if payload == "[DONE]":
            continue
        data = json.loads(payload)
        delta = data["choices"][0]["delta"]
        if "content" in delta:
            pieces.append(delta["content"])
    return "".join(pieces)


def test_health_endpoint(client, settings):
    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["agent"] == settings.agent_name
    assert data["version"] == settings.version
    assert data["models"] == settings.models


def test_health_ready_endpoint(client):
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"ready": True}


def test_models_endpoint(client, settings):
    response = client.get("/v1/models")

    assert response.status_code == 200
    data = response.json()
    assert data["object"] == "list"
    assert data["data"][0]["id"] == settings.model_id


def test_rejects_invalid_api_key(client, settings):
    response = client.post(
        "/v1/chat/completions",
        json=completion_payload(settings),
        headers={"Authorization": "Bearer invalid-key"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_api_key"


def test_rejects_missing_model(client, settings):
    response = client.post(
        "/v1/chat/completions",
        json={"messages": completion_payload(settings)["messages"]},
        headers=auth_headers(settings),
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "missing_model"


def test_rejects_empty_messages(client, settings):
    response = client.post(
        "/v1/chat/completions",
        json={"model": settings.model_id, "messages": []},
        headers=auth_headers(settings),
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "empty_messages"


def test_non_stream_response_format(client, settings):
    response = client.post(
        "/v1/chat/completions",
        json=completion_payload(settings),
        headers=auth_headers(settings),
    )

    assert response.status_code == 200
    assert response.headers["X-Request-Id"] == "req-code-review-123"
    data = response.json()
    assert data["object"] == "chat.completion"
    assert data["model"] == settings.model_id
    assert data["choices"][0]["message"]["role"] == "assistant"
    content = data["choices"][0]["message"]["content"]
    assert "Summary" in content
    assert "Findings" in content
    assert "Limitations" in content
    assert "- Context files supplied: 0" in content
    assert "1. Title: Debug artifact" in content
    assert "Rule ID: debug_artifact" in content
    assert "Severity: low" in content
    assert "File: <none>" in content
    assert data["usage"]["total_tokens"] == (
        data["usage"]["prompt_tokens"] + data["usage"]["completion_tokens"]
    )


def test_stream_response_sse_format(client, settings):
    response = client.post(
        "/v1/chat/completions",
        json=completion_payload(settings, stream=True),
        headers=auth_headers(settings),
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["X-Request-Id"] == "req-code-review-123"

    lines = [line for line in response.text.splitlines() if line]
    assert lines[0].startswith("data: ")
    assert any("chat.completion.chunk" in line for line in lines[:-1])
    assert lines[-1] == "data: [DONE]"


def test_non_stream_response_format_with_upstream_reserved_backend(monkeypatch):
    monkeypatch.setenv("AGENT_API_KEY", "test-agent-key")
    monkeypatch.setenv("AGENT_REVIEW_BACKEND", "upstream_reserved")
    monkeypatch.setenv("AGENT_UPSTREAM_MODEL", "review-upstream-v1")
    monkeypatch.setenv("AGENT_UPSTREAM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("AGENT_UPSTREAM_API_KEY", "upstream-key")
    get_settings.cache_clear()

    settings = get_settings()
    with TestClient(create_app()) as client:
        response = client.post(
            "/v1/chat/completions",
            json=completion_payload(settings),
            headers=auth_headers(settings),
        )

    get_settings.cache_clear()

    assert response.status_code == 200
    data = response.json()
    assert data["object"] == "chat.completion"
    assert data["model"] == settings.model_id
    content = data["choices"][0]["message"]["content"]
    assert "Summary" in content
    assert "1. Title: Debug artifact" in content
    assert "Rule ID: debug_artifact" in content


def test_stream_response_sse_format_with_upstream_reserved_backend(monkeypatch):
    monkeypatch.setenv("AGENT_API_KEY", "test-agent-key")
    monkeypatch.setenv("AGENT_REVIEW_BACKEND", "upstream_reserved")
    monkeypatch.setenv("AGENT_UPSTREAM_MODEL", "review-upstream-v1")
    get_settings.cache_clear()

    settings = get_settings()
    with TestClient(create_app()) as client:
        response = client.post(
            "/v1/chat/completions",
            json=completion_payload(settings, stream=True),
            headers=auth_headers(settings),
        )

    get_settings.cache_clear()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    lines = [line for line in response.text.splitlines() if line]
    assert lines[0].startswith("data: ")
    assert lines[-1] == "data: [DONE]"


def test_non_stream_response_format_with_upstream_live_backend(monkeypatch):
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
                        "line_number": 1,
                        "evidence": "token = 'sk-test-1234567890'",
                        "fix": "Delete the statement.",
                    }
                ]
            }
        ),
    )
    monkeypatch.setenv("AGENT_API_KEY", "test-agent-key")
    monkeypatch.setenv("AGENT_REVIEW_BACKEND", "upstream_openai_compatible")
    monkeypatch.setenv("AGENT_UPSTREAM_MODEL", "review-upstream-v1")
    monkeypatch.setenv("AGENT_UPSTREAM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("AGENT_UPSTREAM_API_KEY", "upstream-key")
    get_settings.cache_clear()

    settings = get_settings()
    with TestClient(create_app()) as client:
        response = client.post(
            "/v1/chat/completions",
            json=structured_completion_payload(
                settings,
                content="""<review_target path="frontend/app.tsx">
```ts
const token = 'sk-test-1234567890';
```
</review_target>""",
            ),
            headers=auth_headers(settings),
        )

    get_settings.cache_clear()

    assert response.status_code == 200
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    assert data["object"] == "chat.completion"
    assert data["model"] == settings.model_id
    assert "1. Title: Hardcoded secret" in content
    assert "Rule ID: hardcoded_secret" in content
    assert "Severity: high" in content
    assert "File: frontend/app.tsx:1" in content
    assert (
        "Fix: Move the credential into environment variables or secret storage and load it at runtime."
        in content
    )
    assert "Temporary secret" not in content
    assert "Delete the statement." not in content
    assert (
        "external model reasoning is limited to the review target and supplied repo context"
        in content
    )
    assert len(state["instances"]) == 1
    assert state["instances"][0]["calls"][0]["model"] == "review-upstream-v1"
    assert state["instances"][0]["calls"][0]["stream"] is False


def test_non_stream_response_format_with_upstream_live_backend_unanchored_evidence_falls_back(
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
                        "line_number": 1,
                        "evidence": "console.log('debug')",
                        "fix": "Remove it.",
                    }
                ]
            }
        ),
    )
    monkeypatch.setenv("AGENT_API_KEY", "test-agent-key")
    monkeypatch.setenv("AGENT_REVIEW_BACKEND", "upstream_openai_compatible")
    monkeypatch.setenv("AGENT_UPSTREAM_MODEL", "review-upstream-v1")
    monkeypatch.setenv("AGENT_UPSTREAM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("AGENT_UPSTREAM_API_KEY", "upstream-key")
    get_settings.cache_clear()

    settings = get_settings()
    with TestClient(create_app()) as client:
        response = client.post(
            "/v1/chat/completions",
            json=structured_completion_payload(
                settings,
                content="""<review_target path="frontend/app.tsx">
```ts
const total = items.length;
return total;
```
</review_target>""",
            ),
            headers=auth_headers(settings),
        )

    get_settings.cache_clear()

    assert response.status_code == 200
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    assert "Findings found: 0" in content
    assert "Title: Hardcoded secret" not in content
    assert "external model reasoning is limited" not in content


def test_non_stream_live_backend_filters_and_prioritizes_repo_context_before_upstream(
    monkeypatch,
):
    state = install_fake_upstream(
        monkeypatch,
        content=json.dumps({"findings": []}),
    )
    monkeypatch.setenv("AGENT_API_KEY", "test-agent-key")
    monkeypatch.setenv("AGENT_REVIEW_BACKEND", "upstream_openai_compatible")
    monkeypatch.setenv("AGENT_UPSTREAM_MODEL", "review-upstream-v1")
    monkeypatch.setenv("AGENT_UPSTREAM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("AGENT_UPSTREAM_API_KEY", "upstream-key")
    get_settings.cache_clear()

    settings = get_settings()
    with TestClient(create_app()) as client:
        response = client.post(
            "/v1/chat/completions",
            json=structured_completion_payload(
                settings,
                content="""<review_target path="frontend/components/app.tsx">
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
</repo_context>""",
            ),
            headers=auth_headers(settings),
        )

    get_settings.cache_clear()

    assert response.status_code == 200
    data = response.json()
    assert data["object"] == "chat.completion"
    assert data["choices"][0]["message"]["role"] == "assistant"
    upstream_prompt = state["instances"][0]["calls"][0]["messages"][1]["content"]
    assert "Repo context files supplied: 5" in upstream_prompt
    assert "Repo context files forwarded: 4" in upstream_prompt
    assert (
        "Review scope: Review only the supplied review target text. Repo context may only help explain symbols, types, constraints, or call relationships that appear in the review target."
        in upstream_prompt
    )
    assert "Context file 1 path: frontend/components/button.tsx" in upstream_prompt
    assert "Context file 1 usage priority: high" in upstream_prompt
    assert "Context file 1 shared identifiers: <none>" in upstream_prompt
    assert "Context file 2 path: frontend/utils/math.ts" in upstream_prompt
    assert "Context file 3 path: backend/render.tsx" in upstream_prompt
    assert "Context file 4 path: docs/readme.md" in upstream_prompt
    assert "scripts/task.py" not in upstream_prompt


def test_stream_response_sse_format_with_upstream_live_backend(monkeypatch):
    payload = json.dumps(
        {
                "findings": [
                    {
                        "title": "Temporary secret",
                        "rule_id": "hardcoded_secret",
                        "severity": "low",
                        "file_path": "frontend/app.tsx",
                        "line_number": 1,
                        "evidence": "token = 'sk-test-1234567890'",
                        "fix": "Delete the statement.",
                    }
                ]
            }
    )
    state = install_fake_upstream(
        monkeypatch,
        content=payload,
        stream_chunks=[payload[:32], payload[32:74], payload[74:]],
    )
    monkeypatch.setenv("AGENT_API_KEY", "test-agent-key")
    monkeypatch.setenv("AGENT_REVIEW_BACKEND", "upstream_openai_compatible")
    monkeypatch.setenv("AGENT_UPSTREAM_MODEL", "review-upstream-v1")
    monkeypatch.setenv("AGENT_UPSTREAM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("AGENT_UPSTREAM_API_KEY", "upstream-key")
    get_settings.cache_clear()

    settings = get_settings()
    with TestClient(create_app()) as client:
        response = client.post(
            "/v1/chat/completions",
            json=structured_completion_payload(
                settings,
                content="""<review_target path="frontend/app.tsx">
```ts
const token = 'sk-test-1234567890';
```
</review_target>""",
                stream=True,
            ),
            headers=auth_headers(settings),
        )

    get_settings.cache_clear()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    lines = [line for line in response.text.splitlines() if line]
    assert lines[0].startswith("data: ")
    assert lines[-1] == "data: [DONE]"
    stream_content = collect_stream_content(response)
    assert "Title: Hardcoded secret" in stream_content
    assert "Rule ID: hardcoded_secret" in stream_content
    assert "Severity: high" in stream_content
    assert (
        "Fix: Move the credential into environment variables or secret storage and load it at runtime."
        in stream_content
    )
    assert "Temporary secret" not in stream_content
    assert "Delete the statement." not in stream_content
    assert len(state["instances"]) == 1
    assert state["instances"][0]["calls"][0]["stream"] is True


def test_stream_live_backend_truncates_repo_context_before_streaming(monkeypatch):
    payload = json.dumps({"findings": []})
    state = install_fake_upstream(
        monkeypatch,
        content=payload,
        stream_chunks=[payload[:16], payload[16:]],
    )
    monkeypatch.setenv("AGENT_API_KEY", "test-agent-key")
    monkeypatch.setenv("AGENT_REVIEW_BACKEND", "upstream_openai_compatible")
    monkeypatch.setenv("AGENT_UPSTREAM_MODEL", "review-upstream-v1")
    monkeypatch.setenv("AGENT_UPSTREAM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("AGENT_UPSTREAM_API_KEY", "upstream-key")
    get_settings.cache_clear()

    long_context = "\n".join(f"line {index}" for index in range(1, 86))
    settings = get_settings()
    with TestClient(create_app()) as client:
        response = client.post(
            "/v1/chat/completions",
            json=structured_completion_payload(
                settings,
                content=f"""<review_target path="frontend/app.tsx">
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
</repo_context>""",
                stream=True,
            ),
            headers=auth_headers(settings),
        )

    get_settings.cache_clear()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    lines = [line for line in response.text.splitlines() if line]
    assert lines[0].startswith("data: ")
    assert lines[-1] == "data: [DONE]"
    upstream_prompt = state["instances"][0]["calls"][0]["messages"][1]["content"]
    assert (
        "Review scope: Review only the supplied review target text. Repo context may only help explain symbols, types, constraints, or call relationships that appear in the review target."
        in upstream_prompt
    )
    assert "Repo context files supplied: 2" in upstream_prompt
    assert "Repo context files forwarded: 1" in upstream_prompt
    assert "Context file 1 usage priority: high" in upstream_prompt
    assert "Context file 1 shared identifiers: <none>" in upstream_prompt
    assert "Context file 1 truncated: yes" in upstream_prompt
    assert "... [truncated]" in upstream_prompt
    assert "duplicateTarget" not in upstream_prompt


def test_stream_response_sse_format_with_upstream_live_backend_context_findings_fall_back(
    monkeypatch,
):
    payload = json.dumps(
        {
            "findings": [
                {
                    "title": "Hardcoded secret",
                    "rule_id": "hardcoded_secret",
                    "severity": "high",
                    "file_path": "frontend/helper.ts",
                    "line_number": 1,
                    "evidence": "token = 'sk-test-1234567890'",
                    "fix": "Move the credential into environment variables.",
                }
            ]
        }
    )
    state = install_fake_upstream(
        monkeypatch,
        content=payload,
        stream_chunks=[payload[:32], payload[32:74], payload[74:]],
    )
    monkeypatch.setenv("AGENT_API_KEY", "test-agent-key")
    monkeypatch.setenv("AGENT_REVIEW_BACKEND", "upstream_openai_compatible")
    monkeypatch.setenv("AGENT_UPSTREAM_MODEL", "review-upstream-v1")
    monkeypatch.setenv("AGENT_UPSTREAM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("AGENT_UPSTREAM_API_KEY", "upstream-key")
    get_settings.cache_clear()

    settings = get_settings()
    with TestClient(create_app()) as client:
        response = client.post(
            "/v1/chat/completions",
            json=structured_completion_payload(
                settings,
                content="""<review_target path="frontend/app.tsx">
```ts
console.log('debug');
```
</review_target>
<repo_context path="frontend/helper.ts">
```ts
export const token = "sk-test-1234567890";
```
</repo_context>""",
                stream=True,
            ),
            headers=auth_headers(settings),
        )

    get_settings.cache_clear()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    lines = [line for line in response.text.splitlines() if line]
    assert lines[0].startswith("data: ")
    assert lines[-1] == "data: [DONE]"
    stream_content = collect_stream_content(response)
    assert "Title: Debug artifact" in stream_content
    assert "Title: Hardcoded secret" not in stream_content
    assert "external model reasoning is limited" not in stream_content
    assert len(state["instances"]) == 1
    assert state["instances"][0]["calls"][0]["stream"] is True

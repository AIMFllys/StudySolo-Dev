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


def test_health_endpoint(client, settings):
    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["agent"] == settings.agent_name
    assert data["version"] == settings.version
    assert data["models"] == settings.models


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

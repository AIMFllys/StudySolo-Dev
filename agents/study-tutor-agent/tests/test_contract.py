import asyncio
import json
from types import SimpleNamespace

import httpx
import pytest

from src.endpoints.completions import create_chat_completion
from src.endpoints.health import health, health_ready
from src.main import create_app
from src.endpoints.models import list_models
from src.middleware.auth import verify_api_key
from src.rate_limit import InMemoryRateLimiter
from src.schemas.request import ChatCompletionRequest, ChatMessage
from src.schemas.response import AgentHTTPError


def completion_body(settings, stream: bool = False) -> ChatCompletionRequest:
    return ChatCompletionRequest(
        model=settings.model_id,
        messages=[ChatMessage(role="user", content="请帮我复习牛顿第二定律")],
        stream=stream,
    )


def decode_json_response(response) -> dict:
    return json.loads(response.body.decode())


def make_request(
    settings,
    *,
    request_id: str = "req-study-tutor-123",
    user_id: str | None = None,
    client_host: str = "127.0.0.1",
    max_requests: int | None = None,
    window_seconds: int = 60,
):
    app = create_app()
    if max_requests is not None:
        app.state.rate_limiter = InMemoryRateLimiter(
            max_requests=max_requests,
            window_seconds=window_seconds,
        )
    state = SimpleNamespace(request_id=request_id, user_id=user_id)
    headers = {"X-Request-Id": request_id}
    if user_id:
        headers["X-User-Id"] = user_id
    return SimpleNamespace(
        app=app,
        state=state,
        headers=headers,
        client=SimpleNamespace(host=client_host),
    )


def test_health_endpoint(settings):
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(started_at=0.0)))

    response = asyncio.run(health(request))

    assert response.status == "ok"
    assert response.agent == settings.agent_name
    assert response.version == settings.version
    assert response.models == settings.models


def test_health_ready_endpoint():
    response = asyncio.run(health_ready())

    assert response.model_dump() == {"ready": True}


def test_models_endpoint(settings):
    response = asyncio.run(list_models())

    assert response.object == "list"
    assert response.data[0].id == settings.model_id


def test_rejects_invalid_api_key():
    with pytest.raises(AgentHTTPError) as exc_info:
        verify_api_key("Bearer invalid-key")

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "invalid_api_key"


def test_rejects_missing_model():
    body = ChatCompletionRequest(
        model="",
        messages=[ChatMessage(role="user", content="请帮我复习牛顿第二定律")],
    )

    with pytest.raises(AgentHTTPError) as exc_info:
        asyncio.run(create_chat_completion(body, request=make_request(settings=None), _=None))

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "missing_model"


def test_rejects_empty_messages(settings):
    body = ChatCompletionRequest(model=settings.model_id, messages=[])

    with pytest.raises(AgentHTTPError) as exc_info:
        asyncio.run(create_chat_completion(body, request=make_request(settings), _=None))

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "empty_messages"


def test_non_stream_response_format(settings):
    response = asyncio.run(
        create_chat_completion(
            completion_body(settings),
            request=make_request(settings),
            _=None,
        )
    )

    data = decode_json_response(response)
    assert data["object"] == "chat.completion"
    assert data["model"] == settings.model_id
    assert data["choices"][0]["message"]["role"] == "assistant"
    content = data["choices"][0]["message"]["content"]
    assert "Topic Summary" in content
    assert "Key Concepts" in content
    assert "Study Suggestions" in content
    assert "Practice" in content
    assert "- Topic: 牛顿第二定律" in content
    assert data["usage"]["total_tokens"] == (
        data["usage"]["prompt_tokens"] + data["usage"]["completion_tokens"]
    )


def test_stream_response_sse_format(settings):
    response = asyncio.run(
        create_chat_completion(
            completion_body(settings, stream=True),
            request=make_request(settings),
            _=None,
        )
    )

    async def collect_lines():
        lines = []
        async for chunk in response.body_iterator:
            text = chunk.decode() if isinstance(chunk, bytes) else chunk
            lines.extend(line for line in text.splitlines() if line)
        return lines

    lines = asyncio.run(collect_lines())
    assert response.headers["content-type"].startswith("text/event-stream")
    assert lines[0].startswith("data: ")
    assert any("chat.completion.chunk" in line for line in lines[:-1])
    assert lines[-1] == "data: [DONE]"


def test_request_id_propagation(settings):
    async def run_request():
        app = create_app()
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get(
                "/health",
                headers={
                    "X-Request-Id": "req-study-tutor-123",
                },
            )
            return response

    response = asyncio.run(run_request())
    assert response.status_code == 200
    assert response.headers["X-Request-Id"] == "req-study-tutor-123"


def test_cors_preflight_allows_configured_origin():
    async def run_request():
        app = create_app()
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.options(
                "/health",
                headers={
                    "Origin": "http://localhost:3000",
                    "Access-Control-Request-Method": "GET",
                },
            )
            return response

    response = asyncio.run(run_request())
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_rate_limit_exceeded_returns_429(settings):
    request = make_request(settings, user_id="user-123", max_requests=1)

    first_response = asyncio.run(
        create_chat_completion(
            completion_body(settings),
            request=request,
            _=None,
        )
    )
    assert first_response.status_code == 200

    with pytest.raises(AgentHTTPError) as exc_info:
        asyncio.run(
            create_chat_completion(
                completion_body(settings),
                request=request,
                _=None,
            )
        )

    assert exc_info.value.status_code == 429
    assert exc_info.value.code == "rate_limit_exceeded"

import json
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from src.core.ai_understanding import AIUnderstandingSettings
from src.config import get_settings
from src.core.agent import VisualSiteAgent
from src.core.upstream_planning import UpstreamPlanningSettings
from src.middleware.auth import verify_api_key
from src.schemas.request import ChatCompletionRequest, ChatMessage
from src.schemas.response import (
    AgentHTTPError,
    ChatCompletionChunk,
    ChatCompletionChunkChoice,
    ChatCompletionChunkDelta,
    ChatCompletionChoice,
    ChatCompletionResponse,
    UsageInfo,
    current_timestamp,
    new_chat_completion_id,
)

router = APIRouter(tags=["chat"])
logger = logging.getLogger(__name__)


def _validate_request(body: ChatCompletionRequest) -> None:
    settings = get_settings()
    if not body.model or not body.model.strip():
        raise AgentHTTPError(
            status_code=400,
            message="Missing required field: model",
            error_type="invalid_request_error",
            code="missing_model",
        )
    if not body.messages:
        raise AgentHTTPError(
            status_code=400,
            message="Messages must not be empty",
            error_type="invalid_request_error",
            code="empty_messages",
        )
    if body.model != settings.model_id:
        raise AgentHTTPError(
            status_code=404,
            message=f"Model not found: {body.model}",
            error_type="not_found_error",
            code="model_not_found",
        )


def _json_payload(model) -> str:
    return json.dumps(model.model_dump(exclude_none=True), ensure_ascii=False)


@router.post("/v1/chat/completions")
async def create_chat_completion(
    body: ChatCompletionRequest,
    request: Request,
    _: None = Depends(verify_api_key),
):
    _validate_request(body)
    settings = get_settings()
    concurrency_limiter = getattr(request.app.state, "concurrency_limiter", None)
    acquired_slot = False
    if settings.overload_protection_enabled and concurrency_limiter is not None:
        acquired_slot = concurrency_limiter.try_acquire()
        if not acquired_slot:
            logger.warning(
                "Agent overloaded: max_in_flight=%s",
                getattr(concurrency_limiter, "max_in_flight", None),
                extra={
                    "request_id": getattr(request.state, "request_id", None),
                    "user_id": getattr(request.state, "user_id", None),
                    "agent": settings.agent_name,
                },
            )
            raise AgentHTTPError(
                status_code=503,
                message="Agent is temporarily overloaded",
                error_type="server_error",
                code="agent_overloaded",
            )
    if settings.rate_limit_enabled:
        limiter = getattr(request.app.state, "rate_limiter", None)
        user_key = getattr(request.state, "user_id", None) or request.headers.get("X-User-Id")
        client_host = getattr(getattr(request, "client", None), "host", None)
        rate_limit_key = user_key or client_host or "anonymous"
        if limiter is not None and not limiter.allow(rate_limit_key):
            logger.warning(
                "Rate limit exceeded: key=%s",
                rate_limit_key,
                extra={
                    "request_id": getattr(request.state, "request_id", None),
                    "user_id": getattr(request.state, "user_id", None),
                    "agent": settings.agent_name,
                },
            )
            raise AgentHTTPError(
                status_code=429,
                message="Rate limit exceeded",
                error_type="rate_limit_error",
                code="rate_limit_exceeded",
            )
    agent = VisualSiteAgent(
        agent_name=settings.agent_name,
        ai_understanding_settings=AIUnderstandingSettings(
            backend=settings.understanding_backend,
            model=settings.understanding_model,
            base_url=settings.understanding_base_url,
            api_key=settings.understanding_api_key,
            timeout_seconds=settings.understanding_timeout_seconds,
        ),
        planning_settings=UpstreamPlanningSettings(
            backend=settings.planner_backend,
            model=settings.planner_model,
            base_url=settings.planner_base_url,
            api_key=settings.planner_api_key,
            timeout_seconds=settings.planner_timeout_seconds,
        ),
    )
    try:
        messages = [message.model_dump() for message in body.messages]
        result = await agent.complete(messages)

        if not body.stream:
            response = ChatCompletionResponse(
                model=settings.model_id,
                choices=[
                    ChatCompletionChoice(
                        message=ChatMessage(role="assistant", content=result.content),
                    )
                ],
                usage=UsageInfo(
                    prompt_tokens=result.prompt_tokens,
                    completion_tokens=result.completion_tokens,
                    total_tokens=result.total_tokens,
                ),
            )
            return JSONResponse(content=response.model_dump())

        completion_id = new_chat_completion_id()
        created = current_timestamp()
        chunks = agent.stream_chunks(result.content)

        async def event_stream():
            role_chunk = ChatCompletionChunk(
                id=completion_id,
                created=created,
                model=settings.model_id,
                choices=[
                    ChatCompletionChunkChoice(
                        delta=ChatCompletionChunkDelta(role="assistant"),
                    )
                ],
            )
            yield f"data: {_json_payload(role_chunk)}\n\n"

            for piece in chunks:
                content_chunk = ChatCompletionChunk(
                    id=completion_id,
                    created=created,
                    model=settings.model_id,
                    choices=[
                        ChatCompletionChunkChoice(
                            delta=ChatCompletionChunkDelta(content=piece),
                        )
                    ],
                )
                yield f"data: {_json_payload(content_chunk)}\n\n"

            stop_chunk = ChatCompletionChunk(
                id=completion_id,
                created=created,
                model=settings.model_id,
                choices=[
                    ChatCompletionChunkChoice(
                        delta=ChatCompletionChunkDelta(),
                        finish_reason="stop",
                    )
                ],
            )
            yield f"data: {_json_payload(stop_chunk)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )
    finally:
        if acquired_slot and concurrency_limiter is not None:
            concurrency_limiter.release()

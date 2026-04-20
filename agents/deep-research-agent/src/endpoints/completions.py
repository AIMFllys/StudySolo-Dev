import json

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, StreamingResponse

from src.config import get_settings
from src.core.agent import DeepResearchAgent
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
    _: None = Depends(verify_api_key),
):
    _validate_request(body)
    settings = get_settings()
    agent = DeepResearchAgent(agent_name=settings.agent_name)
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

import time
import uuid

from pydantic import BaseModel, Field

from src.schemas.request import ChatMessage


def new_chat_completion_id() -> str:
    return f"chatcmpl-{uuid.uuid4().hex[:12]}"


def current_timestamp() -> int:
    return int(time.time())


class AgentError(BaseModel):
    message: str
    type: str
    code: str


class ErrorResponse(BaseModel):
    error: AgentError


class AgentHTTPError(Exception):
    def __init__(self, status_code: int, message: str, error_type: str, code: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.error_type = error_type
        self.code = code


class UsageInfo(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatCompletionChoice(BaseModel):
    index: int = 0
    message: ChatMessage
    finish_reason: str = "stop"


class ChatCompletionResponse(BaseModel):
    id: str = Field(default_factory=new_chat_completion_id)
    object: str = "chat.completion"
    created: int = Field(default_factory=current_timestamp)
    model: str
    choices: list[ChatCompletionChoice]
    usage: UsageInfo


class ChatCompletionChunkDelta(BaseModel):
    role: str | None = None
    content: str | None = None


class ChatCompletionChunkChoice(BaseModel):
    index: int = 0
    delta: ChatCompletionChunkDelta
    finish_reason: str | None = None


class ChatCompletionChunk(BaseModel):
    id: str
    object: str = "chat.completion.chunk"
    created: int
    model: str
    choices: list[ChatCompletionChunkChoice]


class HealthResponse(BaseModel):
    status: str = "ok"
    agent: str
    version: str
    uptime_seconds: int
    models: list[str]


class ReadyResponse(BaseModel):
    ready: bool = True


class ModelCard(BaseModel):
    id: str
    object: str = "model"
    created: int = Field(default_factory=current_timestamp)
    owned_by: str = "studysolo-agent"


class ModelListResponse(BaseModel):
    object: str = "list"
    data: list[ModelCard]

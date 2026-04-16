"""Agent Gateway API routes.

Endpoints:
  GET  /agents              — 列出所有可用 Agent
  POST /agents/{name}/chat  — 调用指定 Agent（支持 stream / non-stream）
  GET  /agents/{name}/health — 查询指定 Agent 健康状态
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse

from app.core.deps import get_current_user
from app.services.agent_gateway import AgentCallResult, AgentGateway, AgentModelsResult

logger = logging.getLogger(__name__)

router = APIRouter(tags=["agents"])


# ── Request / Response models ───────────────────────────────────────

class AgentChatMessage(BaseModel):
    role: str
    content: str


class AgentChatRequest(BaseModel):
    messages: list[AgentChatMessage] = Field(..., min_length=1)
    model: str | None = None
    stream: bool = False


class AgentInfo(BaseModel):
    name: str
    description: str
    models: list[str]
    owner: str
    healthy: bool
    capabilities: list[str] = Field(default_factory=list)
    skills_ready: bool = False
    mcp_ready: bool = False


class AgentModelsResponse(BaseModel):
    agent: str
    healthy: bool
    source: Literal["runtime", "registry-fallback"]
    models: list[str]


class AgentHealthResponse(BaseModel):
    name: str
    healthy: bool


# ── Gateway singleton ───────────────────────────────────────────────

_gateway: AgentGateway | None = None


def get_gateway() -> AgentGateway:
    """Return the singleton AgentGateway instance (lazy init)."""
    global _gateway
    if _gateway is None:
        from pathlib import Path
        from app.services.agent_gateway import AgentRegistry

        config_path = Path(__file__).resolve().parent.parent.parent / "config" / "agents.yaml"
        registry = AgentRegistry(config_path)
        _gateway = AgentGateway(registry)
    return _gateway


# ── Error helper ────────────────────────────────────────────────────

def _error_response(result: AgentCallResult) -> JSONResponse:
    """Convert a failed AgentCallResult to a JSON error response."""
    error_type_map = {
        404: "not_found_error",
        503: "service_unavailable",
        504: "gateway_timeout",
    }
    return JSONResponse(
        status_code=result.status_code,
        content={
            "error": {
                "message": result.error or "Unknown error",
                "type": error_type_map.get(result.status_code, "upstream_error"),
            }
        },
    )


# ── Endpoints ───────────────────────────────────────────────────────

@router.get("", response_model=list[AgentInfo])
async def list_agents(
    _user: dict = Depends(get_current_user),
    gateway: AgentGateway = Depends(get_gateway),
) -> list[AgentInfo]:
    """返回所有已启用 Agent，并附带健康状态."""
    agents = await gateway.list_enabled_with_health()
    return [
        AgentInfo(
            name=agent.name,
            description=agent.description,
            models=agent.models,
            owner=agent.owner,
            healthy=healthy,
            capabilities=agent.capabilities,
            skills_ready=agent.skills_ready,
            mcp_ready=agent.mcp_ready,
        )
        for agent, healthy in agents
    ]


@router.get("/{name}/models", response_model=AgentModelsResponse)
async def get_agent_models(
    name: str,
    user: dict = Depends(get_current_user),
    gateway: AgentGateway = Depends(get_gateway),
) -> AgentModelsResponse:
    """返回指定 Agent 的可选模型列表."""
    user_id = user.get("id")
    result = await gateway.get_models(name, user_id=user_id)
    if isinstance(result, AgentCallResult):
        raise HTTPException(status_code=result.status_code, detail=result.error or "Agent lookup failed")
    return AgentModelsResponse(**result.model_dump())


@router.post("/{name}/chat")
async def chat_with_agent(
    name: str,
    body: AgentChatRequest,
    user: dict = Depends(get_current_user),
    gateway: AgentGateway = Depends(get_gateway),
) -> Any:
    """调用指定 Agent（代理模式，支持 stream / non-stream）."""
    user_id = user.get("id")
    messages = [m.model_dump() for m in body.messages]

    if body.stream:
        result = await gateway.call_stream(
            name,
            messages,
            model=body.model,
            user_id=user_id,
        )

        # call_stream returns AgentCallResult on failure
        if isinstance(result, AgentCallResult):
            return _error_response(result)

        stream_iter, request_id = result
        return StreamingResponse(
            stream_iter,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "X-Request-Id": request_id,
            },
        )

    # Non-stream
    result = await gateway.call(
        name,
        messages,
        model=body.model,
        stream=False,
        user_id=user_id,
    )

    if result.status_code >= 400:
        return _error_response(result)

    response = JSONResponse(content=result.body, status_code=result.status_code)
    response.headers["X-Request-Id"] = result.request_id
    return response


@router.get("/{name}/health", response_model=AgentHealthResponse)
async def agent_health(
    name: str,
    _user: dict = Depends(get_current_user),
    gateway: AgentGateway = Depends(get_gateway),
) -> AgentHealthResponse:
    """查询指定 Agent 的健康状态."""
    agent = gateway.registry.get(name)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent not found: {name}")

    healthy = await gateway.health.is_healthy(agent)
    return AgentHealthResponse(name=name, healthy=healthy)

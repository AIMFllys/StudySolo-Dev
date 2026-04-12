"""AgentCaller — HTTP 调用子后端 Agent（non-stream + SSE 透传）."""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import AsyncIterator

import httpx

from .models import AgentCallResult

logger = logging.getLogger(__name__)


class AgentCaller:
    """执行对子后端 Agent 的 HTTP 调用."""

    async def call(
        self,
        url: str,
        *,
        messages: list[dict],
        model: str,
        timeout: int,
        headers: dict[str, str],
    ) -> AgentCallResult:
        """Non-stream 调用，返回完整 JSON 响应."""
        request_id = headers.get("X-Request-Id", uuid.uuid4().hex)
        start = time.monotonic()

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(
                    f"{url}/v1/chat/completions",
                    json={"messages": messages, "model": model, "stream": False},
                    headers=headers,
                )

            duration_ms = int((time.monotonic() - start) * 1000)

            if resp.status_code >= 400:
                return AgentCallResult(
                    status_code=resp.status_code,
                    error=resp.text[:500],
                    duration_ms=duration_ms,
                    request_id=request_id,
                )

            return AgentCallResult(
                status_code=resp.status_code,
                body=resp.json(),
                duration_ms=duration_ms,
                request_id=request_id,
            )
        except httpx.TimeoutException:
            duration_ms = int((time.monotonic() - start) * 1000)
            return AgentCallResult(
                status_code=504,
                error="Agent timeout",
                duration_ms=duration_ms,
                request_id=request_id,
            )
        except httpx.ConnectError as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            return AgentCallResult(
                status_code=503,
                error=f"Agent connection failed: {exc}",
                duration_ms=duration_ms,
                request_id=request_id,
            )
        except Exception as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            logger.exception("Unexpected error calling agent at %s", url)
            return AgentCallResult(
                status_code=502,
                error=str(exc)[:500],
                duration_ms=duration_ms,
                request_id=request_id,
            )

    async def call_stream(
        self,
        url: str,
        *,
        messages: list[dict],
        model: str,
        timeout: int,
        headers: dict[str, str],
    ) -> AsyncIterator[bytes]:
        """SSE 流式调用，逐 chunk yield（不 buffer）."""
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    f"{url}/v1/chat/completions",
                    json={"messages": messages, "model": model, "stream": True},
                    headers=headers,
                ) as resp:
                    if resp.status_code >= 400:
                        body = await resp.aread()
                        # Yield a single SSE error event so the frontend can parse it
                        yield (
                            f"data: {{\"error\": {{\"message\": \"Agent returned {resp.status_code}\","
                            f" \"type\": \"upstream_error\"}}}}\n\n"
                        ).encode()
                        return

                    async for chunk in resp.aiter_bytes():
                        yield chunk
        except httpx.TimeoutException:
            yield b'data: {"error": {"message": "Agent timeout", "type": "gateway_timeout"}}\n\n'
        except httpx.ConnectError:
            yield b'data: {"error": {"message": "Agent unavailable", "type": "service_unavailable"}}\n\n'
        except Exception as exc:
            logger.exception("Stream error from agent at %s", url)
            yield f'data: {{"error": {{"message": "{str(exc)[:200]}", "type": "internal_error"}}}}\n\n'.encode()

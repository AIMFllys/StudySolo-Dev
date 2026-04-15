import logging
import time
import uuid

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.config import get_settings
from src.logging_utils import configure_json_logging, request_id_var, user_id_var
from src.rate_limit import InMemoryConcurrencyLimiter, InMemoryRateLimiter
from src.router import router
from src.schemas.response import AgentError, AgentHTTPError, ErrorResponse

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    configure_json_logging()
    settings = get_settings()
    app = FastAPI(
        title=f"{settings.agent_name} agent",
        version=settings.version,
    )
    app.state.started_at = time.monotonic()
    app.state.rate_limiter = InMemoryRateLimiter(
        max_requests=settings.rate_limit_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )
    app.state.concurrency_limiter = InMemoryConcurrencyLimiter(
        max_in_flight=settings.overload_max_in_flight_requests,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)

    @app.middleware("http")
    async def propagate_request_id(request: Request, call_next):
        request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        user_id = request.headers.get("X-User-Id")
        request.state.request_id = request_id
        request.state.user_id = user_id
        request.state.request_started_at = time.monotonic()

        request_token = request_id_var.set(request_id)
        user_token = user_id_var.set(user_id)
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(request_token)
            user_id_var.reset(user_token)

        duration_ms = int((time.monotonic() - request.state.request_started_at) * 1000)
        logger.info(
            "Request processed",
            extra={
                "request_id": request_id,
                "user_id": user_id,
                "agent": settings.agent_name,
                "duration_ms": duration_ms,
            },
        )
        response.headers["X-Request-Id"] = request_id
        return response

    @app.exception_handler(AgentHTTPError)
    async def handle_agent_error(request: Request, exc: AgentHTTPError) -> JSONResponse:
        payload = ErrorResponse(
            error=AgentError(
                message=exc.message,
                type=exc.error_type,
                code=exc.code,
            )
        )
        response = JSONResponse(status_code=exc.status_code, content=payload.model_dump())
        request_id = getattr(request.state, "request_id", None)
        if request_id:
            response.headers["X-Request-Id"] = request_id
        return response

    return app


app = create_app()


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("src.main:app", host=settings.host, port=settings.port, reload=False)

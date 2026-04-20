import time

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from src.config import get_settings
from src.router import router
from src.schemas.response import AgentError, AgentHTTPError, ErrorResponse


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=f"{settings.agent_name} agent",
        version=settings.version,
    )
    app.state.started_at = time.monotonic()
    app.include_router(router)

    @app.middleware("http")
    async def propagate_request_id(request: Request, call_next):
        request_id = request.headers.get("X-Request-Id")
        response = await call_next(request)
        if request_id:
            response.headers["X-Request-Id"] = request_id
        return response

    @app.exception_handler(AgentHTTPError)
    async def handle_agent_error(_: Request, exc: AgentHTTPError) -> JSONResponse:
        payload = ErrorResponse(
            error=AgentError(
                message=exc.message,
                type=exc.error_type,
                code=exc.code,
            )
        )
        return JSONResponse(status_code=exc.status_code, content=payload.model_dump())

    return app


app = create_app()


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("src.main:app", host=settings.host, port=settings.port, reload=False)

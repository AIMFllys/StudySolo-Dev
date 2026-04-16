import time

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from src.config import get_settings
from src.core.news.app import app as legacy_news_app
from src.schemas.response import AgentError, AgentHTTPError, ErrorResponse


def create_app() -> FastAPI:
    settings = get_settings()
    app = legacy_news_app
    app.title = f"{settings.agent_name} agent"
    app.version = settings.version
    app.state.started_at = time.monotonic()
    if not getattr(app.state, "studysolo_wrapped", False):
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

        @app.exception_handler(HTTPException)
        async def handle_http_exception(_: Request, exc: HTTPException) -> JSONResponse:
            detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
            code = "invalid_request"
            if exc.status_code == 401:
                code = "invalid_api_key"
            payload = ErrorResponse(
                error=AgentError(
                    message=detail,
                    type="authentication_error" if exc.status_code == 401 else "invalid_request_error",
                    code=code,
                )
            )
            return JSONResponse(status_code=exc.status_code, content=payload.model_dump())

        app.state.studysolo_wrapped = True

    return app


app = create_app()


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("src.main:app", host=settings.host, port=settings.port, reload=False)

"""Security middleware helpers."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import get_settings

_SECURITY_HEADERS = {
    "Content-Security-Policy": "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}


class SecurityHeadersMiddleware:
    """Attach a minimal set of response security headers to every HTTP response."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                existing = {key.lower() for key, _ in headers}
                for header_name, header_value in _SECURITY_HEADERS.items():
                    encoded_name = header_name.lower().encode("latin-1")
                    if encoded_name not in existing:
                        headers.append((encoded_name, header_value.encode("latin-1")))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)


def add_cors_middleware(app: FastAPI) -> None:
    """Register CORS middleware restricted to the CORS_ORIGIN env variable."""
    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.cors_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def add_security_headers_middleware(app: FastAPI) -> None:
    """Register the security headers middleware."""
    app.add_middleware(SecurityHeadersMiddleware)

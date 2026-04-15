from fastapi import Header

from src.config import get_settings
from src.schemas.response import AgentHTTPError


def verify_api_key(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> None:
    settings = get_settings()
    token = (authorization or "").removeprefix("Bearer").strip()
    if not token or token != settings.api_key:
        raise AgentHTTPError(
            status_code=401,
            message="Invalid API key",
            error_type="authentication_error",
            code="invalid_api_key",
        )

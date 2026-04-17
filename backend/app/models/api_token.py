"""Pydantic models for Personal Access Tokens (CLI / MCP Bearer auth)."""

from datetime import datetime

from pydantic import BaseModel, Field


class ApiTokenCreate(BaseModel):
    """Request body for POST /api/tokens."""

    name: str = Field(
        min_length=1, max_length=64,
        description="A human-readable label for the token (e.g. 'my-laptop-cli').",
    )
    expires_in_days: int | None = Field(
        default=None, ge=1, le=365,
        description="Optional expiry in days. Omit for a non-expiring token.",
    )


class ApiTokenListItem(BaseModel):
    """Element in GET /api/tokens."""

    id: str
    name: str
    token_prefix: str
    scopes: list[str] = Field(default_factory=lambda: ["*"])
    created_at: datetime
    expires_at: datetime | None = None
    last_used_at: datetime | None = None
    revoked_at: datetime | None = None


class ApiTokenCreated(ApiTokenListItem):
    """Response for POST /api/tokens — plaintext token is included ONLY here."""

    token: str = Field(
        description="The plaintext token (sk_studysolo_...). Shown exactly once; store it now.",
    )

"""Shared helpers for auth routes."""

from datetime import datetime, timedelta, timezone
import os

from fastapi import Request, Response

_AUTH_COOKIE_MAX_AGE = int(os.getenv("AUTH_COOKIE_MAX_AGE", str(60 * 60 * 24 * 30)))
FRONTEND_URL = os.getenv("CORS_ORIGIN", "http://localhost:2037")


def _is_dev_environment() -> bool:
    """Read the current environment at call time to avoid stale import-time config."""
    return os.getenv("ENVIRONMENT", "development").lower() == "development"


def build_cookie_options(remember_me: bool = True) -> dict:
    """Return cookie options, preserving remember-me semantics."""
    options = {
        "httponly": True,
        "secure": not _is_dev_environment(),
        "samesite": "lax",
        "path": "/",
    }
    if remember_me:
        options["max_age"] = _AUTH_COOKIE_MAX_AGE
    return options


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    remember_me: bool = True,
) -> None:
    """Write access and refresh tokens to HttpOnly cookies."""
    cookie_options = build_cookie_options(remember_me)
    response.set_cookie(key="access_token", value=access_token, **cookie_options)
    response.set_cookie(key="refresh_token", value=refresh_token, **cookie_options)
    response.set_cookie(
        key="remember_me",
        value="1" if remember_me else "0",
        **cookie_options,
    )


def clear_auth_cookies(response: Response) -> None:
    """Clear auth cookies from the response."""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    response.delete_cookie(key="remember_me", path="/")


def resolve_client_ip(request: Request) -> str:
    """Resolve the originating client IP, preferring proxy headers when present."""
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def is_rate_limited(db, bucket: str, event_type: str, limit: int, window_seconds: int) -> bool:
    """Return True when the recent failure count in the database reaches the allowed limit."""
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=window_seconds)).isoformat()
    result = (
        await db.from_("auth_rate_limit_events")
        .select("id")
        .eq("bucket", bucket)
        .eq("event_type", event_type)
        .gte("created_at", cutoff)
        .limit(limit)
        .execute()
    )
    return len(result.data or []) >= limit


async def record_rate_limit_failure(db, bucket: str, event_type: str, window_seconds: int) -> int:
    """Record a failed attempt and return the recent failure count for the bucket."""
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(seconds=window_seconds)).isoformat()
    await db.from_("auth_rate_limit_events").insert(
        {
            "bucket": bucket,
            "event_type": event_type,
            "expires_at": expires_at,
        }
    ).execute()
    cutoff = (now - timedelta(seconds=window_seconds)).isoformat()
    result = (
        await db.from_("auth_rate_limit_events")
        .select("id")
        .eq("bucket", bucket)
        .eq("event_type", event_type)
        .gte("created_at", cutoff)
        .execute()
    )
    return len(result.data or [])


async def clear_rate_limit_failures(db, event_type: str, *buckets: str) -> None:
    """Clear one or more failure buckets after a successful verification."""
    for bucket in buckets:
        await db.from_("auth_rate_limit_events").delete().eq("bucket", bucket).eq(
            "event_type", event_type
        ).execute()

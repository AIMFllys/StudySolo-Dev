"""Supabase AsyncClient singleton."""

from supabase import AsyncClient, create_async_client

from app.core.config import get_settings

# Module-level singleton (lazy-initialised on first async call)
_client: AsyncClient | None = None


async def get_db() -> AsyncClient:
    """Return the shared Supabase AsyncClient, creating it on first call."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = await create_async_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _client

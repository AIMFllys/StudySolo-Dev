"""StudySolo API — FastAPI entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import router as api_router
from app.middleware.admin_auth import AdminJWTMiddleware
from app.middleware.auth import JWTAuthMiddleware
from app.middleware.security import add_cors_middleware, add_security_headers_middleware
from app.services.ai_catalog_service import validate_config_sku_references

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup & shutdown hooks."""
    # ── Startup ──
    try:
        missing = await validate_config_sku_references()
        if missing:
            logger.warning("[startup] %d missing SKU(s) — model catalog may be incomplete", len(missing))
    except Exception as exc:
        logger.error("[startup] SKU validation failed: %s", exc)

    async def _periodic_cleanup():
        from app.api.exports import EXPORT_DIR
        from app.services.cleanup_service import purge_old_exports
        while True:
            try:
                purge_old_exports(EXPORT_DIR, max_age_seconds=3600)
            except Exception as e:
                logger.error("[cleanup] Export purge failed: %s", e)
            await asyncio.sleep(3600)  # Run every hour

    import asyncio
    cleanup_task = asyncio.create_task(_periodic_cleanup())
    
    yield
    # ── Shutdown ──
    cleanup_task.cancel()


from app.core.config import get_settings  # noqa: E402

_settings = get_settings()
_is_dev = _settings.environment != "production"

app = FastAPI(
    title="StudySolo API",
    redirect_slashes=False,
    lifespan=lifespan,
    docs_url="/docs" if _is_dev else None,
    redoc_url="/redoc" if _is_dev else None,
    openapi_url="/openapi.json" if _is_dev else None,
)

# CORS — restricted to CORS_ORIGIN env variable
add_cors_middleware(app)
add_security_headers_middleware(app)

# JWT authentication middleware for protected /api/* routes
app.add_middleware(JWTAuthMiddleware)

# Admin JWT middleware for /api/admin/* routes (registered after JWTAuthMiddleware)
app.add_middleware(AdminJWTMiddleware)

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Register all API routes under /api prefix
app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=2038, reload=True)

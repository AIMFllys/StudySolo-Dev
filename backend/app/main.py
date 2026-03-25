"""StudySolo API — FastAPI entry point."""

from fastapi import FastAPI

from app.api.router import router as api_router
from app.middleware.admin_auth import AdminJWTMiddleware
from app.middleware.auth import JWTAuthMiddleware
from app.middleware.security import add_cors_middleware, add_security_headers_middleware

app = FastAPI(title="StudySolo API", redirect_slashes=False)

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

"""Auth API package."""

from fastapi import APIRouter

from app.api.auth.captcha import router as captcha_router
from app.api.auth.consent import router as consent_router
from app.api.auth.login import router as login_router
from app.api.auth.me import router as me_router
from app.api.auth.password import router as password_router
from app.api.auth.register import router as register_router

router = APIRouter()
router.include_router(captcha_router)
router.include_router(register_router)
router.include_router(login_router)
router.include_router(password_router)
router.include_router(me_router)
router.include_router(consent_router)

__all__ = ["router"]


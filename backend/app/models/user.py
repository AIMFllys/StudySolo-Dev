"""Pydantic models for user authentication."""

from typing import Literal

from pydantic import BaseModel, EmailStr

# Canonical tier values — single source of truth (matches DB CHECK constraint)
TierType = Literal["free", "pro", "pro_plus", "ultra"]

# Cookie consent levels — matches DB CHECK constraint
CookieConsentLevel = Literal["essential", "all"]

# Current ToS / Privacy versions — bump when documents are updated
CURRENT_TOS_VERSION = "1.0"
CURRENT_PRIVACY_VERSION = "1.0"


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None
    verification_code: str          # 6-digit code from email
    agreed_to_terms: bool           # Must be True — service terms
    agreed_to_privacy: bool         # Must be True — privacy policy


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = True


class SyncSessionRequest(BaseModel):
    access_token: str
    refresh_token: str
    remember_me: bool = True


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    access_token: str
    refresh_token: str
    new_password: str


class ResetPasswordWithCodeRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str


class SendCodeRequest(BaseModel):
    email: EmailStr
    captcha_token: str  # Slider captcha verification token
    code_type: str = "register"  # 'register' or 'reset_password'


class CaptchaVerifyRequest(BaseModel):
    challenge: str
    x: int


class UserInfo(BaseModel):
    id: str
    email: str
    name: str | None = None
    avatar_url: str | None = None
    role: str = "user"          # System role (user/admin) — from JWT
    tier: TierType = "free"     # Subscription tier — from user_profiles table


class ConsentUpdate(BaseModel):
    """Update one or more consent fields for the current user."""
    cookie_consent_level: CookieConsentLevel | None = None   # Cookie preference
    agreed_to_terms: bool | None = None                      # Re-sign ToS
    agreed_to_privacy: bool | None = None                    # Re-sign Privacy

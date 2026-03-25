"""Captcha challenge and verification routes."""

import hashlib
import hmac
import os
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from supabase import AsyncClient

from app.core.deps import get_supabase_client
from app.models.user import CaptchaVerifyRequest

router = APIRouter()

_PIECE_L = 42
_PIECE_R = 9
_L = _PIECE_L + _PIECE_R * 2 + 3
_CANVAS_W = 320
_CAPTCHA_TOLERANCE = 6
_CAPTCHA_TTL_SECONDS = 300


def _s32(x: int) -> int:
    x &= 0xFFFFFFFF
    return x - 0x100000000 if x >= 0x80000000 else x


def _u32(x: int) -> int:
    return x & 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    return _s32(_s32(a) * _s32(b))


def _mulberry32(seed: int):
    state = [seed]

    def _next() -> float:
        state[0] = _s32(state[0])
        state[0] = _s32(state[0] + 0x6D2B79F5)
        a = state[0]
        t = _imul(a ^ (_u32(a) >> 15), _s32(1 | a))
        imul_r = _imul(_s32(t ^ (_u32(t) >> 7)), _s32(61 | t))
        t = _s32(_s32(t + imul_r) ^ t)
        return _u32(t ^ (_u32(t) >> 14)) / 4294967296

    return _next


def _compute_target_x(seed: int) -> int:
    rng = _mulberry32(seed)
    min_val = _L + 10
    max_val = _CANVAS_W - _L - 10
    return int(min_val + rng() * (max_val - min_val))


def _get_captcha_secret() -> str:
    secret = os.getenv("CAPTCHA_SECRET")
    if not secret:
        raise RuntimeError("CAPTCHA_SECRET 未配置")
    return secret


def _sign(payload: str) -> str:
    return hmac.new(_get_captcha_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()


def _parse_signed_token(token: str) -> tuple[str, str, str] | None:
    try:
        parts = token.split(":")
        if len(parts) != 3:
            return None
        challenge_id, ts_str, provided_hmac = parts
        int(ts_str)
        return challenge_id, ts_str, provided_hmac
    except Exception:
        return None


async def verify_captcha_token(token: str, db: AsyncClient) -> bool:
    """Verify slider captcha token issued by this backend without consuming it."""
    parts = _parse_signed_token(token)
    if not parts:
        return False

    challenge_id, ts_str, provided_hmac = parts
    payload = f"{challenge_id}:{ts_str}"
    if not hmac.compare_digest(_sign(payload), provided_hmac):
        return False

    now = datetime_now_iso()
    result = (
        await db.from_("captcha_challenges")
        .select("id, verified, consumed")
        .eq("id", challenge_id)
        .gte("expires_at", now)
        .maybe_single()
        .execute()
    )
    challenge_entry = result.data if result else None
    if not challenge_entry:
        return False
    return bool(challenge_entry.get("verified")) and not bool(challenge_entry.get("consumed"))


async def consume_captcha_token(token: str, db: AsyncClient) -> bool:
    """Consume a verified captcha token so it cannot be replayed."""
    parts = _parse_signed_token(token)
    if not parts:
        return False

    challenge_id, ts_str, provided_hmac = parts
    payload = f"{challenge_id}:{ts_str}"
    if not hmac.compare_digest(_sign(payload), provided_hmac):
        return False

    now = datetime_now_iso()
    result = (
        await db.from_("captcha_challenges")
        .select("id, verified, consumed")
        .eq("id", challenge_id)
        .gte("expires_at", now)
        .maybe_single()
        .execute()
    )
    challenge_entry = result.data if result else None
    if not challenge_entry:
        return False
    if not challenge_entry.get("verified") or challenge_entry.get("consumed"):
        return False

    await db.from_("captcha_challenges").update({"consumed": True}).eq("id", challenge_id).execute()
    return True


def datetime_now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


@router.post("/captcha-challenge")
async def generate_captcha_challenge(
    db: AsyncClient = Depends(get_supabase_client),
):
    """Generate a puzzle challenge for the frontend slider captcha."""
    seed = int.from_bytes(os.urandom(4), "big") % 100000
    target_x = _compute_target_x(seed)
    ts = str(int(time.time()))
    challenge_id = uuid.uuid4().hex
    payload = f"{challenge_id}:{seed}:{ts}:{target_x}"
    sig = _sign(payload)
    challenge = f"{challenge_id}:{seed}:{ts}:{sig}"
    expires_at = time.strftime(
        "%Y-%m-%dT%H:%M:%SZ",
        time.gmtime(time.time() + _CAPTCHA_TTL_SECONDS),
    )
    await db.from_("captcha_challenges").insert(
        {
            "id": challenge_id,
            "seed": seed,
            "target_x": target_x,
            "verified": False,
            "consumed": False,
            "expires_at": expires_at,
        }
    ).execute()

    return {"seed": seed, "challenge": challenge}


@router.post("/captcha-token")
async def verify_captcha_and_issue_token(
    body: CaptchaVerifyRequest,
    db: AsyncClient = Depends(get_supabase_client),
):
    """Verify the user puzzle answer and return a signed verification token."""
    parts = body.challenge.split(":")
    if len(parts) != 4:
        raise HTTPException(status_code=400, detail="无效的验证挑战")

    challenge_id, seed_str, ts_str, provided_sig = parts
    try:
        seed = int(seed_str)
        ts = int(ts_str)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="无效的验证挑战") from exc

    if abs(time.time() - ts) > 300:
        raise HTTPException(status_code=400, detail="验证已过期，请刷新重试")

    target_x = _compute_target_x(seed)
    payload = f"{challenge_id}:{seed}:{ts_str}:{target_x}"
    expected_sig = _sign(payload)
    if not hmac.compare_digest(expected_sig, provided_sig):
        raise HTTPException(status_code=400, detail="无效的验证挑战")

    result = (
        await db.from_("captcha_challenges")
        .select("id, seed, target_x, verified, consumed")
        .eq("id", challenge_id)
        .gte("expires_at", datetime_now_iso())
        .maybe_single()
        .execute()
    )
    challenge_entry = result.data if result else None
    if not challenge_entry:
        raise HTTPException(status_code=400, detail="验证已过期，请刷新重试")
    if challenge_entry.get("seed") != seed or int(challenge_entry.get("target_x", -1)) != target_x:
        raise HTTPException(status_code=400, detail="无效的验证挑战")
    if challenge_entry.get("verified") or challenge_entry.get("consumed"):
        raise HTTPException(status_code=400, detail="验证挑战已使用，请刷新重试")

    if abs(body.x - target_x) > _CAPTCHA_TOLERANCE:
        raise HTTPException(status_code=400, detail="拼合不准确，请重试")

    token_ts = str(int(time.time()))
    token_payload = f"{challenge_id}:{token_ts}"
    token_hmac = _sign(token_payload)
    await db.from_("captcha_challenges").update({"verified": True}).eq("id", challenge_id).execute()

    return {"token": f"{challenge_id}:{token_ts}:{token_hmac}"}

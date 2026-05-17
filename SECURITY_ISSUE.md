# Security Audit Report

A thorough review of the codebase has revealed several critical security vulnerabilities that require immediate attention.

## 1. Weak PRNG for Verification Codes
**Location:** `backend/app/services/email_service.py` - `_generate_code()`
**Issue:** The verification codes (used for password reset and registration) are generated using Python's `random.choices`, which is based on the Mersenne Twister. This is not a cryptographically secure pseudo-random number generator (CSPRNG), making it susceptible to prediction and brute-force attacks if the internal state of the RNG can be inferred.
**Impact:** An attacker could predict verification codes, allowing them to bypass the registration verification or, more critically, reset users' passwords without having access to their email accounts.
**Remediation:** Replace the `random` module with the cryptographically secure `secrets` module.
```python
import secrets
import string

def _generate_code(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))
```

## 2. Weak PRNG and Seed Leakage in Captcha
**Location:** `backend/app/api/auth/captcha.py` - `generate_captcha_challenge()`
**Issue:** The captcha seed is generated using `os.urandom(4)` modulo 100000, creating a very small pool of possible seeds (100,000). The `seed` is then returned directly to the client in the response (`return {"seed": seed, "challenge": challenge}`). Because the client has the seed and the algorithm (`_mulberry32` and `_compute_target_x`) is deterministic and likely identical to or guessable from the frontend code, an attacker can simply calculate the expected `target_x` client-side without solving the puzzle.
**Impact:** Complete bypass of the captcha mechanism intended to prevent automated bots from registering, sending spam codes, or brute-forcing endpoints.
**Remediation:**
1. Do not expose the `seed` or `target_x` in the payload returned to the client or the public `challenge` string.
2. Store the expected `target_x` or `seed` server-side (as is already done in `captcha_challenges` table), and only give the client an opaque `challenge_id`.

## 3. Rate Limit Bypass via IP Spoofing
**Location:** `backend/app/api/auth/_helpers.py` - `resolve_client_ip()`
**Issue:** The function naively trusts the `x-forwarded-for` header to determine the client's IP address.
```python
def resolve_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
```
**Impact:** An attacker can easily spoof the `x-forwarded-for` header in their requests. Because the IP address is used for rate limiting (e.g., in `reset-password-with-code` and `register`), an attacker can bypass IP-based rate limiting entirely by changing this header for every request, facilitating credential stuffing or brute-force attacks.
**Remediation:** Rely on the proxy's verified IP rather than unverified client headers. In FastAPI/Uvicorn, ensure the application is configured to trust specific proxy IPs using the `--forwarded-allow-ips` flag, and then rely entirely on `request.client.host`, which Uvicorn will populate correctly based on the trusted proxy.

## 4. Race Condition in Verification Code Verification
**Location:** `backend/app/services/email_service.py` - `verify_code()`
**Issue:** The code verification process first checks the current attempt count, compares the code, and then updates the record.
```python
    record = result.data[0]
    code_id = record["id"]
    attempt_count = int(record.get("attempt_count") or 0)
    # ...
    # Mark as used immediately after a successful verification.
    await db_client.from_("verification_codes_v2").update(
        {"is_used": True}
    ).eq("id", code_id).execute()
```
Because the database queries are independent and not executed within a transaction, a race condition (Time-of-Check to Time-of-Use, TOCTOU) exists. Multiple concurrent requests could bypass the `_MAX_VERIFICATION_ATTEMPTS` check or reuse the same code before `is_used` is set to `True`.
**Impact:** An attacker could brute-force the verification code by sending many concurrent requests, or reuse a code multiple times.
**Remediation:** Use Supabase RPCs (stored procedures) to handle the verification logic within a single database transaction, ensuring atomic check-and-update.

## 5. Potential Server-Side Request Forgery (SSRF) / Remote Code Execution / Hardcoded Telemetry Endpoint
**Location:** `backend/app/services/workflow_generator.py` - `_debug_log()`
**Issue:** The code contains a hardcoded `http://127.0.0.1:7807/ingest/...` endpoint.
```python
        req = Request(
            "http://127.0.0.1:7807/ingest/6761d4ab-0d6d-4e94-a0bc-90a491230a9a",
            method="POST",
            ...
        with urlopen(req, timeout=0.2):
            pass
```
While currently pointing to localhost, this code path blindly executes `urlopen` on every AI generation step if a local server is running. This is a severe operational risk and possible vector for abuse if the server is accessible or if internal services rely on unauthenticated POSTs to this port.
**Impact:** Unintended internal network access and exposure of sensitive AI inputs/outputs to the hardcoded endpoint.
**Remediation:** Remove the hardcoded telemetry/debugging endpoints before deploying to production.
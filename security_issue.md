# Security Vulnerability Report

This document outlines the security vulnerabilities identified during the code audit of the StudySolo repository.

## 1. [High/Medium] Insecure Randomness in Verification Code Generation (CWE-330)

**Location:** `backend/app/services/email_service.py` - `_generate_code` function

**Description:**
The application uses Python's standard `random.choices` to generate numeric verification codes for email registration and password reset. The `random` module implements the Mersenne Twister algorithm, which is a pseudo-random number generator (PRNG) intended for modeling and simulation, not security or cryptography. The internal state of Mersenne Twister can be observed and predicted if enough outputs are known, allowing an attacker to predict future verification codes, potentially leading to unauthorized account access or account takeover.

**Impact:**
Attackers could guess verification codes, compromising the password reset or registration flow.

**Recommendation:**
Use the cryptographically secure `secrets` module instead of `random`.
```python
import secrets
import string

def _generate_code(length: int = 6) -> str:
    """Generate a cryptographically secure random numeric verification code."""
    return "".join(secrets.choice(string.digits) for _ in range(length))
```

## 2. [Medium] Denial of Service (DoS) via Email/Username-Based Rate Limiting

**Location:** `backend/app/api/auth/register.py`, `backend/app/api/auth/password.py`, `backend/app/api/auth/_helpers.py`

**Description:**
The rate-limiting mechanism uses the user's email address as the bucket key (e.g., `bucket = f"register:{body.email.lower()}"`). If an attacker repeatedly sends invalid verification codes (or requests them) for a victim's email address, they can trigger the rate limit and lock out the legitimate user from registering or resetting their password.

**Impact:**
A malicious actor could perform targeted Denial of Service attacks on specific users, preventing them from accessing or creating accounts.

**Recommendation:**
Rate limiting should be tied to the source IP address (`ip_bucket = f"register-ip:{client_ip}"`) or a generic global limit for unauthenticated actions, rather than the target identity (email). If identity-based limiting is kept, ensure that it only counts failures originating from the same session or IP, or implement CAPTCHA effectively to mitigate automated attacks (which is present, but needs to be robust).

## 3. [Low/Medium] Use of Weak Custom PRNG in Captcha Generation (CWE-338)

**Location:** `backend/app/api/auth/captcha.py` - `_mulberry32` function

**Description:**
The custom slider captcha implementation relies on a custom implementation of the Mulberry32 pseudo-random number generator to compute the target x-coordinate. While this is not directly used for sensitive keys, relying on weak, custom PRNGs for security mechanisms (like CAPTCHA) can sometimes allow an attacker to predict the captcha solutions if they understand the seed generation or the PRNG state.

**Impact:**
May reduce the effectiveness of the CAPTCHA if attackers can predict the target coordinates mathematically.

**Recommendation:**
Standardize on Python's `secrets` module or `os.urandom` to determine random offsets and positions, avoiding the need to maintain custom pseudo-random math in the codebase.

## 4. [Low] Extensive Use of Try-Except-Pass (Swallowing Exceptions) (CWE-703)

**Location:** Multiple files (`backend/app/api/auth/login.py`, `password.py`, `register.py`, `feedback.py`, `backend/app/middleware/auth.py`)

**Description:**
There are several instances where exceptions are caught generically (`except Exception:`) and ignored (`pass`). This pattern masks underlying errors, making debugging difficult and potentially hiding critical security failures (e.g., database connection issues, token parsing errors that shouldn't happen, etc.).

**Impact:**
Errors in security-critical paths might fail silently, leaving the system in an inconsistent or vulnerable state without logging the incident.

**Recommendation:**
Avoid naked `except Exception: pass`. If an error is truly expected and non-fatal, log the exception using `logger.warning` or `logger.error` so that the behavior is observable.

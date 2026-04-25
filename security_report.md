# Security Vulnerability Report: StudySolo Backend

This document details potential security issues and code quality concerns identified in the `backend/` codebase. The findings range from weak cryptographic functions to silent exception handling that could mask security issues.

## 1. High Severity: Weak Cryptographic PRNG in Email Service
**Location:** `backend/app/services/email_service.py` (Line 23)

**Description:**
The `_generate_code` function uses `random.choices` from the standard `random` library to generate email verification codes. The standard `random` module uses the Mersenne Twister, which is a deterministic Pseudo-Random Number Generator (PRNG). This is NOT cryptographically secure, and an attacker who observes a sufficient number of generated codes could potentially predict future verification codes and hijack user accounts.

**Fix Recommendation:**
Replace `random` with the `secrets` module which provides access to the most secure source of randomness that your operating system provides.
```python
import secrets
import string

def _generate_code(length: int = 6) -> str:
    """Generate a random numeric verification code securely."""
    return "".join(secrets.choice(string.digits) for _ in range(length))
```

## 2. Medium Severity: Silent Exception Handling (Try-Except-Pass)
**Locations:**
- `backend/app/api/auth/login.py` (Lines 70, 83)
- `backend/app/api/auth/password.py` (Line 27)
- `backend/app/api/auth/register.py` (Line 207)
- `backend/app/api/feedback.py` (Lines 131, 165)
- `backend/app/middleware/auth.py` (Line 102)

**Description:**
There are multiple instances across the authentication, registration, and middleware code where exceptions are caught using `except Exception:` and completely ignored via `pass`. Silent failures in security-critical paths (such as checking profiles, logging out, or soft-auth middleware) can obscure errors that might indicate an attack or a misconfiguration, making it extremely difficult to detect and debug issues in production.

**Fix Recommendation:**
Instead of silencing exceptions, log the error using the application's logger (`logger.warning` or `logger.exception`), even if the business logic dictates that the application should continue executing.

## 3. Medium/Low Severity: Use of Assertions for Application Logic
**Locations:**
- `backend/app/services/ai_chat/model_caller.py` (Line 39)
- `backend/app/services/llm/router.py` (Lines 90, 205, 207, 216, 218)

**Description:**
The `assert` statement is used to enforce conditions in production code. Python's `assert` statements are entirely stripped out when the Python interpreter is run with optimization flags (e.g., `python -O`). If these assertions are guarding against invalid states or security checks, these protections will be removed in optimized production environments.

**Fix Recommendation:**
Replace `assert` statements with explicit `if` conditions that raise appropriate exceptions (such as `ValueError` or `RuntimeError`).

## 4. Medium Severity: Improper usage of `urlopen` (Potential SSRF)
**Location:** `backend/app/services/workflow_generator.py` (Line 55)

**Description:**
The code uses `urllib.request.urlopen` to send a debugging payload to `http://127.0.0.1:7807/ingest/...`. While the URL is currently hardcoded and only points to `127.0.0.1`, using `urlopen` broadly without disabling custom protocols can lead to Server-Side Request Forgery (SSRF) if any part of the URL becomes dynamic in the future. `urlopen` supports `file://` scheme which can read local files.

**Fix Recommendation:**
Since the project relies on external API calls elsewhere, it is safer to use `httpx` or `aiohttp` (or restrict `urlopen` schemes explicitly). Additionally, hardcoding `127.0.0.1` for production logging might cause connection errors in containerized environments. Consider making the logging ingest endpoint configurable via environment variables.

## 5. Low/Informational Severity: Insecure Uvicorn Bind in Main Server
**Location:** `backend/app/main.py` (Line 80)

**Description:**
The dev server initialization binds to all network interfaces (`host="0.0.0.0"`) while explicitly setting `reload=True`.
```python
uvicorn.run("app.main:app", host="0.0.0.0", port=2038, reload=True)
```
If this file is accidentally executed on a public-facing server, the development features (like auto-reload) and potentially unrestricted access will be exposed to the internet.

**Fix Recommendation:**
Restrict the binding to `127.0.0.1` for development, or ensure that production deployments exclusively use `gunicorn` or a proper process manager that does not invoke `app.main`'s `if __name__ == "__main__":` block with dev flags.

## 6. Low/Informational Severity: Possible Misuse of `service_role` (get_db) instead of `anon_db`
**Location:** `backend/app/api/nodes.py` (Line 73)

**Description:**
The API endpoint `/api/nodes/config-options/...` calls `_get_kb_document_options(user_id)`, which utilizes `get_db()` instead of `get_anon_db()`. According to the project's documentation/memory, `get_db()` uses the `service_role` key and bypasses Row-Level Security (RLS). While the query itself restricts data using `.eq("user_id", user_id)` (which mitigates the risk), user-facing routes should ideally use `get_anon_db()` to strictly enforce RLS policies and reduce the risk of accidental data leakage if the query builder logic changes.

**Fix Recommendation:**
Refactor the endpoint to accept a `get_anon_db` client dependency so that the request executes under the security context of the current user.

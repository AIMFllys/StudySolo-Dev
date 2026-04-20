# StudySolo Security Vulnerabilities Report

## Overview
During a security review of the `StudySolo` repository, three critical and high-severity security vulnerabilities were identified in the backend authentication, verification, and database access mechanisms. These issues expose the application to automated attacks, account takeovers, and potential data breaches by completely bypassing database-level access controls.

---

## 1. Captcha Verification Bypass (Logic Flaw)
**Severity:** High
**Location:** `backend/app/api/auth/captcha.py`

### Description
The CAPTCHA implementation is intended to prevent automated bots from sending arbitrary requests (e.g., sending verification emails). However, the endpoint `/captcha-challenge` generates the challenge puzzle by randomly selecting a `seed` and then returns this `seed` directly to the client in the JSON response (`{"seed": seed, "challenge": challenge}`).

Because the logic to compute the valid answer (`_compute_target_x`) is fully deterministic and uses a custom `_mulberry32` PRNG implementation seeded by the same `seed`, an attacker can write a simple script implementing `_compute_target_x` to instantly and mathematically calculate the correct `target_x` puzzle answer without any human interaction.

### Impact
Bots can bypass the CAPTCHA entirely. This permits unbounded automated exploitation of the `/send-code` endpoints, leading to SMS/Email spamming, exhaustion of email sending quotas (Aliyun DirectMail), and potential costs or bans from the email provider.

### Recommended Fix
Do not expose the `seed` or `target_x` to the client. The server should generate the `target_x`, embed it encrypted or hashed within the `challenge` payload (which the client must return unmodified), and the client should only be responsible for returning its computed `x` position. Alternatively, store the expected `target_x` for a given `challenge_id` in the database or cache. When the client submits its `x`, the server retrieves the true `target_x` from the database and compares it. Currently, the code stores `target_x` in the DB but *also* hands the `seed` out, which defeats the purpose.

---

## 2. Race Condition in Email Code Verification (TOCTOU)
**Severity:** Critical
**Location:** `backend/app/services/email_service.py` -> `verify_code` function

### Description
The `verify_code` function limits brute-force attempts on the 6-digit verification code by checking an `attempt_count` column. If the attempt fails, it increments the count. If `attempt_count >= 5`, it marks the code as used.

However, the read and update operations are not atomic:
```python
    result = (
        await db_client.from_("verification_codes_v2")
        .select("id, code, attempt_count")
        # ...
        .execute()
    )
    # ...
    if record.get("code") != code:
        new_attempt_count = attempt_count + 1
        update_payload = {"attempt_count": new_attempt_count}
        # ...
        await db_client.from_("verification_codes_v2").update(update_payload).eq("id", code_id).execute()
```
An attacker can exploit this Time-of-Check to Time-of-Use (TOCTOU) vulnerability by launching a concurrent HTTP request flood (e.g., sending 100 requests simultaneously). All requests will read `attempt_count = 0` before any of them commit `attempt_count = 1`.

### Impact
An attacker can completely bypass the 5-attempt limit and guess hundreds or thousands of codes simultaneously. Since the code is only 6 digits (1,000,000 possibilities), a concurrent brute-force attack can easily guess the code and achieve an Account Takeover (via password reset) or unauthorized registration.

### Recommended Fix
1. Use an atomic increment operation in the database rather than a separate read-then-write pattern, using a Supabase RPC function (PostgreSQL stored procedure).
2. Alternatively, implement strict distributed rate-limiting (e.g., using Redis) at the API gateway or route level to throttle requests for the same email address so that concurrent requests are blocked or queued sequentially.

---

## 3. Total RLS Bypass via Service Role Key Usage
**Severity:** Critical
**Location:** `backend/app/core/deps.py` and across multiple API routes.

### Description
Supabase Row Level Security (RLS) is intended to securely restrict user access directly at the database level. The repository documentation explicitly states: `get_db (service_role, bypasses RLS for internal/admin operations)` and `get_anon_db (anon key, respects RLS and auth policies for user-facing operations)`.

However, the dependency injection mapping is fundamentally broken:
```python
async def get_supabase_client(
    db: AsyncClient = Depends(get_db),
) -> AsyncClient:
    """Yield the shared Supabase AsyncClient (service_role)."""
    return db
```
The user-facing `get_supabase_client` resolves to `get_db()`, which is initialized with `supabase_service_role_key`. This `get_supabase_client` dependency is used pervasively across virtually all standard user API endpoints (e.g., `/api/workflow/crud.py`, `/api/knowledge.py`, `/api/community_nodes.py`, etc.).

Because the service role key overrides RLS, all database queries execute with superuser privileges. The application therefore must rely entirely on manual application-level checks to prevent cross-tenant data access.

### Impact
Any missed `user_id` validation in an API endpoint will instantly result in an Insecure Direct Object Reference (IDOR) or unauthorized access to other users' private data (e.g., workflows, chat logs, knowledge bases). It nullifies the primary security benefit of using Supabase (RLS).

### Recommended Fix
Refactor `get_supabase_client` to instantiate an authenticated client that acts on behalf of the user. In Supabase, this is typically done by passing the user's JWT access token to the client so that Postgres evaluates RLS policies properly for that user. Wait, in Supabase Python client, you can use `create_async_client` with the `supabase_anon_key`, and then explicitly set the user's session token using `db.auth.set_session(access_token, refresh_token)` or passing headers. Since `get_supabase_client` currently just returns the global service role client, the whole API is susceptible to logic bugs. Ensure all user-facing APIs correctly utilize an anonymous client injected with the user's JWT, not the service role client.
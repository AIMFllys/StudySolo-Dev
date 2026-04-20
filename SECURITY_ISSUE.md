# Security Issue Report

## 1. Predictable CAPTCHA Seed (CWE-338)
**Location**: `backend/app/api/auth/captcha.py`

**Description**:
The `generate_captcha_challenge` function uses a severely constrained pseudorandom number generator (PRNG) to generate CAPTCHA seeds. The seed is generated using `seed = int.from_bytes(os.urandom(4), "big") % 100000`, limiting the possible seeds to only 100,000 values. Because the target X coordinate (`_compute_target_x`) is fully determined by the seed, an attacker can pre-compute all 100,000 possible target X values. By requesting a challenge and extracting the seed from the returned string, the attacker can instantly match the seed to the pre-computed target X and bypass the CAPTCHA automatically without human interaction.

**Impact**:
Automated bots can bypass the slider CAPTCHA, rendering it ineffective against mass registration, credential stuffing, or SMS/email abuse.

**Recommendation**:
Remove the `% 100000` modulo and use a cryptographically secure random number generation or a wider range (e.g. 32-bit or 64-bit full range) for the seed. Since Python's `os.urandom` is secure, using a larger random integer space will prevent pre-computation attacks.

---

## 2. IP Spoofing in Rate Limiting and Audit Logging (CWE-348)
**Location**:
- `backend/app/api/auth/_helpers.py` -> `resolve_client_ip`
- `backend/app/services/audit_logger.py` -> `get_client_info`

**Description**:
The application relies on the `X-Forwarded-For` header to determine the client's IP address. Specifically, `resolve_client_ip` extracts the IP address using `forwarded_for.split(",")[0].strip()`. The `X-Forwarded-For` header can be easily manipulated by users. An attacker can set arbitrary `X-Forwarded-For` headers in their HTTP requests, causing the backend to trust the spoofed IP.

**Impact**:
- **Rate Limit Bypass**: An attacker can circumvent IP-based rate limiting (such as the limits on sending verification codes, resetting passwords, and registration failures) by rotating the `X-Forwarded-For` header in their requests.
- **Audit Log Pollution**: Admin actions and login attempts will log the spoofed IP instead of the real one, defeating the purpose of logging and auditing, and making investigations difficult.

**Recommendation**:
If the application is behind a trusted reverse proxy (e.g. NGINX, AWS ALB), ensure the proxy is configured to strip untrusted `X-Forwarded-For` headers from clients and set its own. In FastAPI, avoid blindly trusting the first IP in the `X-Forwarded-For` list. Use established middleware (like `ProxyHeadersMiddleware`) mapped only to trusted proxy IPs, or extract the rightmost IP that was added by the trusted load balancer.

---

## 3. Potential Insecure Direct Object Reference (IDOR) in Admin User Operations (CWE-284)
**Location**: `backend/app/api/admin_users.py`

**Description**:
Endpoints `/users/{user_id}/status` and `/users/{user_id}/role` allow changing the active status and tier role of a user. The endpoints perform authorization using the `AdminJWTMiddleware` which ensures the request comes from an admin, but does not distinguish between different administrative privilege levels.

**Impact**:
Any compromised admin account or lower-tier admin could arbitrarily change the status or tier (e.g., granting `ultra` tier or locking accounts) of users, possibly leading to privilege escalation and business logic abuse. If all admins are intended to have root privileges, this is accepted risk; however, typically, tier or status changes require super-admin privileges.

**Recommendation**:
Review the admin access control logic. If tier changes or locking user accounts requires a higher level of authorization, implement role-based access control (RBAC) specifically within the admin panel.

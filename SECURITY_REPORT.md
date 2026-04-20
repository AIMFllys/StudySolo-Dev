# Security Vulnerabilities Report

This report outlines potential security issues discovered during the review of the StudySolo backend codebase.

## 1. Captcha Bypass via Predictable Target Coordinate (CWE-330, CWE-288)

**File:** `backend/app/api/auth/captcha.py`

**Vulnerability Description:**
The slider captcha implementation relies on a `seed` value to determine the `target_x` coordinate where the puzzle piece should be placed. The `generate_captcha_challenge` endpoint returns this `seed` directly to the client alongside the challenge signature.

Because the logic to compute `target_x` from the `seed` (`_compute_target_x` and `_mulberry32` PRNG) is essentially public knowledge (or can be easily reverse-engineered from the frontend code that likely uses the same seed to draw the puzzle), an attacker can fully bypass the visual puzzle. They can simply extract the `seed` from the `/captcha-challenge` response, run the deterministic `_compute_target_x(seed)` logic locally, and submit the exact expected `x` coordinate back to the `/captcha-token` endpoint.

This defeats the purpose of the captcha, allowing automated scripts (bots) to register accounts or trigger password resets without human intervention, leading to potential abuse and resource exhaustion.

**Impact:**
- Automated account creation (spam accounts).
- SMS/Email bombing via automated password reset requests.
- Bypassing rate-limit protections that rely on human verification.

**Recommendation:**
Do not send the `seed` to the client if the `seed` alone is sufficient to calculate the answer. Instead, the server should generate the puzzle images (background and cutout) on the backend using the `seed`, and only send the images and a challenge ID to the client. The `target_x` (and the `seed` that generated it) must remain a server-side secret until verification is complete.

## 2. Insecure Fallback Export Directory Path (CWE-426, CWE-732)

**Files:**
- `backend/app/api/exports.py`
- `backend/app/services/file_converter.py`

**Vulnerability Description:**
The application defines an export directory for generated files (like PDFs and DOCX files). The fallback mechanism for defining this directory is inconsistent and potentially problematic on non-Windows platforms.

In `backend/app/api/exports.py`:
`EXPORT_DIR = os.getenv("EXPORT_DIR", os.path.join(os.path.expandvars("%TEMP%"), "studysolo_exports"))`

In `backend/app/services/file_converter.py`:
`EXPORT_DIR = os.getenv("EXPORT_DIR", os.path.join(tempfile.gettempdir(), "studysolo_exports"))`

The issue lies in `os.path.expandvars("%TEMP%")`. On Windows systems, `%TEMP%` expands to the user's temporary directory. However, on Linux or macOS systems, `%TEMP%` is not a standard environment variable (they use `$TMPDIR` or `/tmp`). If `%TEMP%` is not defined in the environment on a Linux server, `os.path.expandvars("%TEMP%")` will literally return the string `"%TEMP%"`.

This means that if `EXPORT_DIR` is not explicitly set in the environment, the application might create a directory literally named `%TEMP%/studysolo_exports` in the current working directory of the application process. Writing temporary files to the application root is a bad practice. If the web server configuration is overly permissive, it might inadvertently serve these files publicly. Furthermore, it creates inconsistent behavior between the API endpoint and the file converter service.

**Impact:**
- Potential exposure of exported files if the app root is served publicly.
- Cluttering the application's root directory with temporary files.
- Inconsistent behavior and potential path resolution errors between different parts of the application.

**Recommendation:**
Standardize the fallback mechanism to use Python's built-in `tempfile.gettempdir()` across all files, as it is cross-platform and reliable.

```python
# Recommended fix
import tempfile
EXPORT_DIR = os.getenv("EXPORT_DIR", os.path.join(tempfile.gettempdir(), "studysolo_exports"))
```

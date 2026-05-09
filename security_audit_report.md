# Security Audit Report

## 1. Hardcoded Bind Address
- **File:** `backend/app/main.py`
- **Location:** Line 80
- **Code:** `uvicorn.run("app.main:app", host="0.0.0.0", port=2038, reload=True)`
- **Issue:** The application binds to `0.0.0.0`, exposing the development server to all network interfaces. This is dangerous if accidentally run in a production or un-firewalled environment.

## 2. Insecure CORS Configuration
- **File:** `backend/app/middleware/security.py` / `backend/app/api/auth/_helpers.py`
- **Issue:** The CORS middleware relies on the `CORS_ORIGIN` environment variable (default: `http://localhost:2037`). It allows all credentials, methods, and headers. If `CORS_ORIGIN` is misconfigured in production (e.g., using a wildcard or a permissive regex), it could lead to severe CORS misconfigurations, allowing attackers to access authenticated user sessions.

## 3. Potential XSS via Runtime Environment Injection
- **File:** `frontend/src/app/layout.tsx`
- **Location:** Line 56
- **Code:** `dangerouslySetInnerHTML={{ __html: \`window.__ENV__=${JSON.stringify({...})}\`; }}`
- **Issue:** The application injects environment variables directly into a `<script>` tag using `dangerouslySetInnerHTML`. While these specific variables (`NEXT_PUBLIC_*`) are typically safe, if an attacker could manipulate the environment variables or if future sensitive variables are added, this pattern could lead to DOM-based XSS or sensitive data exposure.

## 4. Potential SSRF/Permissive URL Open
- **File:** `backend/app/services/workflow_generator.py`
- **Location:** Line 55
- **Code:** `with urlopen(req, timeout=0.2):`
- **Issue:** `urllib.request.urlopen` is used to make a request. Bandit flagged this as a potential issue because `urlopen` can support schemes like `file://`. While the specific URL appears to be hardcoded to `http://127.0.0.1:7807/`, using a more robust library like `httpx` (which is already in `requirements.txt`) is safer and more modern.

## 5. Potential SSRF/IDOR in workflow generator
- **File:** `backend/app/services/workflow_generator.py`
- **Location:** Line 52
- **Issue:** Code is sending payload to a hardcoded webhook url `http://127.0.0.1:7807/ingest/6761d4ab-0d6d-4e94-a0bc-90a491230a9a`. If an attacker can control the workflow execution, they might be able to exfiltrate data or trigger unintended actions on the internal network.

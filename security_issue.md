# StudySolo Security Assessment Report

Based on a detailed exploration of the codebase, several potential security vulnerabilities have been identified. Below is a comprehensive report on these issues.

## 1. Arbitrary Workflow Execution (Server-Side Execution Bypass)

**Location**: `backend/app/api/workflow_execute.py` -> `execute_workflow_sse_post` and `_resolve_requested_graph`

**Description**:
The POST endpoint `/api/workflow/{workflow_id}/execute` allows an authenticated user to pass an optional payload containing `nodes_json` and `edges_json` (via the `WorkflowExecuteRequest` model).

In the `_resolve_requested_graph` function:
```python
def _resolve_requested_graph(
    workflow: dict,
    body: WorkflowExecuteRequest | None,
) -> tuple[list[dict], list[dict]]:
    if body is None or (body.nodes_json is None and body.edges_json is None):
        return workflow.get("nodes_json") or [], workflow.get("edges_json") or []
    # ...
    return body.nodes_json, body.edges_json
```

If the client provides `nodes_json` and `edges_json`, they completely override the persisted graph associated with the `workflow_id`.

**Impact**:
This design effectively allows a user to execute an arbitrary workflow graph directly from the client side without saving it first, or modify a graph to contain sensitive or malicious nodes that shouldn't be executed in that context. While there is a tier-based restriction check later for AI models, an attacker could potentially:
- Call nodes like `web_search` to perform Server-Side Request Forgery (SSRF) against internal resources (depending on the external search provider's capability, but mostly just excessive external traffic).
- Abuse internal nodes intended only for system use or manipulate the inputs heavily.
- Since it writes results to the database (`write_db` node), attackers can forge arbitrary execution results into the memory system.

**Recommendation**:
It is strongly recommended to restrict workflow execution strictly to the saved definition in the database, ignoring client-provided overrides during execution. If client-side override execution (e.g., "Preview/Debug Mode") is required, there should be robust constraints (e.g., rate limits, restricting what nodes can be run dynamically, disabling DB persistence) specifically tailored to the dynamic execution mode.

---

## 2. IP Spoofing via Unvalidated `X-Forwarded-For` Header

**Location**: `backend/app/api/auth/_helpers.py` -> `resolve_client_ip`

**Description**:
In the authentication helper, the function responsible for resolving the client IP address blindly trusts the `X-Forwarded-For` header:

```python
def resolve_client_ip(request: Request) -> str:
    """Resolve the originating client IP, preferring proxy headers when present."""
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
```

**Impact**:
This IP resolution logic is used in critical rate-limiting functions (e.g., in `register.py` and `password.py` for verification codes). If the FastAPI application is deployed publicly without a proxy, or with a proxy that does not strip or enforce the `X-Forwarded-For` header for untrusted connections, an attacker can simply pass arbitrary IP addresses in the `X-Forwarded-For` header to entirely bypass the rate limiting and brute-force the authentication endpoints.

**Recommendation**:
Ensure that the `X-Forwarded-For` header is only trusted when the request originates from a known, trusted proxy/load balancer (e.g., using `TrustedHostMiddleware` or explicitly verifying against a whitelist of proxy IPs). Alternatively, configure the reverse proxy (like Nginx) to securely overwrite the `X-Forwarded-For` header.

---

## 3. Potential Path Traversal in Export Download

**Location**: `backend/app/api/exports.py` -> `download_export`

**Description**:
The `/download/{filename}` endpoint downloads a file. It employs `os.path.basename` to prevent path traversal, which is a good mitigation.
However, if there are endpoints saving exports where the user can control the name being saved, we need to ensure the writing logic is similarly protected. No immediate exploit found here since `safe_filename = os.path.basename(filename)` guarantees it's constrained to `EXPORT_DIR`, but it’s worth verifying the creation of these export files (e.g. `export_file` node).

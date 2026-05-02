# Security Issue Report

## Overview
A potential Server-Side Request Forgery (SSRF) vulnerability has been identified in the StudySolo backend application, specifically within the Agent Gateway and Admin Diagnostics components.

## Vulnerability Details
- **Type**: Server-Side Request Forgery (SSRF)
- **Severity**: Low / Moderate (requires file system access or admin privileges)
- **Affected Components**:
  - `backend/app/services/agent_gateway/caller.py`
  - `backend/app/services/agent_gateway/health.py`
  - `backend/app/api/admin_diagnostics.py`
  - `backend/app/api/agents.py`

### Description
The backend interacts with external sub-agents defined in a configuration file (`config/agents.yaml`). The `AgentRegistry` parses the `url` property from this YAML file and stores it.

When the backend performs health checks, fetches models, or routes chat requests, it utilizes the `httpx.AsyncClient` to send HTTP GET and POST requests directly to these URLs without prior validation.

For example, in `backend/app/services/agent_gateway/health.py`:
```python
async def _probe(self, agent: AgentMeta) -> bool:
    try:
        async with httpx.AsyncClient(timeout=_DEFAULT_HEALTH_TIMEOUT) as client:
            resp = await client.get(f"{agent.url}/health/ready")
        return resp.status_code == 200
    ...
```

And in `backend/app/api/admin_diagnostics.py`:
```python
async def _check_single_agent(self, agent) -> CheckResult:
    # ...
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(f"{agent.url}/health/ready")
    # ...
```

### Attack Scenario
If an attacker compromises the server filesystem (e.g., via another vulnerability) or gains access to the `agents.yaml` file, they could modify the `url` of an agent to an internal network IP (e.g., `http://169.254.169.254/latest/meta-data/` on AWS) or a service like Redis/Memcached.

When an authenticated administrator triggers the `/api/admin/diagnostics/full` endpoint, or when a user uses an agent chat endpoint (`/api/agents/{name}/chat`), the backend will dispatch HTTP requests to the attacker-controlled internal IP. The server response might also be leaked to the user.

### Impact
- Access to internal-only services or metadata endpoints.
- Port scanning of the internal network from the perspective of the server.
- Potential data leakage if the internal service response is echoed back in the chat endpoint.

### Recommended Remediation
1. **URL Validation / Allowlists**: Enforce strict validation on the URLs loaded from `agents.yaml`. Consider using an allowlist of domains or IP ranges.
2. **Restrict Loopback and Internal Subnets**: Explicitly block the `httpx` client from resolving or connecting to internal IP addresses (e.g., `127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.169.254`) unless explicitly intended (e.g., for local development).
3. **Parse Safely**: Ensure that the `AgentMeta` strictly validates that the `url` scheme is exactly `http` or `https` and properly formatted.
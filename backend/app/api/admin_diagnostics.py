"""Admin diagnostics endpoint for comprehensive system health checks.

This module provides a full system diagnostics endpoint that tests:
- Database connectivity (Supabase)
- AI model providers (all configured SKUs)
- Sub-agents (from agents.yaml)
- Internal services (embedding, search, etc.)
"""

from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.services.agent_gateway import AgentGateway, AgentRegistry
from app.services.ai_catalog_service import _load_catalog_rows, is_provider_configured
from app.services.llm.provider import get_client
from app.core.config import get_settings
from app.core.config_loader import get_config

router = APIRouter(tags=["admin-diagnostics"])


class ComponentStatus(BaseModel):
    """Status of a single system component."""

    id: str
    name: str
    category: Literal["database", "ai_model", "agent", "external_api", "internal_service"]
    status: Literal["healthy", "unhealthy"]
    latency_ms: int
    error: str | None = None
    details: dict | None = None


class DiagnosticsReport(BaseModel):
    """Full diagnostics report with multiple export formats."""

    markdown: str
    text: str
    json: str


class DiagnosticsResponse(BaseModel):
    """Response model for full diagnostics endpoint."""

    timestamp: str
    overall_healthy: bool
    summary: dict = Field(default_factory=dict)
    components: list[ComponentStatus]
    reports: DiagnosticsReport


@dataclass
class CheckResult:
    """Internal result of a single component check."""

    id: str
    name: str
    category: ComponentStatus.__annotations__["category"]
    healthy: bool
    latency_ms: int
    error: str | None = None
    details: dict = field(default_factory=dict)


class DiagnosticsRunner:
    """Orchestrates parallel health checks across all system components."""

    def __init__(self):
        self.results: list[CheckResult] = []

    async def run_all_checks(self) -> list[CheckResult]:
        """Run all diagnostic checks in parallel with individual timeouts."""
        self.results = []

        # Create check tasks
        tasks = [
            self._check_database(),
            *self._check_ai_models(),
            *self._check_agents(),
            self._check_embedding_service(),
        ]

        # Run all checks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle exceptions (shouldn't happen with proper exception handling in check methods)
        for result in results:
            if isinstance(result, Exception):
                # Create a failed result for unexpected errors
                self.results.append(
                    CheckResult(
                        id="unknown",
                        name="Unknown Check",
                        category="internal_service",
                        healthy=False,
                        latency_ms=0,
                        error=f"Check failed with exception: {str(result)}",
                    )
                )
            else:
                self.results.append(result)

        return self.results

    async def _check_database(self) -> CheckResult:
        """Check Supabase database connectivity."""
        start = time.monotonic()
        try:
            db = await get_db()
            # Simple health check query
            result = await db.table("ai_model_families").select("id").limit(1).execute()
            latency_ms = int((time.monotonic() - start) * 1000)

            return CheckResult(
                id="supabase-db",
                name="Supabase Database",
                category="database",
                healthy=True,
                latency_ms=latency_ms,
                details={"query": "SELECT id FROM ai_model_families LIMIT 1"},
            )
        except Exception as exc:
            latency_ms = int((time.monotonic() - start) * 1000)
            return CheckResult(
                id="supabase-db",
                name="Supabase Database",
                category="database",
                healthy=False,
                latency_ms=latency_ms,
                error=f"Database connection failed: {str(exc)}",
                details={"error_type": type(exc).__name__},
            )

    def _check_ai_models(self) -> list[asyncio.Task[CheckResult]]:
        """Create tasks to check all configured AI models."""
        # We'll create async tasks for each model check
        # Actual checking happens in run_all_checks
        return [self._check_single_model_task()]

    async def _check_single_model_task(self) -> CheckResult:
        """Placeholder - actual model checks are done in _check_all_models."""
        # This is handled specially in run_all_checks
        return CheckResult(id="placeholder", name="Placeholder", category="ai_model", healthy=True, latency_ms=0)

    async def _check_all_models(self) -> list[CheckResult]:
        """Check all enabled AI models from the catalog."""
        results = []
        try:
            catalog = await _load_catalog_rows()
            enabled_skus = [sku for sku in catalog if sku.is_enabled]

            # Create tasks for each model
            tasks = []
            for sku in enabled_skus:
                if is_provider_configured(sku.provider):
                    tasks.append(self._check_single_model(sku))

            # Run model checks with concurrency limit
            if tasks:
                semaphore = asyncio.Semaphore(5)  # Max 5 concurrent model checks

                async def bounded_check(check_fn):
                    async with semaphore:
                        return await check_fn

                model_results = await asyncio.gather(
                    *[bounded_check(task) for task in tasks],
                    return_exceptions=True,
                )

                for result in model_results:
                    if isinstance(result, Exception):
                        results.append(
                            CheckResult(
                                id="model-unknown",
                                name="Unknown Model",
                                category="ai_model",
                                healthy=False,
                                latency_ms=0,
                                error=f"Model check failed: {str(result)}",
                            )
                        )
                    else:
                        results.append(result)

        except Exception as exc:
            results.append(
                CheckResult(
                    id="ai-catalog",
                    name="AI Catalog Service",
                    category="internal_service",
                    healthy=False,
                    latency_ms=0,
                    error=f"Failed to load AI catalog: {str(exc)}",
                )
            )

        return results

    async def _check_single_model(self, sku) -> CheckResult:
        """Check a single AI model by making a minimal completion request."""
        start = time.monotonic()
        model_id = f"{sku.provider}-{sku.model_id}"

        try:
            if not is_provider_configured(sku.provider):
                return CheckResult(
                    id=model_id,
                    name=f"{sku.display_name} ({sku.provider})",
                    category="ai_model",
                    healthy=False,
                    latency_ms=0,
                    error=f"Provider '{sku.provider}' is not configured (missing API key or base URL)",
                    details={"sku_id": sku.sku_id, "provider": sku.provider, "model_id": sku.model_id},
                )

            client = get_client(sku.provider)

            # Make a minimal completion request
            response = await client.chat.completions.create(
                model=sku.model_id,
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=1,
                timeout=10,
            )

            latency_ms = int((time.monotonic() - start) * 1000)

            return CheckResult(
                id=model_id,
                name=f"{sku.display_name} ({sku.provider})",
                category="ai_model",
                healthy=True,
                latency_ms=latency_ms,
                details={
                    "sku_id": sku.sku_id,
                    "provider": sku.provider,
                    "model_id": sku.model_id,
                    "response_received": True,
                },
            )

        except Exception as exc:
            latency_ms = int((time.monotonic() - start) * 1000)
            error_msg = str(exc)
            # Sanitize error message - remove API keys if present
            if "api_key" in error_msg.lower() or "apikey" in error_msg.lower():
                error_msg = "Authentication failed - API key may be invalid or expired"

            return CheckResult(
                id=model_id,
                name=f"{sku.display_name} ({sku.provider})",
                category="ai_model",
                healthy=False,
                latency_ms=latency_ms,
                error=error_msg,
                details={
                    "sku_id": sku.sku_id,
                    "provider": sku.provider,
                    "model_id": sku.model_id,
                    "error_type": type(exc).__name__,
                },
            )

    def _check_agents(self) -> list[asyncio.Task[CheckResult]]:
        """Create tasks to check all registered agents."""
        return [self._check_single_agent_task()]

    async def _check_single_agent_task(self) -> CheckResult:
        """Placeholder - actual agent checks are done in _check_all_agents."""
        return CheckResult(id="placeholder", name="Placeholder", category="agent", healthy=True, latency_ms=0)

    async def _check_all_agents(self) -> list[CheckResult]:
        """Check all enabled agents from agents.yaml."""
        results = []

        try:
            from pathlib import Path

            config_path = Path(__file__).resolve().parent.parent / "config" / "agents.yaml"
            registry = AgentRegistry(config_path)
            agents = registry.list_enabled()

            if not agents:
                return results

            # Check each agent's health endpoint
            tasks = []
            for agent in agents:
                tasks.append(self._check_single_agent(agent))

            agent_results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in agent_results:
                if isinstance(result, Exception):
                    results.append(
                        CheckResult(
                            id="agent-unknown",
                            name="Unknown Agent",
                            category="agent",
                            healthy=False,
                            latency_ms=0,
                            error=f"Agent check failed: {str(result)}",
                        )
                    )
                else:
                    results.append(result)

        except Exception as exc:
            results.append(
                CheckResult(
                    id="agent-registry",
                    name="Agent Registry",
                    category="internal_service",
                    healthy=False,
                    latency_ms=0,
                    error=f"Failed to load agent registry: {str(exc)}",
                )
            )

        return results

    async def _check_single_agent(self, agent) -> CheckResult:
        """Check a single agent by calling its health endpoint."""
        start = time.monotonic()

        try:
            timeout = 5  # 5 second timeout for agent health checks

            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(f"{agent.url}/health/ready")

            latency_ms = int((time.monotonic() - start) * 1000)

            if resp.status_code == 200:
                return CheckResult(
                    id=f"agent-{agent.name}",
                    name=agent.name,
                    category="agent",
                    healthy=True,
                    latency_ms=latency_ms,
                    details={
                        "url": agent.url,
                        "description": agent.description,
                        "models": agent.models,
                        "status_code": resp.status_code,
                    },
                )
            else:
                return CheckResult(
                    id=f"agent-{agent.name}",
                    name=agent.name,
                    category="agent",
                    healthy=False,
                    latency_ms=latency_ms,
                    error=f"Health check returned status {resp.status_code}: {resp.text[:200]}",
                    details={
                        "url": agent.url,
                        "status_code": resp.status_code,
                        "response": resp.text[:500],
                    },
                )

        except httpx.TimeoutException:
            latency_ms = int((time.monotonic() - start) * 1000)
            return CheckResult(
                id=f"agent-{agent.name}",
                name=agent.name,
                category="agent",
                healthy=False,
                latency_ms=latency_ms,
                error=f"Connection timeout after 5000ms - Agent may be down or unreachable",
                details={"url": agent.url, "timeout_seconds": 5},
            )

        except Exception as exc:
            latency_ms = int((time.monotonic() - start) * 1000)
            return CheckResult(
                id=f"agent-{agent.name}",
                name=agent.name,
                category="agent",
                healthy=False,
                latency_ms=latency_ms,
                error=f"Connection failed: {str(exc)}",
                details={"url": agent.url, "error_type": type(exc).__name__},
            )

    async def _check_embedding_service(self) -> CheckResult:
        """Check if embedding service is available."""
        start = time.monotonic()

        try:
            # Check if embedding service is configured
            config = get_config()
            embedding_config = config.get("embedding", {})

            if not embedding_config:
                return CheckResult(
                    id="embedding-service",
                    name="Embedding Service",
                    category="internal_service",
                    healthy=True,
                    latency_ms=0,
                    details={"note": "No embedding service configured"},
                )

            # Try to import and check the service
            try:
                from app.services.embedding_service import get_embedding

                latency_ms = int((time.monotonic() - start) * 1000)
                return CheckResult(
                    id="embedding-service",
                    name="Embedding Service",
                    category="internal_service",
                    healthy=True,
                    latency_ms=latency_ms,
                    details={"configured": True, "provider": embedding_config.get("provider", "unknown")},
                )
            except Exception as exc:
                latency_ms = int((time.monotonic() - start) * 1000)
                return CheckResult(
                    id="embedding-service",
                    name="Embedding Service",
                    category="internal_service",
                    healthy=False,
                    latency_ms=latency_ms,
                    error=f"Embedding service initialization failed: {str(exc)}",
                )

        except Exception as exc:
            latency_ms = int((time.monotonic() - start) * 1000)
            return CheckResult(
                id="embedding-service",
                name="Embedding Service",
                category="internal_service",
                healthy=False,
                latency_ms=latency_ms,
                error=f"Embedding service check failed: {str(exc)}",
            )


def _generate_reports(results: list[CheckResult]) -> DiagnosticsReport:
    """Generate report in multiple formats."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # Build summary
    total = len(results)
    healthy = sum(1 for r in results if r.healthy)
    unhealthy = total - healthy
    overall = "✅ Healthy" if unhealthy == 0 else "❌ Unhealthy"

    # Markdown report
    md_lines = [
        "# System Diagnostics Report",
        "",
        f"**Generated:** {timestamp}",
        f"**Overall Status:** {overall}",
        f"**Summary:** {healthy}/{total} components healthy ({unhealthy} unhealthy)",
        "",
        "## Component Status",
        "",
        "| Component | Category | Status | Latency | Error |",
        "|-----------|----------|--------|---------|-------|",
    ]

    for r in results:
        status = "✅ Healthy" if r.healthy else "❌ Unhealthy"
        error = r.error[:50] + "..." if r.error and len(r.error) > 50 else (r.error or "")
        md_lines.append(f"| {r.name} | {r.category} | {status} | {r.latency_ms}ms | {error} |")

    if unhealthy > 0:
        md_lines.extend(["", "## Errors"])
        for r in results:
            if not r.healthy:
                md_lines.extend(["", f"### {r.name}", "", f"**Error:** {r.error}", ""])
                if r.details:
                    md_lines.append(f"**Details:** `{json.dumps(r.details, default=str)}`")

    # Text report
    text_lines = [
        "System Diagnostics Report",
        "=" * 50,
        "",
        f"Generated: {timestamp}",
        f"Overall Status: {overall}",
        f"Summary: {healthy}/{total} healthy, {unhealthy} unhealthy",
        "",
        "Components:",
        "-" * 50,
    ]

    for r in results:
        status = "OK" if r.healthy else "FAIL"
        text_lines.append(f"[{status}] {r.name} ({r.category}) - {r.latency_ms}ms")
        if r.error:
            text_lines.append(f"      Error: {r.error}")

    # JSON report
    json_data = {
        "timestamp": timestamp,
        "overall_healthy": unhealthy == 0,
        "summary": {"total": total, "healthy": healthy, "unhealthy": unhealthy},
        "components": [
            {
                "id": r.id,
                "name": r.name,
                "category": r.category,
                "healthy": r.healthy,
                "latency_ms": r.latency_ms,
                "error": r.error,
                "details": r.details,
            }
            for r in results
        ],
    }

    return DiagnosticsReport(
        markdown="\n".join(md_lines),
        text="\n".join(text_lines),
        json=json.dumps(json_data, indent=2, ensure_ascii=False),
    )


@router.get("/diagnostics/full", response_model=DiagnosticsResponse)
async def run_full_diagnostics(
    _admin: dict = Depends(get_current_admin),
) -> DiagnosticsResponse:
    """Run comprehensive system diagnostics and return full report.

    Requires admin authentication. Tests all system components including:
    - Database connectivity
    - AI model providers
    - Sub-agents
    - Internal services
    """
    runner = DiagnosticsRunner()

    # Run all checks
    all_results = await runner.run_all_checks()

    # Run model checks (special handling)
    model_results = await runner._check_all_models()

    # Run agent checks (special handling)
    agent_results = await runner._check_all_agents()

    # Combine all results (filter out placeholder results)
    combined_results = []
    for r in all_results:
        if not r.id.startswith("placeholder"):
            combined_results.append(r)
    combined_results.extend(model_results)
    combined_results.extend(agent_results)

    # Generate reports
    reports = _generate_reports(combined_results)

    # Calculate overall health
    unhealthy_count = sum(1 for r in combined_results if not r.healthy)

    return DiagnosticsResponse(
        timestamp=datetime.now(timezone.utc).isoformat(),
        overall_healthy=unhealthy_count == 0,
        summary={
            "total": len(combined_results),
            "healthy": len(combined_results) - unhealthy_count,
            "unhealthy": unhealthy_count,
        },
        components=[
            ComponentStatus(
                id=r.id,
                name=r.name,
                category=r.category,
                status="healthy" if r.healthy else "unhealthy",
                latency_ms=r.latency_ms,
                error=r.error,
                details=r.details,
            )
            for r in combined_results
        ],
        reports=reports,
    )

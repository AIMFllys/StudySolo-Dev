"""Async HTTP client used by all CLI commands."""

from __future__ import annotations

import json
from typing import Any

import httpx

from studysolo_cli.config import CliConfig


class ApiError(RuntimeError):
    """Normalised API error raised by :class:`ApiClient`."""

    def __init__(self, status: int, message: str, *, detail: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
        self.detail = detail


class ApiClient:
    """Tiny wrapper around ``httpx.AsyncClient`` for JSON REST calls."""

    def __init__(self, config: CliConfig, *, timeout: float = 30.0) -> None:
        self._config = config
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self._config.token:
            headers["Authorization"] = f"Bearer {self._config.token}"
        return headers

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_body: Any = None,
        timeout: float | None = None,
    ) -> Any:
        url = f"{self._config.api_base}{path}"
        async with httpx.AsyncClient(timeout=timeout or self._timeout) as client:
            response = await client.request(
                method,
                url,
                params=params,
                json=json_body,
                headers=self._headers(),
            )
        return _parse_response(response)

    async def get(self, path: str, *, params: dict[str, Any] | None = None) -> Any:
        return await self._request("GET", path, params=params)

    async def post(self, path: str, *, json_body: Any = None) -> Any:
        return await self._request("POST", path, json_body=json_body)

    async def delete(self, path: str) -> Any:
        return await self._request("DELETE", path)


def _parse_response(response: httpx.Response) -> Any:
    if response.status_code >= 400:
        detail: Any
        try:
            detail = response.json()
        except json.JSONDecodeError:
            detail = response.text
        message = (
            (detail.get("detail") if isinstance(detail, dict) else None)
            or (detail.get("message") if isinstance(detail, dict) else None)
            or f"HTTP {response.status_code}"
        )
        if isinstance(message, dict):
            message = message.get("message") or json.dumps(message, ensure_ascii=False)
        raise ApiError(response.status_code, str(message), detail=detail)

    if not response.content:
        return None
    try:
        return response.json()
    except json.JSONDecodeError:
        return response.text

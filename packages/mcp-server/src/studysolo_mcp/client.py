"""Async HTTP client shared by all MCP tools."""

from __future__ import annotations

import json
from typing import Any

import httpx

from studysolo_mcp.config import ServerConfig


class ApiError(RuntimeError):
    """Normalised API error raised by :class:`ApiClient`."""

    def __init__(self, status: int, message: str, *, detail: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
        self.detail = detail

    def to_tool_payload(self) -> dict[str, Any]:
        return {
            "error": {
                "code": f"HTTP_{self.status}",
                "status": self.status,
                "message": self.message,
                "detail": self.detail,
            }
        }


class ApiClient:
    def __init__(self, config: ServerConfig, *, timeout: float = 30.0) -> None:
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
        if not self._config.token:
            raise ApiError(
                401,
                "未配置 STUDYSOLO_TOKEN。请在 MCP Host 的 env 中填入 PAT（sk_studysolo_...）。",
            )
        url = f"{self._config.api_base}{path}"
        async with httpx.AsyncClient(timeout=timeout or self._timeout) as http:
            response = await http.request(
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


def _parse_response(response: httpx.Response) -> Any:
    if response.status_code >= 400:
        detail: Any
        try:
            detail = response.json()
        except json.JSONDecodeError:
            detail = response.text
        message = _extract_message(detail) or f"HTTP {response.status_code}"
        raise ApiError(response.status_code, str(message), detail=detail)
    if not response.content:
        return None
    try:
        return response.json()
    except json.JSONDecodeError:
        return response.text


def _extract_message(detail: Any) -> str | None:
    if isinstance(detail, str):
        return detail
    if isinstance(detail, dict):
        for key in ("message", "detail"):
            value = detail.get(key)
            if isinstance(value, str):
                return value
            if isinstance(value, dict):
                nested = value.get("message")
                if isinstance(nested, str):
                    return nested
    return None

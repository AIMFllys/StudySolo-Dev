import os
import sys
import asyncio
from pathlib import Path

import httpx
import pytest

AGENT_ROOT = Path(__file__).resolve().parents[1]
if str(AGENT_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENT_ROOT))

os.environ.setdefault("AGENT_API_KEY", "test-agent-key")

from src.config import get_settings  # noqa: E402
from src.main import create_app  # noqa: E402


class SyncASGIClient:
    def __init__(self, app):
        self.app = app

    async def _request(self, method: str, path: str, **kwargs):
        transport = httpx.ASGITransport(app=self.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            async with client.stream(method, path, **kwargs) as response:
                await response.aread()
                return response

    def get(self, path: str, **kwargs):
        return asyncio.run(self._request("GET", path, **kwargs))

    def post(self, path: str, **kwargs):
        return asyncio.run(self._request("POST", path, **kwargs))


@pytest.fixture(scope="session")
def settings():
    get_settings.cache_clear()
    return get_settings()


@pytest.fixture()
def client(settings):
    yield SyncASGIClient(create_app())

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

AGENT_ROOT = Path(__file__).resolve().parents[1]
if str(AGENT_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENT_ROOT))

os.environ.setdefault("AGENT_API_KEY", "test-agent-key")

from src.config import get_settings  # noqa: E402
from src.main import create_app  # noqa: E402


@pytest.fixture(scope="session")
def settings():
    get_settings.cache_clear()
    return get_settings()


@pytest.fixture()
def client(settings):
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def patch_news_pipeline(monkeypatch):
    class DummyReport:
        def to_dict(self):
            return {}

    monkeypatch.setattr("src.core.news.api_chat.execute_research", lambda **_: DummyReport())
    monkeypatch.setattr("src.core.news.app.execute_research", lambda **_: DummyReport())
    monkeypatch.setattr("src.core.news.api_chat.render.render_compact", lambda _: "stub news report")
    monkeypatch.setattr("src.core.news.app.render.render_compact", lambda _: "stub news report")

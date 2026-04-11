from fastapi.testclient import TestClient

from app.main import app
from app.middleware import auth as auth_middleware
from tests._helpers import TEST_JWT_SECRET, make_bearer_headers


EXPECTED_RENDERERS = {
    "outline_gen": "OutlineRenderer",
    "flashcard": "FlashcardRenderer",
    "compare": "CompareRenderer",
    "mind_map": "MindMapRenderer",
    "quiz_gen": "QuizRenderer",
    "community_node": "CommunityNodeRenderer",
}

EXPECTED_TYPES = {
    "trigger_input",
    "ai_analyzer",
    "ai_planner",
    "outline_gen",
    "content_extract",
    "summary",
    "flashcard",
    "chat_response",
    "compare",
    "mind_map",
    "quiz_gen",
    "merge_polish",
    "knowledge_base",
    "web_search",
    "export_file",
    "write_db",
    "logic_switch",
    "loop_map",
    "loop_group",
    "community_node",
}


def _install_auth_stub(monkeypatch):
    async def fake_get_db():
        class _User:
            id = "user-1"
            email = "user-1@example.com"

        class _Response:
            user = _User()

        class _Auth:
            async def get_user(self, _token: str):
                return _Response()

        class _Db:
            auth = _Auth()

        return _Db()

    monkeypatch.setattr(auth_middleware, "get_db", fake_get_db)
    return make_bearer_headers("user-1", email="user-1@example.com", secret=TEST_JWT_SECRET)


def test_node_manifest_route_exposes_frozen_contract_fields(monkeypatch):
    client = TestClient(app, raise_server_exceptions=False)
    headers = _install_auth_stub(monkeypatch)

    response = client.get("/api/nodes/manifest", headers=headers)

    assert response.status_code == 200, response.text
    payload = response.json()
    manifest_by_type = {item["type"]: item for item in payload}

    assert EXPECTED_TYPES.issubset(manifest_by_type)

    for node_type, item in manifest_by_type.items():
        assert item["type"] == node_type
        assert isinstance(item["category"], str) and item["category"]
        assert isinstance(item["display_name"], str) and item["display_name"]
        assert isinstance(item["description"], str) and item["description"]
        assert isinstance(item["icon"], str) and item["icon"]
        assert isinstance(item["color"], str) and item["color"]
        assert isinstance(item["is_llm_node"], bool)
        assert isinstance(item["output_format"], str) and item["output_format"]
        assert isinstance(item["config_schema"], list)
        assert isinstance(item["output_capabilities"], list)
        assert isinstance(item["supports_upload"], bool)
        assert isinstance(item["supports_preview"], bool)
        assert item["deprecated_surface"] is None or isinstance(item["deprecated_surface"], str)
        assert item["renderer"] == EXPECTED_RENDERERS.get(node_type)
        assert item["version"] == "1.0.0"


def test_node_manifest_route_keeps_known_display_name_mappings_stable(monkeypatch):
    client = TestClient(app, raise_server_exceptions=False)
    headers = _install_auth_stub(monkeypatch)

    response = client.get("/api/nodes/manifest", headers=headers)

    assert response.status_code == 200, response.text
    manifest_by_type = {item["type"]: item for item in response.json()}

    assert manifest_by_type["trigger_input"]["display_name"] == "用户输入"
    assert manifest_by_type["ai_analyzer"]["display_name"] == "需求分析"
    assert manifest_by_type["ai_planner"]["display_name"] == "工作流规划"
    assert manifest_by_type["summary"]["display_name"] == "总结归纳"
    assert manifest_by_type["loop_group"]["display_name"] == "循环块"
    assert manifest_by_type["community_node"]["display_name"] == "社区共享节点"

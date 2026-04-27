"""Property tests for Pydantic models — user, knowledge, ai_catalog, workflow."""

import pytest
from pydantic import ValidationError

from app.models.user import (
    UserRegister, UserLogin, UserInfo, SendCodeRequest,
    ConsentUpdate, CURRENT_TOS_VERSION, CURRENT_PRIVACY_VERSION,
)
from app.models.knowledge import QueryRequest, QueryResult, QueryResponse, DocumentMeta
from app.models.ai_catalog import CatalogSku, AdminCatalogUpdateRequest
from app.models.workflow import (
    WorkflowCreate, WorkflowUpdate, WorkflowMeta, WorkflowExecuteRequest,
)


class TestUserModels:
    def test_register_valid(self):
        u = UserRegister(
            email="a@b.com", password="pass123",
            verification_code="123456",
            agreed_to_terms=True, agreed_to_privacy=True,
        )
        assert u.email == "a@b.com"

    def test_register_invalid_email(self):
        with pytest.raises(ValidationError):
            UserRegister(
                email="not-email", password="p",
                verification_code="123456",
                agreed_to_terms=True, agreed_to_privacy=True,
            )

    def test_login_defaults(self):
        u = UserLogin(email="a@b.com", password="p")
        assert u.remember_me is True

    def test_user_info_defaults(self):
        u = UserInfo(id="1", email="a@b.com")
        assert u.role == "user"
        assert u.tier == "free"

    def test_send_code_default_type(self):
        s = SendCodeRequest(email="a@b.com", captcha_token="tok")
        assert s.code_type == "register"

    def test_consent_all_none(self):
        c = ConsentUpdate()
        assert c.cookie_consent_level is None

    def test_tos_version_exists(self):
        assert CURRENT_TOS_VERSION
        assert CURRENT_PRIVACY_VERSION


class TestKnowledgeModels:
    def test_query_request_defaults(self):
        q = QueryRequest(query="test")
        assert q.top_k == 5
        assert q.threshold == 0.7

    def test_query_result(self):
        r = QueryResult(content="text", similarity=0.9, document_id="d1")
        assert r.similarity == 0.9

    def test_query_response(self):
        r = QueryResponse(results=[], context="ctx")
        assert r.context == "ctx"

    def test_document_meta(self):
        d = DocumentMeta(
            id="d1", filename="test.pdf", file_type="pdf",
            file_size_bytes=1024, status="ready",
            total_chunks=10, total_tokens=500,
        )
        assert d.total_chunks == 10


class TestCatalogModels:
    def test_catalog_sku_defaults(self):
        sku = CatalogSku(
            sku_id="s1", family_id="f1", family_name="F",
            provider="openai", vendor="openai", model_id="gpt-4",
            display_name="GPT-4", billing_channel="native",
            task_family="chat", routing_policy="native_first",
        )
        assert sku.required_tier == "free"
        assert sku.is_enabled is True
        assert sku.supports_thinking is False

    def test_catalog_sku_invalid_tier(self):
        with pytest.raises(ValidationError):
            CatalogSku(
                sku_id="s1", family_id="f1", family_name="F",
                provider="p", vendor="v", model_id="m",
                display_name="D", billing_channel="native",
                task_family="chat", routing_policy="native_first",
                required_tier="invalid_tier",
            )

    def test_admin_update_all_none(self):
        u = AdminCatalogUpdateRequest()
        assert u.display_name is None
        assert u.is_enabled is None


class TestWorkflowModels:
    def test_create_minimal(self):
        w = WorkflowCreate(name="Test")
        assert w.description is None

    def test_update_partial(self):
        w = WorkflowUpdate(name="New Name")
        assert w.nodes_json is None

    def test_execute_request(self):
        w = WorkflowExecuteRequest(nodes_json=[{"id": "n1"}], edges_json=[])
        assert len(w.nodes_json) == 1

    def test_meta_select_cols(self):
        cols = WorkflowMeta.select_cols()
        assert "id" in cols
        assert "name" in cols
        assert "owner_name" not in cols
        assert "is_liked" not in cols

    def test_meta_select_cols_no_virtual(self):
        cols_set = set(WorkflowMeta.select_cols().split(","))
        assert "is_favorited" not in cols_set

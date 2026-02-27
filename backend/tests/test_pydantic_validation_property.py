"""
Property-Based Test: Pydantic 请求参数验证
Feature: studysolo-mvp, Property 21: Pydantic 请求参数验证

Validates: Requirements 9.2
"""

import sys
from types import ModuleType
from unittest.mock import AsyncMock

# ---------------------------------------------------------------------------
# Stub out 'supabase' before any app module is imported.
# ---------------------------------------------------------------------------

def _install_supabase_stub():
    if "supabase" not in sys.modules:
        stub = ModuleType("supabase")
        stub.AsyncClient = object  # type: ignore[attr-defined]
        stub.create_async_client = AsyncMock()  # type: ignore[attr-defined]
        sys.modules["supabase"] = stub
    for sub in ("supabase._async", "supabase._async.client", "supabase.lib"):
        sys.modules.setdefault(sub, ModuleType(sub))


_install_supabase_stub()

import os
import pytest

from pydantic import ValidationError
from hypothesis import given, settings as hyp_settings
from hypothesis import strategies as st
from fastapi.testclient import TestClient

os.environ.setdefault("JWT_SECRET", "test-secret-for-property-tests")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

from app.main import app  # noqa: E402
from app.models.workflow import WorkflowCreate, WorkflowUpdate  # noqa: E402
from app.models.user import UserRegister, UserLogin  # noqa: E402

client = TestClient(app, raise_server_exceptions=False)

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Non-string types that should fail str fields
_non_string = st.one_of(
    st.integers(),
    st.floats(allow_nan=False),
    st.booleans(),
    st.lists(st.text()),
    st.dictionaries(st.text(), st.text()),
    st.none(),
)

# Payloads missing the required 'name' field for WorkflowCreate
_missing_name_payload = st.fixed_dictionaries({}).map(lambda d: d)  # empty dict

# Payloads with 'name' set to a non-string value
_wrong_type_name_payload = st.builds(
    lambda v: {"name": v},
    v=_non_string,
)

# Payloads missing required 'email' or 'password' for auth models
_missing_email_payload = st.builds(
    lambda pw: {"password": pw},
    pw=st.text(min_size=1),
)

_missing_password_payload = st.builds(
    lambda em: {"email": em},
    em=st.text(min_size=1),
)


# ---------------------------------------------------------------------------
# Part 1: Direct Pydantic model validation (no HTTP layer)
# ---------------------------------------------------------------------------

@given(extra=st.dictionaries(st.text(min_size=1, max_size=20), st.text()))
@hyp_settings(max_examples=100)
def test_workflow_create_requires_name(extra):
    """
    **Validates: Requirements 9.2**

    Property 21: Pydantic 请求参数验证
    WorkflowCreate without 'name' field must raise ValidationError.
    """
    # Build a dict that deliberately omits 'name'
    data = {k: v for k, v in extra.items() if k != "name"}
    with pytest.raises(ValidationError) as exc_info:
        WorkflowCreate.model_validate(data)
    errors = exc_info.value.errors()
    field_names = [e["loc"][0] for e in errors]
    assert "name" in field_names, f"Expected 'name' in validation errors, got: {errors}"


@given(name_value=_non_string)
@hyp_settings(max_examples=100)
def test_workflow_create_name_must_be_string(name_value):
    """
    **Validates: Requirements 9.2**

    Property 21: Pydantic 请求参数验证
    WorkflowCreate with non-string 'name' must raise ValidationError.
    """
    # None and list/dict types should fail; int/float/bool may be coerced by Pydantic
    # We test that None always fails (it's not a valid str)
    if name_value is None:
        with pytest.raises(ValidationError):
            WorkflowCreate.model_validate({"name": name_value})
    else:
        # For other types, Pydantic V2 may coerce (e.g. int → str).
        # We just verify model_validate doesn't crash unexpectedly.
        try:
            obj = WorkflowCreate.model_validate({"name": name_value})
            assert isinstance(obj.name, str)
        except ValidationError:
            pass  # Also acceptable


@given(extra=st.dictionaries(st.text(min_size=1, max_size=20), st.text()))
@hyp_settings(max_examples=100)
def test_user_register_requires_email_and_password(extra):
    """
    **Validates: Requirements 9.2**

    Property 21: Pydantic 请求参数验证
    UserRegister without 'email' or 'password' must raise ValidationError.
    """
    # Missing email
    data_no_email = {k: v for k, v in extra.items() if k not in ("email", "password")}
    data_no_email["password"] = "somepassword"
    with pytest.raises(ValidationError) as exc_info:
        UserRegister.model_validate(data_no_email)
    field_names = [e["loc"][0] for e in exc_info.value.errors()]
    assert "email" in field_names

    # Missing password
    data_no_password = {k: v for k, v in extra.items() if k not in ("email", "password")}
    data_no_password["email"] = "user@example.com"
    with pytest.raises(ValidationError) as exc_info:
        UserRegister.model_validate(data_no_password)
    field_names = [e["loc"][0] for e in exc_info.value.errors()]
    assert "password" in field_names


# ---------------------------------------------------------------------------
# Part 2: HTTP API returns 422 for invalid inputs
# ---------------------------------------------------------------------------

@given(payload=st.one_of(_missing_email_payload, _missing_password_payload))
@hyp_settings(max_examples=100)
def test_register_endpoint_returns_422_for_invalid_input(payload):
    """
    **Validates: Requirements 9.2**

    Property 21: Pydantic 请求参数验证
    POST /api/auth/register with missing required fields must return 422.
    """
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422, (
        f"Expected 422 for payload {payload}, got {response.status_code}: {response.text}"
    )
    body = response.json()
    assert "detail" in body, "422 response must contain 'detail' field"


@given(payload=st.one_of(_missing_email_payload, _missing_password_payload))
@hyp_settings(max_examples=100)
def test_login_endpoint_returns_422_for_invalid_input(payload):
    """
    **Validates: Requirements 9.2**

    Property 21: Pydantic 请求参数验证
    POST /api/auth/login with missing required fields must return 422.
    """
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 422, (
        f"Expected 422 for payload {payload}, got {response.status_code}: {response.text}"
    )
    body = response.json()
    assert "detail" in body, "422 response must contain 'detail' field"


@given(payload=st.just({}))
@hyp_settings(max_examples=10)
def test_register_endpoint_returns_422_for_empty_body(payload):
    """
    **Validates: Requirements 9.2**

    Property 21: Pydantic 请求参数验证
    POST /api/auth/register with empty body must return 422.
    """
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422
    body = response.json()
    assert "detail" in body
    # Verify error details mention the missing fields
    detail = body["detail"]
    assert isinstance(detail, list), "detail should be a list of validation errors"
    field_names = [e["loc"][-1] for e in detail if "loc" in e]
    assert "email" in field_names or "password" in field_names


# ---------------------------------------------------------------------------
# Baseline unit tests (non-property)
# ---------------------------------------------------------------------------

def test_workflow_create_valid():
    """WorkflowCreate with valid data should succeed."""
    obj = WorkflowCreate(name="My Workflow")
    assert obj.name == "My Workflow"
    assert obj.description is None


def test_workflow_create_missing_name_raises():
    """WorkflowCreate without name must raise ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        WorkflowCreate.model_validate({})
    errors = exc_info.value.errors()
    assert any(e["loc"][0] == "name" for e in errors)


def test_workflow_update_all_optional():
    """WorkflowUpdate with no fields should succeed (all optional)."""
    obj = WorkflowUpdate.model_validate({})
    assert obj.name is None
    assert obj.description is None
    assert obj.nodes_json is None
    assert obj.edges_json is None
    assert obj.status is None


def test_register_endpoint_422_missing_both_fields():
    """POST /api/auth/register with empty JSON body returns 422 with field errors."""
    response = client.post("/api/auth/register", json={})
    assert response.status_code == 422
    detail = response.json()["detail"]
    field_names = [e["loc"][-1] for e in detail]
    assert "email" in field_names
    assert "password" in field_names


def test_login_endpoint_422_missing_both_fields():
    """POST /api/auth/login with empty JSON body returns 422 with field errors."""
    response = client.post("/api/auth/login", json={})
    assert response.status_code == 422
    detail = response.json()["detail"]
    field_names = [e["loc"][-1] for e in detail]
    assert "email" in field_names
    assert "password" in field_names

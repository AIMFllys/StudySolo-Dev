"""Property tests for workflow_runs_service — StartRunError and pure helpers."""

from app.services.workflow_runs_service import StartRunError


class TestStartRunError:
    def test_default_code(self):
        err = StartRunError("msg")
        assert err.code == "start_run_failed"
        assert err.detail == {}
        assert str(err) == "msg"

    def test_custom_code_and_detail(self):
        err = StartRunError("quota", code="quota_exceeded", detail={"used": 10, "limit": 20})
        assert err.code == "quota_exceeded"
        assert err.detail["used"] == 10

    def test_is_exception(self):
        err = StartRunError("test")
        assert isinstance(err, Exception)

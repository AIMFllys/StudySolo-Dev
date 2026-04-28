"""Property tests for audit_logger — get_client_info and record building."""

from unittest.mock import MagicMock

from app.services.audit_logger import get_client_info


class TestGetClientInfo:
    def test_forwarded_for(self):
        req = MagicMock()
        req.headers = {"x-forwarded-for": "1.2.3.4, 5.6.7.8", "user-agent": "Mozilla"}
        ip, ua = get_client_info(req)
        assert ip == "1.2.3.4"
        assert ua == "Mozilla"

    def test_direct_client(self):
        req = MagicMock()
        req.headers = {}
        req.client.host = "10.0.0.1"
        ip, ua = get_client_info(req)
        assert ip == "10.0.0.1"
        assert ua is None

    def test_no_client(self):
        req = MagicMock()
        req.headers = {}
        req.client = None
        ip, ua = get_client_info(req)
        assert ip is None

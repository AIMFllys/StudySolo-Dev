"""Property tests for notice models — validation rules."""

from datetime import datetime, timezone, timedelta

import pytest
from pydantic import ValidationError

from app.models.notice import NoticeCreate, NoticeUpdate


class TestNoticeCreate:
    def test_valid(self):
        n = NoticeCreate(title="Test", content="Body", type="system")
        assert n.status == "draft"

    def test_empty_title_rejected(self):
        with pytest.raises(ValidationError, match="标题"):
            NoticeCreate(title="", content="Body", type="system")

    def test_long_title_rejected(self):
        with pytest.raises(ValidationError, match="200"):
            NoticeCreate(title="x" * 201, content="Body", type="system")

    def test_empty_content_rejected(self):
        with pytest.raises(ValidationError, match="内容"):
            NoticeCreate(title="T", content="", type="system")

    def test_long_content_rejected(self):
        with pytest.raises(ValidationError, match="10000"):
            NoticeCreate(title="T", content="x" * 10001, type="system")

    def test_past_expires_rejected(self):
        past = datetime(2020, 1, 1, tzinfo=timezone.utc)
        with pytest.raises(ValidationError, match="未来"):
            NoticeCreate(title="T", content="C", type="system", expires_at=past)

    def test_future_expires_accepted(self):
        future = datetime.now(timezone.utc) + timedelta(days=30)
        n = NoticeCreate(title="T", content="C", type="system", expires_at=future)
        assert n.expires_at is not None

    def test_invalid_type_rejected(self):
        with pytest.raises(ValidationError):
            NoticeCreate(title="T", content="C", type="invalid_type")

    def test_whitespace_title_stripped(self):
        n = NoticeCreate(title="  Hello  ", content="Body", type="feature")
        assert n.title == "Hello"


class TestNoticeUpdate:
    def test_all_none(self):
        n = NoticeUpdate()
        assert n.title is None

    def test_partial_update(self):
        n = NoticeUpdate(title="New Title")
        assert n.title == "New Title"
        assert n.content is None

    def test_empty_title_rejected(self):
        with pytest.raises(ValidationError, match="标题"):
            NoticeUpdate(title="   ")

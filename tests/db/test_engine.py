from __future__ import annotations

from datetime import datetime
from typing import ClassVar

import pytest
from sqlalchemy import text

from app.db import engine as engine_module


class _FakeSession:
    """Records whether close() was called."""

    instances: ClassVar[list[_FakeSession]] = []

    def __init__(self, _engine: object) -> None:
        self.closed = False
        _FakeSession.instances.append(self)

    def close(self) -> None:
        self.closed = True


@pytest.fixture(autouse=True)
def _reset_instances():
    _FakeSession.instances.clear()
    yield
    _FakeSession.instances.clear()


def test_stream_scoped_session_closes_on_normal_exit(monkeypatch) -> None:
    monkeypatch.setattr(engine_module, "Session", _FakeSession)

    with engine_module.stream_scoped_session() as session:
        assert isinstance(session, _FakeSession)
        assert session.closed is False

    assert _FakeSession.instances[0].closed is True


def test_stream_scoped_session_closes_on_exception(monkeypatch) -> None:
    monkeypatch.setattr(engine_module, "Session", _FakeSession)

    with pytest.raises(RuntimeError, match="boom"):
        with engine_module.stream_scoped_session():
            raise RuntimeError("boom")

    assert _FakeSession.instances[0].closed is True


def test_stream_scoped_session_does_not_commit_or_rollback(monkeypatch) -> None:
    """Ownership is transferred to the streaming generator; the scope only closes."""

    class _StrictSession(_FakeSession):
        def commit(self) -> None:  # pragma: no cover - must not be called
            raise AssertionError("stream_scoped_session must not commit")

        def rollback(self) -> None:  # pragma: no cover - must not be called
            raise AssertionError("stream_scoped_session must not rollback")

    monkeypatch.setattr(engine_module, "Session", _StrictSession)

    with engine_module.stream_scoped_session() as session:
        assert isinstance(session, _StrictSession)

    assert session.closed is True


def test_engine_sessions_are_pinned_to_utc() -> None:
    """App sessions always run with TimeZone=UTC, whatever the server default.

    Regression: our timestamp columns are TIMESTAMP WITHOUT TIME ZONE, and
    Postgres casts the timezone-aware datetimes we insert using the *session*
    timezone. On a server defaulting to local time (e.g. Homebrew Postgres),
    rows landed hours off from the UTC wall time every reader assumes, so
    "last updated" read hours behind reality.
    """
    with engine_module.engine.connect() as connection:
        zone = connection.execute(text("SHOW TimeZone")).scalar_one()
        assert zone == "UTC"
        stored = connection.execute(
            text("SELECT '2026-01-01 12:00:00+00'::timestamptz::timestamp")
        ).scalar_one()
        assert stored == datetime(2026, 1, 1, 12, 0, 0)

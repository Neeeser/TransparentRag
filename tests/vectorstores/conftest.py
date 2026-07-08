"""Fixtures for vector-store backend tests."""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlmodel import Session


@pytest.fixture(name="pgvector_session")
def pgvector_session_fixture(session: Session) -> Session:
    """The regular DB session, skipping the test when pgvector is missing.

    `tests/utils/db.reset_database` installs the extension best-effort; a
    Postgres server without pgvector available skips these tests with a named
    reason instead of failing the suite (see app/AGENTS.md).
    """
    installed = session.exec(  # type: ignore[call-overload]
        text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
    ).first()
    if not installed:
        pytest.skip("pgvector extension unavailable on the test Postgres server")
    return session

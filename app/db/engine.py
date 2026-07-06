"""Database engine and session management.

The module-level engine is a deliberate exception to the "no import-time side
effects" rule: a single process-wide `Engine` is created once at import time
and reused for the life of the process, matching SQLAlchemy's own guidance.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import cast

from sqlmodel import Session, create_engine

from app.core.config import get_settings

settings = get_settings()

database_url = cast(str, settings.database_url)
engine = create_engine(database_url, pool_pre_ping=True)


@contextmanager
def session_scope() -> Iterator[Session]:
    """Provide a transactional scope around a series of operations."""
    session = Session(engine)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_session() -> Iterator[Session]:
    """Yield a database session for dependency injection."""
    with session_scope() as session:
        yield session

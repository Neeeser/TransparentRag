"""Database session management and initialization."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator, cast

from sqlmodel import Session, SQLModel, create_engine

from app.api.config import get_settings

settings = get_settings()

database_url = cast(str, settings.database_url)
connect_args = (
    {"check_same_thread": False}
    if database_url.startswith("sqlite")  # pylint: disable=no-member
    else {}
)
engine = create_engine(database_url, connect_args=connect_args)


def init_db() -> None:
    """Initialize database schema metadata."""
    # Import inside to ensure models are registered before table creation.
    import app.db.models  # pylint: disable=import-outside-toplevel,unused-import

    SQLModel.metadata.create_all(engine)


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

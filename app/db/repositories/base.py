"""Shared repository base class and query-scoping helpers."""

from __future__ import annotations

from typing import Protocol, TypeVar
from uuid import UUID

from sqlmodel import Session, SQLModel, col
from sqlmodel.sql.expression import SelectOfScalar

ModelT = TypeVar("ModelT", bound=SQLModel)
RowT = TypeVar("RowT")


class SupportsUserScope(Protocol):
    """Structural type for table models that carry a user_id ownership column."""

    user_id: UUID


class Repository:
    """Session-owning base for all repositories."""

    def __init__(self, session: Session) -> None:
        """Initialize the repository with a database session."""
        self.session = session

    def _add(self, instance: ModelT) -> ModelT:
        """Persist an instance and return it after flushing."""
        self.session.add(instance)
        self.session.flush()
        return instance


def user_scoped(
    statement: SelectOfScalar[RowT],
    model: type[SupportsUserScope],
    user_id: UUID | None,
) -> SelectOfScalar[RowT]:
    """Narrow a statement to rows owned by user_id; a None user_id is a no-op."""
    if user_id:
        statement = statement.where(col(model.user_id) == user_id)
    return statement

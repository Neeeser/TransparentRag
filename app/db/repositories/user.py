"""Repository for user accounts."""

from __future__ import annotations

from uuid import UUID

from sqlmodel import select

from app.db import models
from app.db.repositories.base import Repository


class UserRepository(Repository):
    """Data access helpers for users."""

    def get_by_email(self, email: str) -> models.User | None:
        """Return a user by email if one exists."""
        statement = select(models.User).where(models.User.email == email)
        return self.session.exec(statement).first()

    def get(self, user_id: UUID) -> models.User | None:
        """Return a user by id if one exists."""
        return self.session.get(models.User, user_id)

    def list_all(self) -> list[models.User]:
        """Return every user (used by admin-style backfills)."""
        return list(self.session.exec(select(models.User)).all())

    def add(self, user: models.User) -> models.User:
        """Persist a new user and return it."""
        return self._add(user)

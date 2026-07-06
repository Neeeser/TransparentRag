"""Repository for query telemetry events."""

from __future__ import annotations

from uuid import UUID

from app.db import models
from app.db.repositories.base import Repository


class QueryRepository(Repository):
    """Data access helpers for query events."""

    def add_event(self, event: models.QueryEvent) -> models.QueryEvent:
        """Persist a query event and return it."""
        return self._add(event)

    def get_for_user(self, query_event_id: UUID, user_id: UUID) -> models.QueryEvent | None:
        """Return a query event only when it exists and is owned by the user."""
        event = self.session.get(models.QueryEvent, query_event_id)
        if not event or event.user_id != user_id:
            return None
        return event

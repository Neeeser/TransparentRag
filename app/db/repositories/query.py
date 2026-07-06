"""Repository for query telemetry events."""

from __future__ import annotations

from app.db import models
from app.db.repositories.base import Repository


class QueryRepository(Repository):  # pylint: disable=too-few-public-methods
    """Data access helpers for query events."""

    def add_event(self, event: models.QueryEvent) -> models.QueryEvent:
        """Persist a query event and return it."""
        return self._add(event)

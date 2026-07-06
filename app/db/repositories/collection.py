"""Repository for collections, including ownership-scoped lookups and stats."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, or_
from sqlmodel import col, select

from app.db import models
from app.db.repositories.base import Repository, user_scoped


@dataclass(frozen=True)
class CollectionStats:
    """Aggregated per-collection counters used by the stats endpoints."""

    document_count: int
    chunk_count: int
    average_latency_ms: float | None
    last_used_at: datetime | None


class CollectionRepository(Repository):
    """Data access helpers for collections."""

    def list_for_user(self, user_id: UUID) -> list[models.Collection]:
        """List collections belonging to a user."""
        statement = select(models.Collection).where(
            models.Collection.user_id == user_id,
        )
        return list(self.session.exec(statement).all())

    def list_by_ids(
        self,
        user_id: UUID,
        ids: Sequence[UUID],
    ) -> list[models.Collection]:
        """List a user's collections whose ids are in the given set."""
        if not ids:
            return []
        statement = select(models.Collection).where(
            col(models.Collection.user_id) == user_id,
            col(models.Collection.id).in_(ids),
        )
        return list(self.session.exec(statement).all())

    def get(
        self,
        collection_id: UUID,
        user_id: UUID | None = None,
    ) -> models.Collection | None:
        """Return a collection by id, optionally scoped to a user."""
        statement = select(models.Collection).where(models.Collection.id == collection_id)
        statement = user_scoped(statement, models.Collection, user_id)
        return self.session.exec(statement).first()

    def add(self, collection: models.Collection) -> models.Collection:
        """Persist a new collection and return it."""
        return self._add(collection)

    def references_pipeline(self, pipeline_id: UUID) -> bool:
        """Return True when any collection uses the pipeline for ingestion or retrieval."""
        statement = (
            select(col(models.Collection.id))
            .where(
                or_(
                    col(models.Collection.ingestion_pipeline_id) == pipeline_id,
                    col(models.Collection.retrieval_pipeline_id) == pipeline_id,
                )
            )
            .limit(1)
        )
        return self.session.exec(statement).first() is not None

    def stats_for(
        self,
        user_id: UUID,
        collection_ids: Sequence[UUID],
    ) -> dict[UUID, CollectionStats]:
        """Return aggregated stats keyed by collection id, one entry per requested id."""
        if not collection_ids:
            return {}
        doc_statement = (
            select(
                col(models.Document.collection_id),
                func.count(col(models.Document.id)),  # pylint: disable=not-callable
                func.coalesce(func.sum(col(models.Document.num_chunks)), 0),
            )
            .where(
                col(models.Document.user_id) == user_id,
                col(models.Document.collection_id).in_(collection_ids),
            )
            .group_by(col(models.Document.collection_id))
        )
        doc_rows = self.session.exec(doc_statement).all()
        doc_map = {row[0]: (int(row[1]), int(row[2])) for row in doc_rows}

        query_statement = (
            select(
                col(models.QueryEvent.collection_id),
                func.avg(col(models.QueryEvent.latency_ms)),
                func.max(col(models.QueryEvent.created_at)),
            )
            .where(
                col(models.QueryEvent.user_id) == user_id,
                col(models.QueryEvent.collection_id).in_(collection_ids),
            )
            .group_by(col(models.QueryEvent.collection_id))
        )
        query_rows = self.session.exec(query_statement).all()
        query_map = {row[0]: (row[1], row[2]) for row in query_rows}

        stats: dict[UUID, CollectionStats] = {}
        for collection_id in collection_ids:
            doc_count, chunk_count = doc_map.get(collection_id, (0, 0))
            avg_latency, last_used = query_map.get(collection_id, (None, None))
            stats[collection_id] = CollectionStats(
                document_count=doc_count,
                chunk_count=chunk_count,
                average_latency_ms=float(avg_latency) if avg_latency is not None else None,
                last_used_at=last_used,
            )
        return stats

"""Repository for collections, including ownership-scoped lookups and stats."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import ColumnElement, SQLColumnExpression, func, or_
from sqlalchemy import delete as sa_delete
from sqlalchemy import select as sa_select
from sqlalchemy import update as sa_update
from sqlmodel import col, select

from app.db import models
from app.db.repositories.base import Repository, user_scoped
from app.schemas.enums import StatsHistoryRange


@dataclass(frozen=True)
class LatencyBucketStats:
    """Latency aggregates for one flow (ingestion or retrieval) in one bucket."""

    count: int = 0
    avg_ms: float | None = None
    p50_ms: float | None = None
    p95_ms: float | None = None
    max_ms: float | None = None


@dataclass(frozen=True)
class CollectionHistoryBucket:
    """One bucket: cumulative document/chunk totals plus latency stats."""

    bucket_start: datetime
    document_total: int
    chunk_total: int
    ingestion: LatencyBucketStats
    retrieval: LatencyBucketStats


@dataclass(frozen=True)
class HistoryWindow:
    """A trailing history window: how many buckets, at which granularity."""

    buckets: int
    step: timedelta
    trunc: Literal["hour", "day"]

    def start_for(self, now: datetime) -> datetime:
        """Start of the oldest bucket, aligned to the granularity.

        Returns a naive UTC datetime: timestamp columns are naive UTC, and
        `date_trunc` bucket keys must compare equal to the ones built here.
        """
        if now.tzinfo is not None:
            now = now.astimezone(UTC).replace(tzinfo=None)
        latest = now.replace(minute=0, second=0, microsecond=0)
        if self.trunc == "day":
            latest = latest.replace(hour=0)
        return latest - self.step * (self.buckets - 1)


HISTORY_WINDOWS: dict[StatsHistoryRange, HistoryWindow] = {
    StatsHistoryRange.HOURS_4: HistoryWindow(4, timedelta(hours=1), "hour"),
    StatsHistoryRange.HOURS_24: HistoryWindow(24, timedelta(hours=1), "hour"),
    StatsHistoryRange.DAYS_7: HistoryWindow(7, timedelta(days=1), "day"),
    StatsHistoryRange.DAYS_30: HistoryWindow(30, timedelta(days=1), "day"),
}


@dataclass(frozen=True)
class CollectionStats:
    """Aggregated per-collection counters used by the stats endpoints."""

    document_count: int
    chunk_count: int
    average_latency_ms: float | None
    last_used_at: datetime | None


def _merge_history_buckets(
    window: HistoryWindow,
    start: datetime,
    baseline: tuple[int, int],
    docs_by_bucket: dict[datetime, tuple[int, int]],
    ingestion_by_bucket: dict[datetime, LatencyBucketStats],
    retrieval_by_bucket: dict[datetime, LatencyBucketStats],
) -> list[CollectionHistoryBucket]:
    """Fold per-bucket additions into a continuous cumulative series."""
    doc_total, chunk_total = baseline
    points: list[CollectionHistoryBucket] = []
    for offset in range(window.buckets):
        bucket = start + window.step * offset
        added_docs, added_chunks = docs_by_bucket.get(bucket, (0, 0))
        doc_total += added_docs
        chunk_total += added_chunks
        points.append(
            CollectionHistoryBucket(
                bucket_start=bucket,
                document_total=doc_total,
                chunk_total=chunk_total,
                ingestion=ingestion_by_bucket.get(bucket, LatencyBucketStats()),
                retrieval=retrieval_by_bucket.get(bucket, LatencyBucketStats()),
            )
        )
    return points


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

    def purge_related_rows(self, collection_id: UUID) -> None:
        """Delete every row owned by a collection and detach its chat sessions.

        This is the DB half of the collection-deletion cascade (the vector and
        file purges live in `CollectionDeletionService`). Order matters only in
        that pipeline-run children are removed before their parent runs; chat
        sessions are *detached* (`collection_id -> NULL`), never deleted, so a
        user's chat history outlives the collection it referenced.
        """
        execute = self.session.execute
        execute(
            sa_delete(models.DocumentChunkRecord).where(
                col(models.DocumentChunkRecord.collection_id) == collection_id,
            )
        )
        execute(
            sa_delete(models.IngestionEvent).where(
                col(models.IngestionEvent.collection_id) == collection_id,
            )
        )
        execute(
            sa_delete(models.QueryEvent).where(
                col(models.QueryEvent.collection_id) == collection_id,
            )
        )
        execute(
            sa_delete(models.Document).where(
                col(models.Document.collection_id) == collection_id,
            )
        )
        # After documents (documents.file_id references file_nodes). The
        # self-referential parent_id FK is safe in one statement: NO ACTION
        # constraints are checked at statement end, when parents and children
        # are gone together.
        execute(
            sa_delete(models.FileNode).where(
                col(models.FileNode.collection_id) == collection_id,
            )
        )
        run_ids = list(
            self.session.exec(
                select(col(models.PipelineRun.id)).where(
                    col(models.PipelineRun.collection_id) == collection_id,
                )
            ).all()
        )
        if run_ids:
            execute(
                sa_delete(models.PipelineNodeIO).where(
                    col(models.PipelineNodeIO.run_id).in_(run_ids),
                )
            )
            execute(
                sa_delete(models.PipelineNodeRun).where(
                    col(models.PipelineNodeRun.run_id).in_(run_ids),
                )
            )
            execute(
                sa_delete(models.PipelineRun).where(
                    col(models.PipelineRun.id).in_(run_ids),
                )
            )
        execute(
            sa_delete(models.ChatSessionCollection).where(
                col(models.ChatSessionCollection.collection_id) == collection_id,
            )
        )
        execute(
            sa_update(models.ChatSession)
            .where(col(models.ChatSession.collection_id) == collection_id)
            .values(collection_id=None)
        )

    def delete(self, collection: models.Collection) -> None:
        """Delete a collection row (call `purge_related_rows` first)."""
        self.session.delete(collection)

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

    def count_by_user(self) -> dict[UUID, int]:
        """Return a mapping of user id -> number of collections they own."""
        statement = select(
            models.Collection.user_id,
            func.count(),  # pylint: disable=not-callable
        ).group_by(col(models.Collection.user_id))
        return {user_id: count for user_id, count in self.session.exec(statement).all()}

    def stats_history_for(
        self,
        user_id: UUID,
        collection_id: UUID,
        *,
        window: HistoryWindow,
        now: datetime,
    ) -> list[CollectionHistoryBucket]:
        """Return one bucket per step of the trailing window, oldest first.

        Document/chunk totals are cumulative (documents created before the
        window seed the baseline); latency buckets cover only that bucket's
        events. Buckets with no activity still get a point so charts render
        a continuous series.
        """
        start = window.start_for(now)

        doc_total, chunk_total, docs_by_bucket = self._document_growth(
            user_id, collection_id, window, start
        )
        retrieval_by_bucket = self._latency_by_bucket(
            col(models.QueryEvent.latency_ms),
            models.QueryEvent,
            window,
            start,
            clauses=(
                col(models.QueryEvent.collection_id) == collection_id,
                col(models.QueryEvent.user_id) == user_id,
            ),
        )
        run_duration_ms = (
            func.extract(
                "epoch",
                col(models.PipelineRun.completed_at) - col(models.PipelineRun.started_at),
            )
            * 1000.0
        )
        ingestion_by_bucket = self._latency_by_bucket(
            run_duration_ms,
            models.PipelineRun,
            window,
            start,
            clauses=(
                col(models.PipelineRun.collection_id) == collection_id,
                col(models.PipelineRun.kind) == models.PipelineKind.INGESTION,
                col(models.PipelineRun.status) == models.PipelineRunStatus.COMPLETED,
                col(models.PipelineRun.completed_at).is_not(None),
            ),
        )

        return _merge_history_buckets(
            window,
            start,
            (doc_total, chunk_total),
            docs_by_bucket,
            ingestion_by_bucket,
            retrieval_by_bucket,
        )

    def _document_growth(
        self,
        user_id: UUID,
        collection_id: UUID,
        window: HistoryWindow,
        start: datetime,
    ) -> tuple[int, int, dict[datetime, tuple[int, int]]]:
        """Return the pre-window (docs, chunks) baseline plus per-bucket additions."""
        owned = (
            col(models.Document.user_id) == user_id,
            col(models.Document.collection_id) == collection_id,
        )
        baseline_row = self.session.exec(
            select(
                func.count(col(models.Document.id)),  # pylint: disable=not-callable
                func.coalesce(func.sum(col(models.Document.num_chunks)), 0),
            ).where(*owned, col(models.Document.created_at) < start)
        ).one()

        doc_bucket = func.date_trunc(window.trunc, col(models.Document.created_at))
        doc_rows = self.session.exec(
            select(
                doc_bucket,
                func.count(col(models.Document.id)),  # pylint: disable=not-callable
                func.coalesce(func.sum(col(models.Document.num_chunks)), 0),
            )
            .where(*owned, col(models.Document.created_at) >= start)
            .group_by(doc_bucket)
        ).all()
        docs_by_bucket = {row[0]: (int(row[1]), int(row[2])) for row in doc_rows}
        return int(baseline_row[0]), int(baseline_row[1]), docs_by_bucket

    def _latency_by_bucket(
        self,
        value_expr: SQLColumnExpression[Any],
        model: type[models.QueryEvent] | type[models.PipelineRun],
        window: HistoryWindow,
        start: datetime,
        *,
        clauses: Sequence[ColumnElement[bool]],
    ) -> dict[datetime, LatencyBucketStats]:
        """Aggregate a latency expression into per-bucket count/avg/p50/p95/max."""
        bucket = func.date_trunc(window.trunc, col(model.created_at))
        statement = (
            sa_select(
                bucket,
                func.count(),  # pylint: disable=not-callable
                func.avg(value_expr),
                func.percentile_cont(0.5).within_group(value_expr),
                func.percentile_cont(0.95).within_group(value_expr),
                func.max(value_expr),
            )
            .where(col(model.created_at) >= start, *clauses)
            .group_by(bucket)
        )
        rows = self.session.execute(statement).all()
        return {
            row[0]: LatencyBucketStats(
                count=int(row[1]),
                avg_ms=float(row[2]) if row[2] is not None else None,
                p50_ms=float(row[3]) if row[3] is not None else None,
                p95_ms=float(row[4]) if row[4] is not None else None,
                max_ms=float(row[5]) if row[5] is not None else None,
            )
            for row in rows
        }

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

"""Read side of telemetry: typed usage summaries for the admin dashboard.

Aggregation SQL lives on ``TelemetryRepository``; this service shapes those
rows into the wire models the admin routes serve (joining user emails so the
dashboard never needs a second request).
"""

from __future__ import annotations

from datetime import timedelta

from sqlmodel import Session

from app.db.repositories import TelemetryRepository, UserRepository
from app.schemas.admin import (
    AdminUsagePoint,
    AdminUsageSummary,
    AdminUsageTimeseries,
    AdminUserUsage,
)
from app.utils.time import utc_now


class TelemetryService:
    """Build admin-facing usage summaries from recorded telemetry."""

    def __init__(self, session: Session) -> None:
        """Bind the service to a request-scoped session."""
        self.session = session
        self.repo = TelemetryRepository(session)

    def usage_summary(self, window_days: int) -> AdminUsageSummary:
        """Aggregate per-user and instance-wide chat usage over the window."""
        since = utc_now() - timedelta(days=window_days)
        rows = self.repo.chat_usage_by_user(since)
        emails = {user.id: user.email for user in UserRepository(self.session).list_all()}
        users = sorted(
            (
                AdminUserUsage(
                    user_id=row.user_id,
                    email=emails.get(row.user_id, "deleted@unknown"),
                    turns=row.turns,
                    total_tokens=row.total_tokens,
                    cost=row.cost,
                    last_active=row.last_active,
                )
                for row in rows
            ),
            key=lambda user: user.total_tokens,
            reverse=True,
        )
        return AdminUsageSummary(
            window_days=window_days,
            total_turns=sum(row.turns for row in rows),
            total_tokens=sum(row.total_tokens for row in rows),
            total_cost=sum(row.cost for row in rows),
            active_users=len(rows),
            event_counts=self.repo.event_counts(since),
            users=users,
        )

    def usage_timeseries(self, window_days: int) -> AdminUsageTimeseries:
        """Daily chat-usage points over the window, oldest first."""
        since = utc_now() - timedelta(days=window_days)
        return AdminUsageTimeseries(
            window_days=window_days,
            points=[
                AdminUsagePoint(day=point.day, turns=point.turns, total_tokens=point.total_tokens)
                for point in self.repo.daily_chat_usage(since)
            ],
        )

"""Behavior tests for TelemetryService: usage aggregation over real rows."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from sqlmodel import Session

from app.db import models
from app.db.repositories import TelemetryRepository, UserRepository
from app.telemetry.service import TelemetryService
from app.utils.time import utc_now


def _make_user(session: Session, email: str) -> models.User:
    user = models.User(email=email, hashed_password="hashed")
    UserRepository(session).add(user)
    session.commit()
    session.refresh(user)
    return user


def _turn(
    session: Session,
    user: models.User,
    *,
    tokens: int,
    cost: float,
    days_ago: int = 0,
) -> None:
    row = TelemetryRepository(session).add(
        event_type="chat.turn_completed",
        user_id=user.id,
        payload={"session_id": str(uuid4()), "total_tokens": tokens, "cost": cost},
    )
    if days_ago:
        row.created_at = utc_now() - timedelta(days=days_ago)
        session.add(row)
    session.commit()


def test_usage_summary_aggregates_per_user_within_the_window(session: Session) -> None:
    alice = _make_user(session, "alice@example.com")
    bob = _make_user(session, "bob@example.com")
    _turn(session, alice, tokens=100, cost=0.01)
    _turn(session, alice, tokens=50, cost=0.005)
    _turn(session, bob, tokens=10, cost=0.001)
    _turn(session, bob, tokens=999, cost=9.0, days_ago=45)  # outside the window
    TelemetryRepository(session).add(
        event_type="user.signed_in", user_id=alice.id, payload={}
    )
    session.commit()

    summary = TelemetryService(session).usage_summary(window_days=30)

    assert summary.total_turns == 3
    assert summary.total_tokens == 160
    assert summary.active_users == 2
    assert summary.event_counts["chat.turn_completed"] == 3
    assert summary.event_counts["user.signed_in"] == 1
    by_email = {user.email: user for user in summary.users}
    assert by_email["alice@example.com"].total_tokens == 150
    assert by_email["alice@example.com"].turns == 2
    assert by_email["bob@example.com"].total_tokens == 10
    # Sorted by tokens, heaviest first.
    assert summary.users[0].email == "alice@example.com"


def test_usage_summary_tolerates_missing_payload_fields(session: Session) -> None:
    """Events recorded without token counts aggregate as zero, not a crash."""
    user = _make_user(session, "sparse@example.com")
    TelemetryRepository(session).add(
        event_type="chat.turn_completed",
        user_id=user.id,
        payload={"session_id": str(uuid4())},
    )
    session.commit()

    summary = TelemetryService(session).usage_summary(window_days=30)

    assert summary.total_turns == 1
    assert summary.total_tokens == 0
    assert summary.total_cost == 0.0


def test_usage_timeseries_buckets_by_day(session: Session) -> None:
    user = _make_user(session, "series@example.com")
    _turn(session, user, tokens=10, cost=0.001)
    _turn(session, user, tokens=20, cost=0.002)
    _turn(session, user, tokens=5, cost=0.001, days_ago=2)

    series = TelemetryService(session).usage_timeseries(window_days=7)

    assert len(series.points) == 2
    assert series.points[0].total_tokens == 5  # oldest first
    assert series.points[1].total_tokens == 30
    assert series.points[1].turns == 2

"""Shared time utilities for UTC-safe timestamps."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any


def ensure_utc(timestamp: datetime) -> datetime:
    """Return a timezone-aware datetime fixed to UTC."""
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=UTC)
    return timestamp.astimezone(UTC)


def format_datetime(timestamp: datetime) -> str:
    """Format datetimes as ISO strings that explicitly include the UTC zone."""
    return ensure_utc(timestamp).isoformat().replace("+00:00", "Z")


DEFAULT_DATETIME_ENCODERS: dict[type[Any], Callable[[Any], Any]] = {
    datetime: format_datetime,
}


def utc_now() -> datetime:
    """Return the current UTC time as a timezone-aware datetime."""
    return datetime.now(UTC)

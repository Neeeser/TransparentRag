"""Regression test: TimestampMixin.updated_at bumps automatically on UPDATE.

Callers used to set `model.updated_at = utc_now()` manually right before every
commit; that duplicated logic across routes/services and was easy to forget.
`TimestampMixin` now carries an `onupdate` so the column is refreshed by
SQLAlchemy on any UPDATE, without the call site touching it.
"""

from __future__ import annotations

import time

from sqlmodel import Session

from app.db import models


def test_update_bumps_updated_at_without_manual_touch(session: Session) -> None:
    """Mutating an unrelated column and committing bumps updated_at on its own."""
    user = models.User(
        email="timestamp-test@example.com",
        hashed_password="hashed",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    original_updated_at = user.updated_at

    # Ensure the clock actually advances between writes on fast filesystems/CI.
    time.sleep(0.01)

    user.full_name = "Updated Name"
    session.add(user)
    session.commit()
    session.refresh(user)

    assert user.updated_at > original_updated_at

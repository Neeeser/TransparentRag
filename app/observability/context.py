"""Request-scoped logging context via structlog's contextvars integration.

Fields bound here are automatically merged into every subsequent log event in
the same execution context, so services and clients never thread a request ID
through their signatures. The request middleware binds the request ID (and the
user ID once authenticated); background tasks spawned by a request re-bind the
carried context into their own execution scope with ``request_context``.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

import structlog

REQUEST_ID_KEY = "request_id"
USER_ID_KEY = "user_id"


def bind_request_id(request_id: str) -> None:
    """Bind the request ID onto the current context."""
    structlog.contextvars.bind_contextvars(**{REQUEST_ID_KEY: request_id})


def current_request_id() -> str | None:
    """Return the request ID bound to the current context, if any."""
    value = structlog.contextvars.get_contextvars().get(REQUEST_ID_KEY)
    return value if isinstance(value, str) else None


def clear_context() -> None:
    """Clear all bound context — called at the start of each request."""
    structlog.contextvars.clear_contextvars()


@contextmanager
def request_context(*, request_id: str, user_id: str | None = None) -> Iterator[None]:
    """Bind request/user context for the duration of a block.

    Used by background tasks (e.g. queued ingestion) to carry the enqueuing
    request's correlation into their own logs, then restore the prior context
    on exit so a worker thread's context does not leak between jobs.
    """
    values: dict[str, str] = {REQUEST_ID_KEY: request_id}
    if user_id is not None:
        values[USER_ID_KEY] = user_id
    with structlog.contextvars.bound_contextvars(**values):
        yield

"""Fixtures for observability tests: capture the configured log stream.

``configure_logging`` installs a stdout ``StreamHandler``; these fixtures point
that handler at an in-memory stream so a test can read back exactly what would
have been written, and reset the process-wide buffer and bound context so state
never leaks between tests.
"""

from __future__ import annotations

import io
import logging
from collections.abc import Iterator

import pytest
import structlog

from app.observability import configure_logging, get_log_buffer


@pytest.fixture
def log_stream() -> Iterator[io.StringIO]:
    """Configure JSON logging and yield the stream the handler writes to."""
    structlog.contextvars.clear_contextvars()
    get_log_buffer().clear()
    configure_logging("INFO", debug=False)
    stream = io.StringIO()
    logging.getLogger().handlers[0].stream = stream  # type: ignore[attr-defined]
    yield stream
    structlog.contextvars.clear_contextvars()
    get_log_buffer().clear()

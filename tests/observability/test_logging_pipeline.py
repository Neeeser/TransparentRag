"""End-to-end logging pipeline: JSON shape, context, redaction, tracebacks."""

from __future__ import annotations

import io
import json
import logging

import structlog

from app.observability import configure_logging, get_logger


def _last_record(stream: io.StringIO) -> dict[str, object]:
    lines = [line for line in stream.getvalue().splitlines() if line.strip()]
    return json.loads(lines[-1])


def test_emits_json_with_core_fields(log_stream: io.StringIO) -> None:
    get_logger("app.test").info("ingestion.completed", document_id="d1", duration_ms=12.5)
    record = _last_record(log_stream)
    assert record["event"] == "ingestion.completed"
    assert record["level"] == "info"
    assert record["logger"] == "app.test"
    assert record["document_id"] == "d1"
    assert record["duration_ms"] == 12.5
    assert "timestamp" in record
    assert record["timestamp"].endswith("Z")  # type: ignore[union-attr]


def test_bound_context_is_merged_into_every_event(log_stream: io.StringIO) -> None:
    structlog.contextvars.bind_contextvars(request_id="req-1", user_id="u-1")
    get_logger("app.test").info("http.request.completed", status=200)
    record = _last_record(log_stream)
    assert record["request_id"] == "req-1"
    assert record["user_id"] == "u-1"


def test_redaction_runs_in_the_pipeline(log_stream: io.StringIO) -> None:
    get_logger("app.test").info("auth.login.failed", password="hunter2", api_key="sk-x")
    raw = log_stream.getvalue()
    assert "hunter2" not in raw
    assert "sk-x" not in raw
    assert "[REDACTED]" in raw


def test_exception_traceback_is_preserved(log_stream: io.StringIO) -> None:
    try:
        raise ValueError("boom")
    except ValueError:
        get_logger("app.test").error("background.task.failed", exc_info=True)
    record = _last_record(log_stream)
    assert "Traceback" in record["exception"]  # type: ignore[operator]
    assert "ValueError: boom" in record["exception"]  # type: ignore[operator]


def test_debug_mode_uses_console_renderer_not_json() -> None:
    """DEBUG selects the pretty renderer; output is not JSON but still redacts."""
    structlog.contextvars.clear_contextvars()
    configure_logging("DEBUG", debug=True)
    stream = io.StringIO()
    logging.getLogger().handlers[0].stream = stream  # type: ignore[attr-defined]
    get_logger("app.test").info("auth.login.failed", password="hunter2")
    raw = stream.getvalue()
    assert "auth.login.failed" in raw
    assert "hunter2" not in raw  # redaction runs in DEBUG too
    # Reset to JSON so later tests are unaffected.
    configure_logging("INFO", debug=False)

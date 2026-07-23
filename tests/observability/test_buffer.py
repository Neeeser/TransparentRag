"""The export ring buffer: bounded, ordered, and fed by the tee processor."""

from __future__ import annotations

import json
import logging

from app.observability.buffer import LogRingBuffer, buffer_processor, get_log_buffer


def test_snapshot_returns_records_oldest_first() -> None:
    buffer = LogRingBuffer(capacity=10)
    buffer.append({"event": "a"})
    buffer.append({"event": "b"})
    assert [r["event"] for r in buffer.snapshot()] == ["a", "b"]


def test_capacity_evicts_oldest() -> None:
    buffer = LogRingBuffer(capacity=2)
    buffer.append({"event": "a"})
    buffer.append({"event": "b"})
    buffer.append({"event": "c"})
    assert [r["event"] for r in buffer.snapshot()] == ["b", "c"]


def test_clear_empties_the_buffer() -> None:
    buffer = LogRingBuffer(capacity=2)
    buffer.append({"event": "a"})
    buffer.clear()
    assert buffer.snapshot() == []


def test_snapshot_is_a_copy() -> None:
    buffer = LogRingBuffer(capacity=2)
    buffer.append({"event": "a"})
    snapshot = buffer.snapshot()
    snapshot.append({"event": "b"})
    assert len(buffer.snapshot()) == 1


def test_buffer_processor_tees_into_the_process_buffer() -> None:
    get_log_buffer().clear()
    event = {"event": "ingestion.completed", "document_id": "d1"}
    returned = buffer_processor(None, "info", event)
    assert returned is event  # processor passes the event through unchanged
    assert get_log_buffer().snapshot()[-1]["document_id"] == "d1"


def test_buffer_processor_drops_processorformatter_meta_keys() -> None:
    """Foreign stdlib records arrive with `_record` (a raw `LogRecord`) seeded
    onto the event dict; the tee must strip it, or the export bundle holds an
    unserializable value and 500s. Regression for the admin-export crash."""
    get_log_buffer().clear()
    record = logging.LogRecord("x", logging.INFO, "x", 1, "msg", None, None)
    buffer_processor(
        None,
        "info",
        {"event": "uvicorn.error", "_record": record, "_from_structlog": False},
    )
    buffered = get_log_buffer().snapshot()[-1]
    assert "_record" not in buffered
    assert "_from_structlog" not in buffered
    json.dumps(buffered)  # must be JSON-serializable for the export bundle

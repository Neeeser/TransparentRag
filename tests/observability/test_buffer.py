"""The export ring buffer: bounded, ordered, and fed by the tee processor."""

from __future__ import annotations

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

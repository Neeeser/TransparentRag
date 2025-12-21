from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

from app.db import models
from app.services.chat import ChatService


def test_serialize_message_for_tool_role() -> None:
    message = models.ChatMessage(
        session_id=uuid4(),
        role=models.ChatRole.TOOL,
        content="tool-response",
        tool_call_id="call-1",
    )
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]

    serialized = service._serialize_message(message)

    assert serialized["role"] == "tool"
    assert serialized["tool_call_id"] == "call-1"


def test_serialize_message_includes_tool_calls_for_assistant() -> None:
    message = models.ChatMessage(
        session_id=uuid4(),
        role=models.ChatRole.ASSISTANT,
        content="assistant",
        tool_payload={"tool_calls": [{"id": "call-1"}]},
    )
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]

    serialized = service._serialize_message(message)

    assert serialized["tool_calls"][0]["id"] == "call-1"


def test_record_tool_call_assistant_message_skips_empty_calls() -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    service._record_message = Mock()
    session_model = SimpleNamespace(id=uuid4(), updated_at=None)

    service._record_tool_call_assistant_message(
        session_model=session_model,
        content="",
        tool_calls=[],
    )

    service._record_message.assert_not_called()


def test_record_partial_assistant_message_skips_empty_payload() -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    service._record_message = Mock()
    session_model = SimpleNamespace(id=uuid4(), chat_model="model", updated_at=None)

    service._record_partial_assistant_message(
        session_model=session_model,
        content="  ",
        reasoning_segments=None,
        model=None,
    )

    service._record_message.assert_not_called()


def test_record_partial_assistant_message_records_reasoning() -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    service._record_message = Mock()
    service.session = SimpleNamespace(add=lambda *args, **kwargs: None, flush=lambda: None)
    session_model = SimpleNamespace(id=uuid4(), chat_model="model", updated_at=None)

    service._record_partial_assistant_message(
        session_model=session_model,
        content="",
        reasoning_segments=[{"type": "text", "content": "thinking"}],
        model=None,
    )

    service._record_message.assert_called_once()

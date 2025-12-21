from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.schemas.chat import ChatMessageCreate
from app.services import chat as chat_module
from app.services.chat import ChatService


class _StubRepo:
    def __init__(self, message=None, session=None, messages=None) -> None:
        self._message = message
        self._session = session
        self._messages = messages or []

    def get_message(self, *_args, **_kwargs):
        return self._message

    def get_session(self, *_args, **_kwargs):
        return self._session

    def list_messages(self, *_args, **_kwargs):
        return list(self._messages)


def test_ensure_session_rejects_collection_mismatch() -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    existing = SimpleNamespace(collection_id=uuid4())
    service.chat_repo = _StubRepo(session=existing)

    payload = ChatMessageCreate(content="hi", session_id=uuid4())
    user = SimpleNamespace(id=uuid4())
    collection = SimpleNamespace(id=uuid4())

    with pytest.raises(ValueError, match="does not belong to this collection"):
        service._ensure_session(user=user, collection=collection, payload=payload)


def test_stream_message_raises_for_missing_edit_message() -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    service.chat_repo = _StubRepo(message=None)

    payload = ChatMessageCreate(content="hi", edit_message_id=uuid4())
    user = SimpleNamespace(id=uuid4())
    collection = SimpleNamespace(id=uuid4())

    with pytest.raises(ValueError, match="Message not found for editing"):
        list(service.stream_message(user=user, collection=collection, payload=payload))


def test_stream_message_raises_for_missing_edit_session() -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    edit_message = SimpleNamespace(session_id=uuid4())
    service.chat_repo = _StubRepo(message=edit_message, session=None)

    payload = ChatMessageCreate(content="hi", edit_message_id=uuid4())
    user = SimpleNamespace(id=uuid4())
    collection = SimpleNamespace(id=uuid4())

    with pytest.raises(ValueError, match="Chat session not found for edit"):
        list(service.stream_message(user=user, collection=collection, payload=payload))


def test_stream_message_raises_for_edit_collection_mismatch() -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    edit_message = SimpleNamespace(session_id=uuid4())
    session_model = SimpleNamespace(collection_id=uuid4())
    service.chat_repo = _StubRepo(message=edit_message, session=session_model)

    payload = ChatMessageCreate(content="hi", edit_message_id=uuid4())
    user = SimpleNamespace(id=uuid4())
    collection = SimpleNamespace(id=uuid4())

    with pytest.raises(ValueError, match="different collection"):
        list(service.stream_message(user=user, collection=collection, payload=payload))


def test_stream_message_rejects_empty_content() -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    session_model = SimpleNamespace(id=uuid4(), chat_model="model")
    service._ensure_session = lambda **_kwargs: session_model

    payload = ChatMessageCreate(content="   ")
    user = SimpleNamespace(id=uuid4())
    collection = SimpleNamespace(id=uuid4())

    with pytest.raises(ValueError, match="Message content cannot be empty"):
        list(service.stream_message(user=user, collection=collection, payload=payload))


def test_stream_message_requires_chat_model() -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    session_model = SimpleNamespace(id=uuid4(), chat_model=None)
    service._ensure_session = lambda **_kwargs: session_model
    service._record_message = lambda **_kwargs: None

    payload = ChatMessageCreate(content="hi")
    user = SimpleNamespace(id=uuid4())
    collection = SimpleNamespace(id=uuid4(), chat_model=None)

    with pytest.raises(ValueError, match="chat model configured"):
        list(service.stream_message(user=user, collection=collection, payload=payload))


def test_stream_message_requires_available_model(monkeypatch) -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    session_model = SimpleNamespace(id=uuid4(), chat_model="model")
    service._ensure_session = lambda **_kwargs: session_model
    service._record_message = lambda **_kwargs: None
    service.chat_repo = _StubRepo(messages=[])
    service.openrouter = SimpleNamespace(get_model=lambda _name: None)
    service.reasoning_effort = None
    service.retrieval = SimpleNamespace()

    monkeypatch.setattr(chat_module, "render_system_prompt", lambda *_args, **_kwargs: "prompt")

    payload = ChatMessageCreate(content="hi")
    user = SimpleNamespace(id=uuid4(), email="user@example.com", full_name="User")
    collection = SimpleNamespace(
        id=uuid4(),
        name="Collection",
        description="",
        embedding_model="embed",
        chat_model="model",
        context_window=1024,
        chunk_strategy="token",
        chunk_size=128,
        chunk_overlap=8,
        pinecone_index="idx",
        pinecone_namespace="ns",
        extra_metadata={},
    )

    with pytest.raises(ValueError, match="Selected model is not available"):
        list(service.stream_message(user=user, collection=collection, payload=payload))


def test_stream_message_requires_tool_support(monkeypatch) -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    session_model = SimpleNamespace(id=uuid4(), chat_model="model")
    service._ensure_session = lambda **_kwargs: session_model
    service._record_message = lambda **_kwargs: None
    service.chat_repo = _StubRepo(messages=[])
    service.openrouter = SimpleNamespace(
        get_model=lambda _name: SimpleNamespace(
            supported_parameters=["temperature"],
            context_length=1024,
        )
    )
    service.reasoning_effort = None
    service.retrieval = SimpleNamespace()

    monkeypatch.setattr(chat_module, "render_system_prompt", lambda *_args, **_kwargs: "prompt")

    payload = ChatMessageCreate(content="hi")
    user = SimpleNamespace(id=uuid4(), email="user@example.com", full_name="User")
    collection = SimpleNamespace(
        id=uuid4(),
        name="Collection",
        description="",
        embedding_model="embed",
        chat_model="model",
        context_window=1024,
        chunk_strategy="token",
        chunk_size=128,
        chunk_overlap=8,
        pinecone_index="idx",
        pinecone_namespace="ns",
        extra_metadata={},
    )

    with pytest.raises(ValueError, match="does not support tool calls"):
        list(service.stream_message(user=user, collection=collection, payload=payload))


def test_send_message_raises_for_missing_edit_message() -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    service.chat_repo = _StubRepo(message=None)

    payload = ChatMessageCreate(content="hi", edit_message_id=uuid4())
    user = SimpleNamespace(id=uuid4())
    collection = SimpleNamespace(id=uuid4())

    with pytest.raises(ValueError, match="Message not found for editing"):
        service.send_message(user=user, collection=collection, payload=payload)


def test_send_message_rejects_empty_content() -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    session_model = SimpleNamespace(id=uuid4(), chat_model="model")
    service._ensure_session = lambda **_kwargs: session_model

    payload = ChatMessageCreate(content="   ")
    user = SimpleNamespace(id=uuid4())
    collection = SimpleNamespace(id=uuid4())

    with pytest.raises(ValueError, match="Message content cannot be empty"):
        service.send_message(user=user, collection=collection, payload=payload)


def test_send_message_requires_chat_model() -> None:
    service = ChatService.__new__(ChatService)  # type: ignore[call-arg]
    session_model = SimpleNamespace(id=uuid4(), chat_model=None)
    service._ensure_session = lambda **_kwargs: session_model
    service._record_message = lambda **_kwargs: None

    payload = ChatMessageCreate(content="hi")
    user = SimpleNamespace(id=uuid4())
    collection = SimpleNamespace(id=uuid4(), chat_model=None)

    with pytest.raises(ValueError, match="chat model configured"):
        service.send_message(user=user, collection=collection, payload=payload)

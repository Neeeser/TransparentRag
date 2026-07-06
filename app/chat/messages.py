"""Provider-message wire vocabulary for chat request construction.

`ProviderMessage` models the messages an OpenRouter-compatible chat
completion endpoint expects in its request body. It is deliberately not yet
wired into `ChatService`'s internal message history (`ChatSetup.messages`,
`persistence/records.py::serialize_message`): those paths replay
already-persisted JSON verbatim, including at least one on-disk shape
(`tool_calls` entries missing `type`/`function`, see
`tests/services/chat/test_chat_records.py::test_serialize_message_includes_tool_calls_for_assistant`)
that predates this model and would fail strict validation. Adopting this
model there is Task 4.2/4.3's job, once the run loop is restructured enough
to backfill or migrate that shape.

`normalize_assistant_content` is used today: it replaces the `json.dumps`
list-content coercion that was duplicated three times in
`app/chat/service.py`.
"""

from __future__ import annotations

import json
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field


class FunctionCall(BaseModel):
    """A tool call's function name and JSON-encoded argument string."""

    name: str
    arguments: str


class ToolCall(BaseModel):
    """A single tool call requested by the assistant."""

    id: str
    type: Literal["function"] = "function"
    function: FunctionCall


class SystemMessage(BaseModel):
    """A system prompt message."""

    role: Literal["system"] = "system"
    content: str


class UserMessage(BaseModel):
    """A user-authored message."""

    role: Literal["user"] = "user"
    content: str


class AssistantMessage(BaseModel):
    """An assistant message, optionally requesting tool calls."""

    role: Literal["assistant"] = "assistant"
    content: str
    tool_calls: list[ToolCall] | None = None


class ToolMessage(BaseModel):
    """A tool result message replying to a specific tool call."""

    role: Literal["tool"] = "tool"
    tool_call_id: str | None
    content: str


ProviderMessage = Annotated[
    SystemMessage | UserMessage | AssistantMessage | ToolMessage,
    Field(discriminator="role"),
]


def normalize_assistant_content(content: Any) -> str:
    """Coerce a provider-returned assistant `content` value into a string.

    Providers can return assistant content either as a plain string or as a
    list of content-part dicts (e.g. `[{"type": "output_text", "text": ...}]`);
    this JSON-encodes the list case so callers always get a single string,
    falling back to `""` for `None`/empty content.
    """
    if isinstance(content, list):
        return json.dumps(content)
    return content or ""

"""Redaction is the enforcement of the prohibited-field policy.

These are the highest-value observability tests: they prove that values the
policy forbids cannot reach the log output even when a caller passes them.
"""

from __future__ import annotations

from app.observability.redaction import (
    MAX_VALUE_LENGTH,
    REDACTED,
    redact_processor,
)


def _redact(event: dict[str, object]) -> dict[str, object]:
    return redact_processor(None, "info", event)


def test_credential_and_pii_keys_are_redacted() -> None:
    event = {
        "event": "auth.login.succeeded",
        "password": "hunter2",
        "api_key": "sk-live-abc",
        "openrouter_api_key": "sk-or-xyz",
        "authorization": "Bearer token",
        "email": "user@example.com",
        "username": "andrew",
        "jwt": "eyJhbGciOi...",
        "cookie": "session=abc",
        "connection_string": "postgresql://u:p@host/db",
        "session_id": "abc-123",
    }

    result = _redact(event)

    for key in event:
        if key == "event":
            continue
        assert result[key] == REDACTED, f"{key} was not redacted: {result[key]!r}"
    assert result["event"] == "auth.login.succeeded"


def test_user_id_is_not_redacted() -> None:
    """`user_id` is opaque operational metadata the policy deliberately keeps."""
    result = _redact({"user_id": "a1b2c3", "collection_id": "col-1"})
    assert result["user_id"] == "a1b2c3"
    assert result["collection_id"] == "col-1"


def test_nested_and_list_values_are_redacted() -> None:
    result = _redact(
        {
            "context": {"api_key": "secret", "count": 3},
            "items": [{"password": "p"}, {"document_id": "d1"}],
        }
    )
    assert result["context"] == {"api_key": REDACTED, "count": 3}
    assert result["items"] == [{"password": REDACTED}, {"document_id": "d1"}]


def test_control_characters_and_newlines_are_stripped() -> None:
    result = _redact({"error": "line1\nline2\r\x00tail\x1b[31m"})
    value = result["error"]
    assert isinstance(value, str)
    assert "\n" not in value
    assert "\r" not in value
    assert "\x00" not in value
    assert "\x1b" not in value


def test_long_values_are_truncated() -> None:
    result = _redact({"blob": "x" * (MAX_VALUE_LENGTH + 500)})
    value = result["blob"]
    assert isinstance(value, str)
    assert len(value) <= MAX_VALUE_LENGTH + len("…[truncated]")
    assert value.endswith("…[truncated]")


def test_structural_keys_keep_full_multiline_tracebacks() -> None:
    """`exception` carries the traceback — never truncated or newline-stripped."""
    traceback = "Traceback (most recent call last):\n" + "  frame\n" * 200
    result = _redact({"exception": traceback})
    assert result["exception"] == traceback
    assert "\n" in result["exception"]  # type: ignore[operator]

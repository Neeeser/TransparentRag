"""Key preflight: missing and rejected keys fail loudly before any seeding."""

from __future__ import annotations

import pytest

from app.providers.base import ConnectionValidationResult
from sandbox import keys
from sandbox.keys import PreflightError, preflight


def test_missing_key_names_the_env_var(monkeypatch: pytest.MonkeyPatch) -> None:
    """An unset required key aborts with the variable name and env-file hint."""
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(PreflightError, match="OPENROUTER_API_KEY"):
        preflight(("openrouter",))


def test_rejected_key_surfaces_the_provider_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A key the provider rejects aborts with the provider's own message."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-bad")
    monkeypatch.setattr(
        keys,
        "_validate_key",
        lambda provider, key: "Invalid credentials",
    )
    with pytest.raises(PreflightError, match="Invalid credentials"):
        preflight(("openrouter",))


def test_valid_key_passes(monkeypatch: pytest.MonkeyPatch) -> None:
    """A key the provider accepts lets seeding proceed."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-good")
    monkeypatch.setattr(keys, "_validate_key", lambda provider, key: None)
    preflight(("openrouter",))


def test_unknown_provider_requirement_is_rejected() -> None:
    """Requiring a provider the preflight can't check is a scenario bug."""
    with pytest.raises(PreflightError, match="Unknown provider"):
        preflight(("not-a-provider",))


def test_validate_key_uses_the_apps_own_validation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Preflight goes through build_adapter().validate_connection() — the same
    check the connections API runs at save time."""
    captured: dict[str, object] = {}

    class FakeAdapter:
        def validate_connection(self) -> ConnectionValidationResult:
            return ConnectionValidationResult(valid=False, message="nope")

    def fake_build_adapter(connection: object) -> FakeAdapter:
        captured["connection"] = connection
        return FakeAdapter()

    import app.providers.registry as registry_module

    monkeypatch.setattr(registry_module, "build_adapter", fake_build_adapter)
    assert keys._validate_key("openrouter", "sk-or-x") == "nope"
    connection = captured["connection"]
    assert connection.provider_type == "openrouter"
    assert connection.config == {"api_key": "sk-or-x"}

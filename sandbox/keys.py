"""Provider key loading and preflight validation.

Real keys live in the gitignored ``.env.sandbox`` (see ``.env.sandbox.example``);
this module loads them into the process environment and validates the ones a
scenario declares before any state is touched, so a missing or broken key
fails with its provider's name instead of seeding a half-working state.

Validation reuses the app's own ``validate_connection`` on a transient
(never persisted) connection row — the exact check the connections API runs
at save time, so preflight can't drift from what the app accepts.
"""

from __future__ import annotations

import os

from sandbox.config import ENV_FILE

PROVIDER_ENV_VARS: dict[str, str] = {
    "openrouter": "OPENROUTER_API_KEY",
    "cohere": "COHERE_API_KEY",
    "pinecone": "PINECONE_API_KEY",
}


class PreflightError(SystemExit):
    """A required provider key is missing or rejected; abort before seeding."""


def load_env_file() -> None:
    """Load ``.env.sandbox`` into the environment without overriding real vars."""
    if not ENV_FILE.exists():
        return
    for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        os.environ.setdefault(name.strip(), value.strip().strip("'\""))


def provider_key(provider: str) -> str | None:
    """Return the configured key for a provider, if any."""
    env_var = PROVIDER_ENV_VARS.get(provider)
    return os.getenv(env_var) if env_var else None


def preflight(requires: tuple[str, ...]) -> None:
    """Validate every required provider key live; raise `PreflightError` on failure."""
    for provider in requires:
        env_var = PROVIDER_ENV_VARS.get(provider)
        if env_var is None:
            raise PreflightError(f"Unknown provider requirement '{provider}'.")
        key = os.getenv(env_var)
        if not key:
            raise PreflightError(
                f"{env_var} is not set — required by this scenario. "
                f"Add it to {ENV_FILE.name} (see .env.sandbox.example)."
            )
        message = _validate_key(provider, key)
        if message is not None:
            raise PreflightError(f"{env_var} was rejected by {provider}: {message}")


def _validate_key(provider: str, key: str) -> str | None:
    """Run the app's live connection validation; return an error message or None."""
    from uuid import uuid4

    from app.db import models
    from app.providers.registry import build_adapter

    connection = models.ProviderConnection(
        user_id=uuid4(),
        provider_type=provider,
        label="sandbox-preflight",
        config={"api_key": key},
    )
    result = build_adapter(connection).validate_connection()
    if result.valid:
        return None
    return result.message or "connection validation failed"

"""Validation of a user's OpenRouter and Pinecone API keys.

Each validator makes one lightweight authenticated call to its provider and maps
the outcome onto a `ProviderKeyStatus`. The two providers report through the same
status vocabulary (missing / invalid / connected) so callers -- the `/me/keys/
validate` endpoint and `AccountService.update_settings` -- treat them
symmetrically. Provider selection goes through `validate_key`, the single
per-provider dispatch that replaced the twin inline blocks in the auth route.
"""

from __future__ import annotations

from enum import Enum

import httpx
from pinecone.exceptions import PineconeException

from app.clients.openrouter import get_openrouter_client
from app.clients.pinecone import get_pinecone_client
from app.db import models
from app.schemas.auth import ProviderKeyStatus, UserKeyValidation


class Provider(Enum):
    """A validatable external provider."""

    OPENROUTER = "openrouter"
    PINECONE = "pinecone"


def _missing() -> ProviderKeyStatus:
    """Return the standard missing-key status."""
    return ProviderKeyStatus(configured=False, valid=False, message="Missing.")


def _connected() -> ProviderKeyStatus:
    """Return the standard connected (valid) status."""
    return ProviderKeyStatus(configured=True, valid=True, message="Connected.")


def _invalid(message: str) -> ProviderKeyStatus:
    """Return a configured-but-invalid status with a provider message."""
    return ProviderKeyStatus(configured=True, valid=False, message=message)


def validate_openrouter_key(api_key: str) -> ProviderKeyStatus:
    """Validate an OpenRouter API key against the /key endpoint."""
    resolved = (api_key or "").strip()
    if not resolved:
        return _missing()
    try:
        get_openrouter_client(resolved).get_current_key()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (401, 403):
            return _invalid("Invalid OpenRouter API key.")
        return _invalid("OpenRouter validation failed.")
    except httpx.HTTPError:
        return _invalid("OpenRouter validation failed.")
    return _connected()


def validate_pinecone_key(api_key: str) -> ProviderKeyStatus:
    """Validate a Pinecone API key by listing indexes."""
    resolved = (api_key or "").strip()
    if not resolved:
        return _missing()
    try:
        get_pinecone_client(api_key=resolved).list_indexes()
    except PineconeException:
        return _invalid("Invalid Pinecone API key.")
    return _connected()


def validate_key(provider: Provider, api_key: str) -> ProviderKeyStatus:
    """Validate a key for the given provider (single per-provider dispatch)."""
    if provider is Provider.OPENROUTER:
        return validate_openrouter_key(api_key)
    return validate_pinecone_key(api_key)


def validate_user_keys(user: models.User) -> UserKeyValidation:
    """Validate both stored provider keys for a user."""
    return UserKeyValidation(
        openrouter=validate_openrouter_key(user.openrouter_api_key or ""),
        pinecone=validate_pinecone_key(user.pinecone_api_key or ""),
    )

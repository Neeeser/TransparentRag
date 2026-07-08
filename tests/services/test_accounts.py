"""Behavior of the account service: registration, settings, and base prompt.

These migrated out of ``tests/api/test_auth_routes.py`` when Task 6.2 moved the
behavior off the route and into ``AccountService`` -- the route now only
translates the domain errors these tests raise.
"""

from __future__ import annotations

import pytest
from sqlmodel import Session

from app.db import models
from app.db.repositories import UserRepository
from app.schemas.auth import (
    ProviderKeyStatus,
    RunSettingsSection,
    UserCreate,
    UserSettingsUpdate,
)
from app.schemas.enums import UserRole
from app.services import accounts as accounts_module
from app.services.accounts import AccountService, ensure_admin_exists
from app.services.errors import InvalidInputError
from app.services.pipelines import PipelineService
from app.services.provider_keys import Provider


def _persist_user(
    session: Session,
    *,
    openrouter: str | None = None,
    pinecone: str | None = None,
) -> models.User:
    user = models.User(
        email="user@example.com",
        full_name="User",
        hashed_password="hashed",
        openrouter_api_key=openrouter,
        pinecone_api_key=pinecone,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _valid_key(_provider: Provider, _api_key: str) -> ProviderKeyStatus:
    return ProviderKeyStatus(configured=True, valid=True, message="Connected.")


def test_register_rejects_duplicate_email(session: Session) -> None:
    payload = UserCreate(email="user@example.com", full_name="User", password="Str0ngPass!")
    AccountService(session).register(payload)

    with pytest.raises(InvalidInputError):
        AccountService(session).register(payload)


def test_new_user_defaults_to_user_role(session: Session) -> None:
    """A freshly registered account (after the first) carries the non-privileged role."""
    service = AccountService(session)
    service.register(UserCreate(email="admin-seed@example.com", password="password123"))
    user = service.register(
        UserCreate(email="role-default@example.com", password="password123")
    )
    with Session(session.get_bind()) as fresh_session:
        fresh = fresh_session.get(models.User, user.id)
        assert fresh is not None
        assert fresh.role == UserRole.USER.value


def test_register_provisions_default_pipelines(session: Session) -> None:
    user = AccountService(session).register(
        UserCreate(email="new@example.com", full_name="New", password="Str0ngPass!")
    )

    defaults = PipelineService(session).ensure_default_pipelines(user)
    assert defaults.ingestion.id is not None
    assert defaults.retrieval.id is not None


def test_update_settings_rejects_invalid_openrouter_key(monkeypatch, session: Session) -> None:
    user = _persist_user(session)

    def _invalid(provider: Provider, _api_key: str) -> ProviderKeyStatus:
        if provider is Provider.OPENROUTER:
            return ProviderKeyStatus(configured=True, valid=False, message="Invalid OpenRouter API key.")
        return _valid_key(provider, _api_key)

    monkeypatch.setattr(accounts_module, "validate_key", _invalid)

    with pytest.raises(InvalidInputError) as excinfo:
        AccountService(session).update_settings(
            user, UserSettingsUpdate(openrouter_api_key="bad-key")
        )

    assert excinfo.value.detail == {"openrouter_api_key": "Invalid OpenRouter API key."}
    session.refresh(user)
    assert user.openrouter_api_key is None


def test_update_settings_rejects_invalid_pinecone_key(monkeypatch, session: Session) -> None:
    user = _persist_user(session)

    def _invalid(provider: Provider, _api_key: str) -> ProviderKeyStatus:
        if provider is Provider.PINECONE:
            return ProviderKeyStatus(configured=True, valid=False, message="Invalid Pinecone API key.")
        return _valid_key(provider, _api_key)

    monkeypatch.setattr(accounts_module, "validate_key", _invalid)

    with pytest.raises(InvalidInputError) as excinfo:
        AccountService(session).update_settings(
            user, UserSettingsUpdate(pinecone_api_key="bad-key")
        )

    assert "pinecone_api_key" in excinfo.value.detail


def test_update_settings_clears_keys(session: Session) -> None:
    user = _persist_user(session, openrouter="openrouter-key", pinecone="pinecone-key")

    updated = AccountService(session).update_settings(
        user, UserSettingsUpdate(openrouter_api_key=" ", pinecone_api_key=" ")
    )

    assert updated.openrouter_api_key is None
    assert updated.pinecone_api_key is None


def test_update_settings_accepts_valid_keys(monkeypatch, session: Session) -> None:
    monkeypatch.setattr(accounts_module, "validate_key", _valid_key)
    user = _persist_user(session)

    updated = AccountService(session).update_settings(
        user, UserSettingsUpdate(openrouter_api_key="openrouter-key", pinecone_api_key="pinecone-key")
    )

    assert updated.openrouter_api_key == "openrouter-key"
    assert updated.pinecone_api_key == "pinecone-key"


def test_update_settings_sets_only_one_key(monkeypatch, session: Session) -> None:
    monkeypatch.setattr(accounts_module, "validate_key", _valid_key)
    user = _persist_user(session)

    updated = AccountService(session).update_settings(
        user, UserSettingsUpdate(openrouter_api_key="openrouter-key")
    )

    assert updated.openrouter_api_key == "openrouter-key"
    assert updated.pinecone_api_key is None


def test_update_settings_sets_run_settings_order(session: Session) -> None:
    user = _persist_user(session)
    order = [
        RunSettingsSection.STREAMING,
        RunSettingsSection.SYSTEM_PROMPT,
        RunSettingsSection.USAGE,
    ]

    AccountService(session).update_settings(user, UserSettingsUpdate(run_settings_order=order))

    session.refresh(user)
    assert user.run_settings_order == [entry.value for entry in order]


def test_update_base_prompt_sets_and_clears_template(session: Session) -> None:
    user = _persist_user(session)

    AccountService(session).update_base_prompt(user, "  Custom prompt  ")
    session.refresh(user)
    assert user.system_prompt_template == "Custom prompt"

    AccountService(session).update_base_prompt(user, "   ")
    session.refresh(user)
    assert user.system_prompt_template is None


def test_first_registered_user_becomes_admin(session: Session) -> None:
    """On an empty install the first account is the admin; the second is not."""
    service = AccountService(session)
    first = service.register(UserCreate(email="first@example.com", password="password123"))
    second = service.register(UserCreate(email="second@example.com", password="password123"))
    with Session(session.get_bind()) as fresh:
        assert fresh.get(models.User, first.id).role == UserRole.ADMIN.value
        assert fresh.get(models.User, second.id).role == UserRole.USER.value


def test_ensure_admin_exists_promotes_earliest_user(session: Session) -> None:
    """Upgraded deployments with users but no admin promote the earliest account."""
    service = AccountService(session)
    first = service.register(UserCreate(email="old@example.com", password="password123"))
    service.register(UserCreate(email="new@example.com", password="password123"))
    # Simulate a pre-roles deployment: nobody is admin.
    for user in UserRepository(session).list_all():
        user.role = UserRole.USER.value
        session.add(user)
    session.commit()

    ensure_admin_exists(session)

    with Session(session.get_bind()) as fresh:
        assert fresh.get(models.User, first.id).role == UserRole.ADMIN.value


def test_ensure_admin_exists_is_a_noop_with_admin_or_no_users(session: Session) -> None:
    """No promotion happens when an admin already exists or the table is empty."""
    ensure_admin_exists(session)  # empty table: must not raise
    service = AccountService(session)
    admin = service.register(UserCreate(email="a@example.com", password="password123"))
    other = service.register(UserCreate(email="b@example.com", password="password123"))
    ensure_admin_exists(session)
    with Session(session.get_bind()) as fresh:
        assert fresh.get(models.User, admin.id).role == UserRole.ADMIN.value
        assert fresh.get(models.User, other.id).role == UserRole.USER.value

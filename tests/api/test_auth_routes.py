from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine

from app.api.routes import auth as auth_routes
from app.core.security import hash_password
from app.db import models
from app.schemas.auth import UserCreate


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_register_user_rejects_duplicate_email() -> None:
    session = _session()
    payload = UserCreate(email="user@example.com", full_name="User", password="Str0ngPass!")

    auth_routes.register_user(payload, session=session)

    with pytest.raises(HTTPException) as excinfo:
        auth_routes.register_user(payload, session=session)

    assert excinfo.value.status_code == 400


def test_login_for_access_token_rejects_invalid_password() -> None:
    session = _session()
    user = models.User(
        email="user@example.com",
        full_name="User",
        hashed_password=hash_password("correct-password"),
    )
    session.add(user)
    session.commit()

    form_data = SimpleNamespace(username="user@example.com", password="wrong-password")

    with pytest.raises(HTTPException) as excinfo:
        auth_routes.login_for_access_token(form_data, session=session)

    assert excinfo.value.status_code == 401

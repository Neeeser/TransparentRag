from __future__ import annotations

import pytest
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings, get_settings


def test_openrouter_base_url_appends_api_version() -> None:
    settings = Settings.model_validate({"OPENROUTER_BASE_URL": "https://openrouter.ai"})

    assert settings.openrouter_base_url == "https://openrouter.ai/api/v1"


def test_openrouter_base_url_strips_trailing_slash() -> None:
    settings = Settings.model_validate({"OPENROUTER_BASE_URL": "https://openrouter.ai/api/v1/"})

    assert settings.openrouter_base_url == "https://openrouter.ai/api/v1"


def test_openrouter_base_url_rejects_empty_value() -> None:
    with pytest.raises(ValueError, match="OPENROUTER_BASE_URL must be set"):
        Settings.model_validate({"OPENROUTER_BASE_URL": " "})


def test_database_url_rejects_non_postgres() -> None:
    with pytest.raises(ValueError, match="DATABASE_URL must use a postgres"):
        Settings.model_validate({"DATABASE_URL": "sqlite:///local.db"})


def test_get_settings_creates_storage_path(tmp_path, monkeypatch) -> None:
    get_settings.cache_clear()
    storage_path = tmp_path / "storage"
    monkeypatch.setenv("FILE_STORAGE_PATH", str(storage_path))
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://localhost:5432/transparentrag")

    settings = get_settings()

    assert settings.storage_path == storage_path
    assert storage_path.exists()

    get_settings.cache_clear()
    monkeypatch.delenv("FILE_STORAGE_PATH", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)


def test_default_jwt_secret_allowed_in_debug_mode() -> None:
    settings = Settings.model_validate({"DEBUG": "true", "JWT_SECRET_KEY": "changeme"})

    assert settings.jwt_secret_key == "changeme"


def test_default_jwt_secret_rejected_outside_debug_mode() -> None:
    with pytest.raises(ValueError, match="JWT_SECRET_KEY must be set"):
        Settings.model_validate({"DEBUG": "false", "JWT_SECRET_KEY": "changeme"})


def test_non_default_jwt_secret_allowed_outside_debug_mode() -> None:
    settings = Settings.model_validate({"DEBUG": "false", "JWT_SECRET_KEY": "a-real-secret"})

    assert settings.jwt_secret_key == "a-real-secret"


def test_cors_origins_default_to_localhost_frontend() -> None:
    settings = Settings.model_validate({})

    assert settings.cors_origins == ["http://localhost:3000"]


def test_app_cors_middleware_uses_configured_origins(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", '["https://app.example.com"]')
    get_settings.cache_clear()

    import sys

    if "app.api.main" in sys.modules:
        del sys.modules["app.api.main"]
    import app.api.main as main_module

    cors_middleware = next(
        m for m in main_module.app.user_middleware if m.cls is CORSMiddleware
    )

    assert cors_middleware.kwargs["allow_origins"] == ["https://app.example.com"]
    assert cors_middleware.kwargs["allow_credentials"] is True

    get_settings.cache_clear()
    monkeypatch.delenv("CORS_ORIGINS", raising=False)

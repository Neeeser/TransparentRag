from __future__ import annotations

import importlib
import logging
import sys
from typing import ClassVar

from app.core import config as config_module


def test_main_configures_logging_when_level_set(monkeypatch) -> None:
    config_module.get_settings.cache_clear()
    monkeypatch.setenv("LOG_LEVEL", "debug")

    recorded: dict[str, object] = {}

    def _basic_config(**kwargs):
        recorded.update(kwargs)

    monkeypatch.setattr(logging, "basicConfig", _basic_config)

    if "app.api.main" in sys.modules:
        del sys.modules["app.api.main"]
    import app.api.main as main_module

    importlib.reload(main_module)

    assert recorded["level"] == logging.DEBUG
    assert "format" in recorded

    config_module.get_settings.cache_clear()
    monkeypatch.delenv("LOG_LEVEL", raising=False)


def test_main_skips_logging_when_level_unset(monkeypatch) -> None:
    class _StubSettings:
        log_level = None
        cors_origins: ClassVar[list[str]] = ["http://localhost:3000"]

    monkeypatch.setattr(config_module, "get_settings", lambda: _StubSettings())

    if "app.api.main" in sys.modules:
        del sys.modules["app.api.main"]
    import app.api.main as main_module

    importlib.reload(main_module)

    assert main_module.LOG_LEVEL_NAME == ""

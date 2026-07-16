"""Behavior of the dev database readiness script's pure decision logic.

The mode-selection contract (docker/native/external, and the no-op when the DB
already answers) is where a regression would silently point `make run`/`make
test` at the wrong Postgres, so it is pinned here without touching Docker or a
real server.
"""

from __future__ import annotations

from unittest.mock import Mock

import pytest

from scripts import ensure_postgres as postgres
from scripts.ensure_postgres import COMPOSE_FILE, parse_host_port, plan_action


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("postgresql+psycopg://ragworks:ragworks@localhost:54329/ragworks", ("localhost", 54329)),
        ("postgresql+psycopg://postgres:postgres@db:5432/ragworks_test", ("db", 5432)),
        ("postgresql+psycopg:///ragworks", ("localhost", 5432)),
    ],
)
def test_parse_host_port(url: str, expected: tuple[str, int]) -> None:
    assert parse_host_port(url) == expected


def test_already_reachable_is_noop_outside_docker_mode() -> None:
    for mode in ("native", "external"):
        assert plan_action(mode, reachable=True) == "noop"


def test_docker_mode_starts_the_container_when_unreachable() -> None:
    assert plan_action("docker", reachable=False) == "docker"


def test_docker_mode_reconciles_the_compose_service_when_already_reachable() -> None:
    assert plan_action("docker", reachable=True) == "docker"


def test_native_mode_starts_local_postgres_when_unreachable() -> None:
    assert plan_action("native", reachable=False) == "native"


def test_external_mode_only_waits_and_never_manages() -> None:
    # CI service container / a contributor's own server: never start anything,
    # just wait for it to answer.
    assert plan_action("external", reachable=False) == "wait"


def test_dev_compose_binds_postgres_to_loopback() -> None:
    """The native app needs a local port, not a network-exposed database."""
    assert '"127.0.0.1:54329:5432"' in COMPOSE_FILE.read_text()


def test_docker_mode_reconciles_compose_before_waiting_for_postgres(monkeypatch) -> None:
    compose_up = Mock()
    monkeypatch.setenv("DB_MODE", "docker")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://localhost:54329/ragworks")
    monkeypatch.setattr(postgres, "docker_is_local", lambda: True, raising=False)
    monkeypatch.setattr(postgres, "tcp_reachable", lambda *_: True)
    monkeypatch.setattr(postgres, "_compose_up", compose_up)

    postgres.ensure_postgres()

    compose_up.assert_called_once_with()


def test_docker_mode_rejects_a_remote_daemon(monkeypatch) -> None:
    monkeypatch.setenv("DB_MODE", "docker")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://localhost:54329/ragworks")
    monkeypatch.setattr(postgres, "docker_is_local", lambda: False, raising=False)
    monkeypatch.setattr(postgres, "tcp_reachable", lambda *_: True)

    with pytest.raises(SystemExit, match="local Docker daemon"):
        postgres.ensure_postgres()


@pytest.mark.parametrize("endpoint", ["tcp://127.0.0.1:2375", "tcp://localhost:2375"])
def test_local_tcp_docker_endpoints_are_supported(monkeypatch, endpoint: str) -> None:
    monkeypatch.setenv("DOCKER_HOST", endpoint)

    assert postgres.docker_is_local()

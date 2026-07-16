#!/usr/bin/env python
"""Ensure a Postgres server is ready for local development.

Three modes, selected by the ``DB_MODE`` environment variable (set by the
Makefile, defaulting to ``native`` for a bare invocation):

- ``docker``   — start the Dockerized ParadeDB database from
  ``docker-compose.dev.yml`` (pgvector + pg_search, so hybrid/BM25 search
  works). This is the recommended path and the Makefile's default whenever a
  Docker daemon is reachable.
- ``native``   — no Docker daemon available: start a locally-installed
  Postgres via ``pg_ctl``. Works, but pg_search is absent so BM25/hybrid
  search degrades to dense-only.
- ``external`` — the database is managed elsewhere (CI service container, a
  contributor pointing ``DATABASE_URL`` at their own server). Wait for it to
  answer and manage nothing.

Native and external modes are no-ops when the target URL already answers.
Docker mode always reconciles its Compose service, so another listener cannot
silently replace the ParadeDB database used for development.
"""

from __future__ import annotations

import os
import socket
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy.engine.url import make_url

DEFAULT_DATABASE_URL = "postgresql+psycopg://localhost:5432/ragworks"
COMPOSE_FILE = Path(__file__).resolve().parent.parent / "docker-compose.dev.yml"
DEFAULT_DATA_DIRS = [
    "/opt/homebrew/var/postgresql@17",
    "/usr/local/var/postgresql@17",
    "/var/lib/postgresql/data",
    "/var/lib/postgresql/17/main",
]


def _database_url() -> str:
    return os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)


def _mode() -> str:
    return os.getenv("DB_MODE", "native")


def parse_host_port(url: str) -> tuple[str, int]:
    """Return the (host, port) the given SQLAlchemy URL connects to."""
    parsed = make_url(url)
    return parsed.host or "localhost", parsed.port or 5432


def tcp_reachable(host: str, port: int, timeout: float = 1.0) -> bool:
    """Return whether a TCP connection to host:port succeeds.

    Cheaper and dependency-free versus shelling out to ``pg_isready`` — a bare
    accepted connection is enough to know the server is listening, and it works
    without Postgres client tooling installed on the host.
    """
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def docker_is_local() -> bool:
    """Return whether Docker commands target a daemon on this machine."""
    endpoint = os.getenv("DOCKER_HOST")
    if endpoint is None:
        result = subprocess.run(
            ["docker", "context", "inspect", "--format", "{{ .Endpoints.docker.Host }}"],
            check=False,
            capture_output=True,
            text=True,
        )
        endpoint = result.stdout.strip() if result.returncode == 0 else ""
    parsed = urlparse(endpoint)
    if parsed.scheme in {"unix", "npipe"}:
        return True
    return parsed.scheme == "tcp" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}


def wait_reachable(host: str, port: int, attempts: int = 30, delay: float = 1.0) -> bool:
    """Poll host:port until it accepts a connection or attempts run out."""
    for _ in range(attempts):
        if tcp_reachable(host, port):
            return True
        time.sleep(delay)
    return tcp_reachable(host, port)


def plan_action(mode: str, reachable: bool) -> str:
    """Decide what to do given the mode and whether the DB already answers.

    Returns one of ``"noop"``, ``"docker"``, ``"native"``, ``"wait"``. Pure so
    the mode-selection contract can be tested without touching Docker or a
    Postgres install.
    """
    if mode == "docker":
        return "docker"
    if reachable:
        return "noop"
    if mode == "external":
        return "wait"
    return "native"


def _compose_up() -> None:
    """Start the dev database container and wait for it to report healthy."""
    subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE_FILE), "up", "-d", "--wait", "postgres"],
        check=True,
    )


def _candidate_data_dir() -> str | None:
    env_dir = os.getenv("POSTGRES_DATA_DIR")
    if env_dir:
        return env_dir
    for candidate in DEFAULT_DATA_DIRS:
        if os.path.isdir(candidate):
            return candidate
    return None


def _start_native() -> None:
    """Start a locally-installed Postgres via pg_ctl (or a custom command)."""
    start_command = os.getenv("POSTGRES_START_COMMAND")
    if start_command:
        subprocess.run(start_command, shell=True, check=True)
        return
    data_dir = _candidate_data_dir()
    if not data_dir:
        raise SystemExit(
            "Postgres is not running and no data directory was found. Start Docker "
            "for the recommended path, or set POSTGRES_DATA_DIR / POSTGRES_START_COMMAND."
        )
    log_file = os.getenv("POSTGRES_LOG_FILE") or os.path.join(data_dir, "server.log")
    subprocess.run(["pg_ctl", "-D", data_dir, "-l", log_file, "start"], check=True)


def ensure_postgres() -> None:
    """Ensure the configured Postgres is ready, per DB_MODE."""
    host, port = parse_host_port(_database_url())
    mode = _mode()

    if mode == "docker":
        if not docker_is_local():
            raise SystemExit(
                "Docker mode requires a local Docker daemon. Set DB_MODE=external "
                "with an addressable DATABASE_URL when using a remote Docker context."
            )
        _compose_up()
        if not wait_reachable(host, port):
            raise SystemExit(f"ParadeDB dev database did not become ready on {host}:{port}.")
        print(
            f"→ ParadeDB dev database ready on {host}:{port} "
            "(pgvector + pg_search / BM25 enabled)."
        )
        return

    action = plan_action(mode, tcp_reachable(host, port))

    if action == "noop":
        return

    if action == "native":
        print(
            f"! Docker not detected — using native Postgres on {host}:{port}; "
            "BM25/hybrid search is disabled (dense-only). Start Docker for full parity."
        )
        _start_native()
    # "wait" (external): server is managed elsewhere; just give it time to answer.

    if not wait_reachable(host, port):
        raise SystemExit(f"Postgres did not become ready on {host}:{port}.")


if __name__ == "__main__":
    ensure_postgres()

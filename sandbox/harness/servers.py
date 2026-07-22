"""Start, stop, and inspect the sandbox backend and frontend servers.

Servers run as detached process groups with pidfiles and logs under
`.sandbox/`, so any later invocation (or a different agent session) can stop or
inspect them. The backend binds the sandbox database and storage; the frontend
is the normal Next.js dev server pointed at the sandbox API port.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import httpx

from sandbox import config

BACKEND_PIDFILE = config.RUNTIME_DIR / "backend.pid"
FRONTEND_PIDFILE = config.RUNTIME_DIR / "frontend.pid"
BACKEND_LOG = config.LOGS_DIR / "backend.log"
FRONTEND_LOG = config.LOGS_DIR / "frontend.log"


@dataclass(frozen=True)
class ServerStatus:
    """Liveness of one managed server."""

    name: str
    running: bool
    pid: int | None
    url: str


def start_backend() -> None:
    """Launch uvicorn against the sandbox environment and wait for /api/health."""
    _spawn(
        BACKEND_PIDFILE,
        BACKEND_LOG,
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.api.main:app",
            "--host",
            config.API_HOST,
            "--port",
            str(config.API_PORT),
        ],
        env={**os.environ, **config.backend_env()},
    )
    _wait_http(f"{config.API_BASE_URL}/api/health", timeout=60.0, log=BACKEND_LOG)


def start_frontend() -> None:
    """Launch the Next.js dev server pointed at the sandbox API and wait for it."""
    node_modules = config.REPO_ROOT / "frontend" / "node_modules"
    if not node_modules.exists():
        raise SystemExit("frontend/node_modules missing — run `make env-frontend` first.")
    _spawn(
        FRONTEND_PIDFILE,
        FRONTEND_LOG,
        [
            "npm",
            "--prefix",
            str(config.REPO_ROOT / "frontend"),
            "run",
            "dev",
            "--",
            "-p",
            str(config.FRONTEND_PORT),
        ],
        env={**os.environ, "NEXT_PUBLIC_API_BASE_URL": config.API_BASE_URL},
    )
    _wait_http(config.FRONTEND_BASE_URL, timeout=180.0, log=FRONTEND_LOG)


def stop_all() -> list[str]:
    """Stop both servers if running; return a line per action taken."""
    lines = []
    for name, pidfile in (("frontend", FRONTEND_PIDFILE), ("backend", BACKEND_PIDFILE)):
        pid = _read_pid(pidfile)
        if pid is None or not _alive(pid):
            pidfile.unlink(missing_ok=True)
            continue
        _terminate(pid)
        pidfile.unlink(missing_ok=True)
        lines.append(f"stopped {name} (pid {pid})")
    return lines


def statuses() -> list[ServerStatus]:
    """Report liveness of both servers."""
    return [
        ServerStatus(
            name="backend",
            running=_pidfile_alive(BACKEND_PIDFILE),
            pid=_read_pid(BACKEND_PIDFILE),
            url=config.API_BASE_URL,
        ),
        ServerStatus(
            name="frontend",
            running=_pidfile_alive(FRONTEND_PIDFILE),
            pid=_read_pid(FRONTEND_PIDFILE),
            url=config.FRONTEND_BASE_URL,
        ),
    ]


def any_running() -> bool:
    """True when either managed server is alive."""
    return any(status.running for status in statuses())


def _spawn(pidfile: Path, log: Path, command: list[str], env: dict[str, str]) -> None:
    """Start a detached process group, logging to `log`, recording its pid."""
    existing = _read_pid(pidfile)
    if existing is not None and _alive(existing):
        raise SystemExit(
            f"{pidfile.stem} is already running (pid {existing}) — run `sandbox down` first."
        )
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("ab") as sink:
        process = subprocess.Popen(  # pylint: disable=consider-using-with
            command,
            stdout=sink,
            stderr=subprocess.STDOUT,
            env=env,
            cwd=config.REPO_ROOT,
            start_new_session=True,
        )
    pidfile.write_text(str(process.pid), encoding="utf-8")


def _wait_http(url: str, *, timeout: float, log: Path) -> None:
    """Poll `url` until it answers 2xx/3xx, or fail pointing at the log."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            response = httpx.get(url, timeout=2.0, follow_redirects=True)
            if response.status_code < 500:
                return
        except httpx.HTTPError:
            pass
        time.sleep(0.5)
    raise SystemExit(f"{url} did not come up within {int(timeout)}s — see {log}")


def _terminate(pid: int) -> None:
    """SIGTERM the process group, escalating to SIGKILL after a grace period."""
    group = os.getpgid(pid) if _alive(pid) else None
    if group is None:
        return
    os.killpg(group, signal.SIGTERM)
    deadline = time.monotonic() + 10.0
    while time.monotonic() < deadline:
        if not _alive(pid):
            return
        time.sleep(0.2)
    os.killpg(group, signal.SIGKILL)


def _read_pid(pidfile: Path) -> int | None:
    try:
        return int(pidfile.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return None


def _pidfile_alive(pidfile: Path) -> bool:
    pid = _read_pid(pidfile)
    return pid is not None and _alive(pid)


def _alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True

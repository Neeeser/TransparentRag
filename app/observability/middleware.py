"""Request-context ASGI middleware: correlation IDs and request logging.

A pure ASGI middleware (not ``BaseHTTPMiddleware``) so it does not interfere
with streaming responses and so the request ID it binds propagates *down* into
the sync-route threadpool for every service log.

Per request it: resolves a correlation ID (a valid inbound ``X-Request-ID`` is
honored, anything else is replaced with a fresh UUID so untrusted input never
reaches logs or headers), binds it to the logging context, sets it on the
response headers (including error responses), and emits exactly one
``http.request.completed`` event with method, route template, status, and
duration — plus ``user_id`` when the request authenticated. An unhandled
exception emits ``http.request.failed`` with a traceback; because Starlette's
server-error handler sits *outside* this middleware, the middleware sends its
own correlated 500 so the crash response still carries the request ID a user
needs to file a report.

``user_id`` is read from ``scope["state"]`` (written by the auth dependency),
not a context var: sync dependencies run in a threadpool whose context-var
mutations do not propagate back here, but ``scope`` is a shared dict that does.
"""

from __future__ import annotations

import json
import time
from typing import Any
from uuid import UUID, uuid4

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.observability import events
from app.observability.context import bind_request_id, clear_context

REQUEST_ID_HEADER = "x-request-id"
STATE_USER_ID_KEY = "user_id"
_HEALTH_PREFIX = "/api/health"

logger = events.get_logger("app.request")


def _valid_request_id(raw: str | None) -> str:
    """Return a valid inbound request ID, or a fresh UUID.

    Only a well-formed UUID is echoed back; any other client-supplied value is
    discarded so a caller cannot inject arbitrary text into logs or the
    response header.
    """
    if raw:
        try:
            return str(UUID(raw))
        except (ValueError, AttributeError):
            pass
    return str(uuid4())


def _inbound_request_id(scope: Scope) -> str:
    """Extract and validate the inbound request ID from the ASGI headers."""
    for key, value in scope.get("headers", []):
        if key.decode("latin-1").lower() == REQUEST_ID_HEADER:
            return _valid_request_id(value.decode("latin-1"))
    return _valid_request_id(None)


def _route_template(scope: Scope) -> str:
    """Return the matched route template, falling back to the raw path.

    The template (``/api/collections/{collection_id}``) is logged instead of
    the concrete path so opaque resource IDs are the only thing that varies and
    no path segment carrying a name/id is emitted verbatim.
    """
    route = scope.get("route")
    template = getattr(route, "path", None)
    if isinstance(template, str) and template:
        return template
    path = scope.get("path")
    return path if isinstance(path, str) else "unknown"


def _scope_user_id(scope: Scope) -> str | None:
    """Return the authenticated user's id if the auth dependency set it."""
    state = scope.get("state")
    if isinstance(state, dict):
        value = state.get(STATE_USER_ID_KEY)
        if isinstance(value, str):
            return value
    return None


class RequestContextMiddleware:
    """ASGI middleware binding a correlation ID and logging request outcomes."""

    def __init__(self, app: ASGIApp) -> None:
        """Wrap the downstream ASGI application."""
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Handle one ASGI event, instrumenting HTTP requests only."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _inbound_request_id(scope)
        clear_context()
        bind_request_id(request_id)

        # `scope["state"]` is a shared dict the sync-route threadpool can write
        # back through (`request.state.user_id = ...`); reuse an existing one so
        # any lifespan/app state is preserved.
        existing_state = scope.get("state")
        state: dict[str, Any] = existing_state if isinstance(existing_state, dict) else {}
        scope["state"] = state
        response_started = False
        status_code = 500
        started = time.perf_counter()

        async def send_wrapper(message: Message) -> None:
            nonlocal response_started, status_code
            if message["type"] == "http.response.start":
                response_started = True
                status_code = message["status"]
                headers = MutableHeaders(scope=message)
                headers[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            self._log_request(scope, state, status=500, started=started, failed=True)
            if response_started:
                # The stream already began; we cannot start a fresh response.
                raise
            await self._send_error_response(send, request_id)
        else:
            self._log_request(scope, state, status=status_code, started=started, failed=False)
        finally:
            clear_context()

    @staticmethod
    async def _send_error_response(send: Send, request_id: str) -> None:
        """Emit a correlated 500 so the crash response still carries the id."""
        body = json.dumps({"detail": "Internal Server Error", "request_id": request_id}).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 500,
                "headers": [
                    (b"content-type", b"application/json"),
                    (REQUEST_ID_HEADER.encode(), request_id.encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})

    @staticmethod
    def _log_request(
        scope: Scope,
        state: dict[str, Any],
        *,
        status: int,
        started: float,
        failed: bool,
    ) -> None:
        """Emit the completion (or failure) event for one request."""
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        fields: dict[str, Any] = {
            "method": scope.get("method", "?"),
            "route": _route_template(scope),
            "status": status,
            "duration_ms": duration_ms,
        }
        user_id = state.get(STATE_USER_ID_KEY)
        if isinstance(user_id, str):
            fields["user_id"] = user_id

        if failed:
            logger.error(events.HTTP_REQUEST_FAILED, **fields, exc_info=True)
        elif scope.get("path", "").startswith(_HEALTH_PREFIX):
            logger.debug(events.HTTP_REQUEST_COMPLETED, **fields)
        else:
            logger.info(events.HTTP_REQUEST_COMPLETED, **fields)

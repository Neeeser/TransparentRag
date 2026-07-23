"""Request-context middleware: correlation header + request logging contract.

Header behavior is checked against the real app; the completion-event and
multi-user attribution contract is checked against a minimal app so the test
does not depend on any particular route's auth.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.observability import (
    RequestContextMiddleware,
    configure_logging,
    get_log_buffer,
)


def _header(response: object, name: str) -> str | None:
    headers = {k.lower(): v for k, v in response.headers.items()}  # type: ignore[attr-defined]
    return headers.get(name.lower())


def test_response_carries_a_request_id(unauthed_client: TestClient) -> None:
    response = unauthed_client.get("/api/health")
    assert _header(response, "X-Request-ID")


def test_malformed_inbound_request_id_is_replaced(unauthed_client: TestClient) -> None:
    response = unauthed_client.get("/api/health", headers={"X-Request-ID": "not-a-uuid"})
    returned = _header(response, "X-Request-ID")
    assert returned != "not-a-uuid"
    uuid.UUID(returned)  # a real UUID was generated instead


def test_valid_inbound_request_id_is_echoed(unauthed_client: TestClient) -> None:
    provided = str(uuid.uuid4())
    response = unauthed_client.get("/api/health", headers={"X-Request-ID": provided})
    assert _header(response, "X-Request-ID") == provided


@pytest.fixture(name="mini_app")
def mini_app_fixture() -> TestClient:
    """A minimal app wrapped in the middleware, with routes that simulate auth."""
    configure_logging("INFO", debug=False)
    app = FastAPI()

    @app.get("/collections/{collection_id}")
    def _read(collection_id: str, request: Request) -> dict[str, str]:
        request.state.user_id = f"user-{collection_id}"
        return {"collection_id": collection_id}

    @app.get("/boom")
    def _boom() -> dict[str, str]:
        raise RuntimeError("kaboom")

    app.add_middleware(RequestContextMiddleware)
    return TestClient(app, raise_server_exceptions=False)


def _completion_events() -> list[dict[str, object]]:
    return [
        r for r in get_log_buffer().snapshot() if r.get("event") == "http.request.completed"
    ]


def test_completion_event_logs_route_template_and_status(mini_app: TestClient) -> None:
    get_log_buffer().clear()
    mini_app.get("/collections/abc")
    events = _completion_events()
    assert events, "no completion event was recorded"
    event = events[-1]
    assert event["route"] == "/collections/{collection_id}"  # template, not the raw path
    assert event["status"] == 200
    assert event["method"] == "GET"
    assert isinstance(event["duration_ms"], (int, float))


def test_authenticated_requests_are_attributed_per_user(mini_app: TestClient) -> None:
    get_log_buffer().clear()
    mini_app.get("/collections/one")
    mini_app.get("/collections/two")
    user_ids = [e.get("user_id") for e in _completion_events()]
    assert "user-one" in user_ids
    assert "user-two" in user_ids


def test_unhandled_exception_emits_failure_event(mini_app: TestClient) -> None:
    get_log_buffer().clear()
    response = mini_app.get("/boom")
    assert response.status_code == 500
    assert _header(response, "X-Request-ID")  # header set even on failure
    failures = [r for r in get_log_buffer().snapshot() if r.get("event") == "http.request.failed"]
    assert failures
    assert "Traceback" in failures[-1]["exception"]  # type: ignore[operator]

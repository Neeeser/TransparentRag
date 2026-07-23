# Observability: logging, correlation, and diagnostics

Ragworks emits a small, structured operational log so a self-hosted operator can
diagnose a failure — connect it to a request, a user, and an operation — without
recording user content or secrets. It is not analytics, remote telemetry, or an
audit trail; pipeline traces and the telemetry table are separate features.

Logs are structured JSON written to **stdout only**. There are no
application-managed log files, rotation, retention settings, or log shipping —
the container/runtime operator owns collection and retention (12-factor). The
shared field contract below is pinned by `tests/assets/observability_contract.json`,
which both the pytest and vitest suites assert so the paired packages cannot
drift.

## Packages

- **Backend — `app/observability/`** owns JSON logging configuration
  (`config.py`), request-scoped context (`context.py`), the request middleware
  (`middleware.py`), redaction/sanitization (`redaction.py`), the export ring
  buffer (`buffer.py`), and the event vocabulary (`events.py`). Every module
  logs through `get_logger(__name__)` and emits named events; nothing configures
  logging, generates request IDs, or implements redaction itself.
- **Frontend — `frontend/src/lib/observability/`** owns request-ID
  generation/propagation through the centralized `apiFetch`, response-ID
  extraction onto `ApiError.requestId`, the client error buffer, and the user
  diagnostics report. It adds no analytics, action tracking, remote shipping, or
  payload capture — correlation only.

## Request correlation

Every request carries an `X-Request-ID`. The frontend mints one per API call and
sends it; the backend middleware honors a valid UUID (and regenerates anything
else, so untrusted input never reaches logs or headers) and returns it on the
response — including 500s, so a crash still gives the user a support reference.
The request ID is bound to the logging context and flows into every log emitted
while handling the request, including background work the request enqueues.

## Fields

Core fields on every record: `timestamp` (UTC ISO-8601), `level`, `logger`,
`event`. Contextual fields where applicable: `request_id`; `user_id` (the
authenticated user's internal UUID); operation fields `method`, `route` (the
route *template*, never the raw path), `status`, `duration_ms`; resource IDs
(`collection_id`, `document_id`, `pipeline_run_id`, `connection_id`, `provider`,
`index_backend`); and a classified, sanitized `error_type` / `error`.

`user_id` is opaque operational metadata, not a credential — it is **not hashed**
so the local operator can join it to their locally hosted database. It appears on
authenticated request-completion events and user-owned background work, and is
omitted on unauthenticated routes, health checks, startup/shutdown, and
infrastructure-only events.

## Never logged

Email addresses, usernames, passwords, API keys, authorization headers, JWTs,
cookies, session IDs, connection strings, request/response bodies, file paths or
names, document/chunk text, prompts, chat messages, search queries, and raw
provider payloads. The `redaction.py` processor enforces this as a safety net:
values under credential/PII-named keys become `[REDACTED]`, untrusted strings are
stripped of control characters (log-injection defense) and truncated, and this
runs in `DEBUG` too — `DEBUG` may add diagnostic metadata but never relaxes
redaction.

## Event vocabulary

Event names are stable, dotted, past-tense facts — `domain.action[.outcome]` —
and identifiers travel as structured fields, never interpolated into the message
string. The canonical names live in `app/observability/events.py` and in the
shared contract file. Instrumented flows: HTTP request completion/failure,
startup/shutdown, database bootstrap and migrations, authentication
success/failure, admin configuration changes (changed field *paths*, never
values), ingestion and pipeline-run start/completion/failure with durations and
resource IDs, provider/vector-store failures, and background-task failures.

## Diagnostics export

- **Admin** — `GET /api/admin/diagnostics/export` returns the in-memory ring
  buffer (recent redacted records) plus a metadata header. The admin settings
  page has a "Download diagnostics" button that saves it as JSON to attach to a
  bug report. The buffer is process-lifetime and restart-scoped; older history
  is in the container's stdout logs.
- **User** — a non-admin who hits an error sees the backend request ID (with a
  copy control) and can download a client-side error report (recent failed API
  calls and uncaught errors — request IDs and messages only, no bodies or
  tokens). The operator joins that request ID against the admin export or stdout
  logs.

## Configuration

`LOG_LEVEL` (bootstrap env var, Layer 1) sets the level; unset defaults to
`INFO`. `DEBUG=true` selects a pretty console renderer for local development;
production is always JSON. There is no runtime config for logging — it is
infrastructure, not application behavior.

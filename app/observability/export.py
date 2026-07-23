"""Builder for the admin diagnostics export bundle.

Assembles the in-memory ring buffer's redacted records with a metadata header
so the admin route stays a thin read. Nothing here reaches out to storage or a
file — the bundle is the process's recent stdout tail, held in memory.
"""

from __future__ import annotations

from app.core.config import get_settings
from app.observability.buffer import get_log_buffer
from app.schemas.observability import DiagnosticsBundle, DiagnosticsMetadata
from app.utils.time import utc_now

_NOTE = (
    "Recent backend log records from this server process, held in memory and "
    "already redacted. Older history is in the container's stdout logs "
    "(e.g. `docker logs`). No secrets or user content are included."
)


def build_diagnostics_bundle() -> DiagnosticsBundle:
    """Return the current log ring buffer plus a metadata header."""
    settings = get_settings()
    buffer = get_log_buffer()
    records = buffer.snapshot()
    metadata = DiagnosticsMetadata(
        generated_at=utc_now(),
        debug=settings.debug,
        log_level=settings.log_level,
        record_count=len(records),
        buffer_capacity=buffer.capacity,
        note=_NOTE,
    )
    return DiagnosticsBundle(metadata=metadata, records=records)

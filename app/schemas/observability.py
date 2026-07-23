"""Wire schemas for the diagnostics export bundle.

The admin "Download diagnostics" endpoint returns recent backend log records
(already redacted) plus a small metadata header describing the process the
bundle came from. Records are logged event dicts whose key set is deliberately
open-ended, so they pass through as ``dict[str, Any]``.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DiagnosticsMetadata(BaseModel):
    """Header describing the process a diagnostics bundle was exported from."""

    generated_at: datetime
    debug: bool
    log_level: str | None
    record_count: int
    buffer_capacity: int
    note: str


class DiagnosticsBundle(BaseModel):
    """Recent backend log records with an explanatory metadata header."""

    metadata: DiagnosticsMetadata
    records: list[dict[str, Any]]

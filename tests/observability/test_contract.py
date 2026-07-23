"""Pin the backend side of the shared observability contract.

The same `tests/assets/observability_contract.json` is asserted by vitest on
the frontend, so a rename on either side fails a gate instead of silently
drifting the two packages apart.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.observability import events
from app.observability.middleware import REQUEST_ID_HEADER
from app.observability.redaction import redact_processor

_CONTRACT = json.loads(
    (Path(__file__).resolve().parents[1] / "assets" / "observability_contract.json").read_text()
)


def test_request_id_header_matches_contract() -> None:
    assert REQUEST_ID_HEADER.lower() == _CONTRACT["request_id_header"].lower()


def test_every_contract_event_is_defined_in_the_events_module() -> None:
    defined = {
        value
        for name, value in vars(events).items()
        if name.isupper() and isinstance(value, str)
    }
    missing = [event for event in _CONTRACT["events"] if event not in defined]
    assert not missing, f"events module is missing contract events: {missing}"


def test_prohibited_substrings_are_redacted() -> None:
    for substring in _CONTRACT["prohibited_value_substrings"]:
        result = redact_processor(None, "info", {substring: "sensitive"})
        assert result[substring] == "[REDACTED]", f"{substring} was not redacted"

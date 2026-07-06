"""Usage aggregation helpers for chat responses."""

from __future__ import annotations

from typing import Any


def coerce_usage_value(value: object) -> int | None:
    """Coerce usage values into integer token counts when possible."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        try:
            return int(float(value))
        except ValueError:
            return None
    if isinstance(value, dict):
        total = 0
        has_component = False
        for nested in value.values():
            coerced = coerce_usage_value(nested)
            if coerced is not None:
                total += coerced
                has_component = True
        return total if has_component else None
    return None


def coerce_float_value(value: object) -> float | None:
    """Coerce numeric-like values into floats when possible."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def add_usage_value(aggregate: dict[str, float], key: str, value: float | None) -> None:
    """Accumulate usage metrics into the aggregate bucket."""
    if value is None:
        return
    aggregate[key] = aggregate.get(key, 0) + value


def extract_reasoning_tokens_from_usage(usage: dict[str, Any]) -> int | None:
    """Extract reasoning token counts from a usage payload."""
    if not usage:
        return None
    direct = coerce_usage_value(usage.get("reasoning_tokens"))
    if direct is not None:
        return direct
    details = usage.get("completion_tokens_details")
    if isinstance(details, dict):
        nested = coerce_usage_value(details.get("reasoning_tokens"))
        if nested is not None:
            return nested
    return None

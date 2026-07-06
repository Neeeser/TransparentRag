"""Template helpers for pipeline configuration values."""

from __future__ import annotations

from app.db import models

DEFAULT_NAMESPACE_TEMPLATE = "col-{collection_id}"


def resolve_collection_template(
    value: str | None,
    collection: models.Collection,
) -> str | None:
    """Resolve collection placeholders inside a template string."""
    if value is None:
        return None
    rendered = value
    rendered = rendered.replace("{collection_id}", str(collection.id))
    rendered = rendered.replace("{collection_name}", collection.name or "")
    rendered = rendered.replace("{user_id}", str(collection.user_id))
    return rendered

"""Prompt template rendering, split by responsibility.

- `templates.py` -- default templates, the per-scope variable catalogs
  (`app.schemas.prompts.PromptVariable`), and get/set helpers over the stored
  template string.
- `context.py` -- builds the `{{placeholder}} -> value` render context from
  domain models (`Collection`, `User`, resolved pipeline settings).
- `render.py` -- template substitution and `render_system_prompt`, the chat
  entrypoint that composes a user's base prompt with each enabled tool
  collection's system prompt (`PromptContext` model).

This module re-exports that split surface so `from app.services.prompts import
X` call sites (chat setup, collection service, prompt routes) don't change.
"""

from __future__ import annotations

from .context import base_prompt_context, collection_tool_name, system_prompt_context
from .render import PromptContext, apply_prompt_template, render_system_prompt
from .templates import (
    BASE_PROMPT_VARIABLES,
    COLLECTION_PROMPT_VARIABLES,
    DEFAULT_BASE_PROMPT_TEMPLATE,
    DEFAULT_SYSTEM_PROMPT_TEMPLATE,
    SYSTEM_PROMPT_METADATA_KEY,
    get_base_prompt_template,
    get_system_prompt_template,
    is_base_prompt_custom,
    is_collection_prompt_custom,
    prompt_variables_payload,
    with_system_prompt_template,
)

__all__ = [
    "BASE_PROMPT_VARIABLES",
    "COLLECTION_PROMPT_VARIABLES",
    "DEFAULT_BASE_PROMPT_TEMPLATE",
    "DEFAULT_SYSTEM_PROMPT_TEMPLATE",
    "SYSTEM_PROMPT_METADATA_KEY",
    "PromptContext",
    "apply_prompt_template",
    "base_prompt_context",
    "collection_tool_name",
    "get_base_prompt_template",
    "get_system_prompt_template",
    "is_base_prompt_custom",
    "is_collection_prompt_custom",
    "prompt_variables_payload",
    "render_system_prompt",
    "system_prompt_context",
    "with_system_prompt_template",
]

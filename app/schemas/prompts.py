"""Schema models for prompt templates."""

from __future__ import annotations

from pydantic import BaseModel


class PromptVariable(BaseModel):
    """Template variable used in prompts."""

    name: str
    description: str
    example: str | None = None


class PromptTemplateRead(BaseModel):
    """Prompt template data returned to clients."""

    template: str
    rendered: str
    context: dict[str, str]
    variables: list[PromptVariable]
    is_custom: bool = False


class PromptTemplateUpdate(BaseModel):
    """Payload for updating a prompt template."""

    template: str | None = None

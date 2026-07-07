"""User account table and the shared timestamp mixin every table inherits."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, Column, String, Text
from sqlmodel import Field, SQLModel

from app.schemas.enums import UserRole
from app.utils.time import utc_now


class TimestampMixin:  # pylint: disable=too-few-public-methods
    """Shared timestamp fields for SQLModel tables.

    `updated_at` carries an `onupdate` so SQLAlchemy refreshes it on every
    UPDATE statement automatically -- call sites must not set it manually.
    """

    created_at: datetime = Field(default_factory=utc_now, nullable=False)
    updated_at: datetime = Field(
        default_factory=utc_now,
        nullable=False,
        sa_column_kwargs={"onupdate": utc_now},
    )


class User(SQLModel, TimestampMixin, table=True):
    """User account record."""

    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    email: str = Field(sa_column=Column(String, unique=True, index=True, nullable=False))
    full_name: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    hashed_password: str = Field(sa_column=Column(String, nullable=False))
    openrouter_api_key: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    pinecone_api_key: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    system_prompt_template: str | None = Field(
        default=None,
        sa_column=Column(Text, nullable=True),
    )
    last_used_chat_model: str | None = Field(
        default=None,
        sa_column=Column(String, nullable=True),
    )
    last_used_parameters: dict[str, Any] | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    last_used_provider: dict[str, Any] | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    last_used_stream: bool | None = Field(
        default=None,
        sa_column=Column(Boolean, nullable=True),
    )
    last_used_tool_collection_ids: list[str] | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    run_settings_order: list[str] | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    is_active: bool = Field(default=True, nullable=False)
    role: str = Field(
        default=UserRole.USER.value,
        sa_column=Column(String, nullable=False, server_default=UserRole.USER.value),
    )

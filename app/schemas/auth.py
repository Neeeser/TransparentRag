"""Authentication-related schema models."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.base import DateTimeConfigMixin


class UserBase(DateTimeConfigMixin, BaseModel):
    """Shared fields for user payloads."""

    model_config = ConfigDict(**DateTimeConfigMixin.model_config, from_attributes=True)

    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    """Payload for creating a user."""

    password: str = Field(min_length=8)


class UserRead(UserBase):
    """User data returned to clients."""

    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


class Token(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    """Credentials payload for login."""

    email: EmailStr
    password: str

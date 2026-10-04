"""Typed backend settings."""

from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from vacation_window_planner.database import normalize_database_url
from vacation_window_planner.domain.annual_budget import AnnualPolicy


class Settings(BaseSettings):
    annual_policy: AnnualPolicy = Field(default_factory=AnnualPolicy)
    model_config = SettingsConfigDict(extra="ignore")

    database_url: str
    interpret_provider: Literal["gemini", "xai"] = "gemini"
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-2.5-flash"
    xai_api_key: SecretStr | None = None
    xai_model: str = "grok-4.3"
    cors_origins: tuple[str, ...] = ("http://localhost:15173",)
    max_request_bytes: int = Field(default=65_536, ge=1_024, le=1_048_576)
    session_expiry_days: int = Field(default=30, ge=1, le=365)
    source_text_retention_days: int = Field(default=30, ge=0, le=365)

    @field_validator("database_url")
    @classmethod
    def database_url_must_be_postgresql(cls, value: str) -> str:
        return normalize_database_url(value)

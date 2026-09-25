"""Typed backend settings."""

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    database_url: str
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-2.5-flash"
    cors_origins: tuple[str, ...] = ("http://localhost:15173",)
    max_request_bytes: int = Field(default=65_536, ge=1_024, le=1_048_576)
    session_expiry_days: int = Field(default=30, ge=1, le=365)
    source_text_retention_days: int = Field(default=30, ge=0, le=365)

    @field_validator("database_url")
    @classmethod
    def database_url_must_be_postgresql(cls, value: str) -> str:
        try:
            url = make_url(value)
        except ArgumentError as error:
            raise ValueError("DATABASE_URL must be a PostgreSQL URL") from error
        if url.drivername != "postgresql+psycopg" or not url.host or not url.database:
            raise ValueError("DATABASE_URL must be a PostgreSQL URL")
        return value

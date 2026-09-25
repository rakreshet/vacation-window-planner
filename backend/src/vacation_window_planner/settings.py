"""Typed backend settings."""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    database_url: str

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

"""Immutable values shared across domain contracts."""

from pydantic import BaseModel, ConfigDict


class DomainValue(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

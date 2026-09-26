"""Versioned, typed policy for Phase 0 recommendation behavior."""

from typing import Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class RecommendationPolicy(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RECOMMENDATION_", extra="ignore", frozen=True)

    efficiency_weight: float = Field(default=0.5, gt=0, le=1)
    duration_weight: float = Field(default=0.3, gt=0, le=1)
    length_fit_weight: float = Field(default=0.2, gt=0, le=1)
    generation_cap: int = Field(default=5000, ge=1, le=100_000)
    length_tolerance_days: int = Field(default=2, ge=0, le=7)
    near_duplicate_overlap_ratio: float = Field(default=0.8, ge=0, le=1)
    material_score_gap: int = Field(default=5, ge=0, le=100)
    default_result_count: int = Field(default=5, ge=1, le=20)
    engine_version: str = Field(default="phase0-v1", min_length=1)

    @model_validator(mode="after")
    def scoring_weights_must_sum_to_one(self) -> Self:
        total = self.efficiency_weight + self.duration_weight + self.length_fit_weight
        if abs(total - 1.0) > 1e-6:
            raise ValueError("scoring weights must sum to 1")
        return self

"""Recommendation policy at its public configuration boundary."""

import pytest
from pydantic import ValidationError

from vacation_window_planner.domain.policy import RecommendationPolicy


def test_policy_has_safe_versioned_defaults_for_a_search_snapshot() -> None:
    policy = RecommendationPolicy(_env_file=None)

    assert policy.model_dump(mode="json") == {
        "efficiency_weight": 0.5,
        "duration_weight": 0.3,
        "length_fit_weight": 0.2,
        "generation_cap": 5000,
        "near_duplicate_overlap_ratio": 0.8,
        "material_score_gap": 5,
        "default_result_count": 5,
        "engine_version": "phase0-v1",
    }


def test_environment_overrides_are_captured_in_the_effective_policy(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RECOMMENDATION_GENERATION_CAP", "42")
    monkeypatch.setenv("RECOMMENDATION_DEFAULT_RESULT_COUNT", "7")

    policy = RecommendationPolicy(_env_file=None)

    assert policy.model_dump(mode="json")["generation_cap"] == 42
    assert policy.model_dump(mode="json")["default_result_count"] == 7


@pytest.mark.parametrize(
    "override",
    [
        {"generation_cap": 0},
        {"default_result_count": 0},
        {"default_result_count": 21},
        {"near_duplicate_overlap_ratio": 1.5},
        {"efficiency_weight": 0.9},
        {"engine_version": ""},
    ],
)
def test_policy_rejects_unsafe_overrides(override: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        RecommendationPolicy(_env_file=None, **override)

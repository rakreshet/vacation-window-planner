from datetime import date

import pytest
from pydantic import ValidationError

from vacation_window_planner.domain.comparison import ComparisonInput, ComparisonPolicy


def test_exact_dates_require_no_search_month_or_preferred_length() -> None:
    value = ComparisonInput(start_date="2027-01-03", end_date="2027-01-07")
    assert value.start_date == date(2027, 1, 3)
    assert value.source_search_id is None
    with pytest.raises(ValidationError):
        ComparisonInput(start_date="2027-01-07", end_date="2027-01-03")
    with pytest.raises(ValidationError):
        ComparisonInput(start_date="2027-01-03", end_date="2027-01-07", shift_days=1000)


def test_comparison_policy_bounds_enumeration_and_visible_results() -> None:
    policy = ComparisonPolicy(_env_file=None)
    assert (policy.shift_days, policy.extra_days, policy.max_length_days, policy.result_limit) == (
        21,
        7,
        28,
        3,
    )
    with pytest.raises(ValidationError):
        ComparisonPolicy(_env_file=None, shift_days=-1)

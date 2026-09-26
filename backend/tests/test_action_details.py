from datetime import date
from uuid import UUID

import pytest

from vacation_window_planner.domain.action_details import (
    ActionDetailsTooLarge,
    attach_action_details,
)
from vacation_window_planner.domain.assessment import prepare_calendar
from vacation_window_planner.domain.contracts import (
    HolidayCalendar,
    Recommendation,
    UserVacationContext,
    VacationWindow,
)


def test_action_details_reject_the_complete_response_before_expanding_dates() -> None:
    start, end = date.fromordinal(1), date.fromordinal(6001)
    context = UserVacationContext(
        session_id=UUID(int=1), balance_days=7000, country_code="IL", weekend_days=frozenset()
    )
    prepared = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days=frozenset()), context, (start, end), start
    )
    recommendation = Recommendation(
        window=VacationWindow(
            start_date=start, end_date=end, total_days=6001, vacation_days_used=6001
        ),
        rank=1,
        score=50,
        explanation="A long break",
        remaining_balance=999,
    )
    with pytest.raises(ActionDetailsTooLarge):
        attach_action_details((recommendation,), prepared)

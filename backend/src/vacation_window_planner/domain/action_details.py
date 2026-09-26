from vacation_window_planner.domain.assessment import (
    PreparedCalendar,
    WindowAssessment,
    assess_window,
)
from vacation_window_planner.domain.contracts import Recommendation


class ActionDetailsTooLarge(ValueError):
    pass


class ActionableRecommendation(Recommendation):
    assessment: WindowAssessment
    alternative_assessments: tuple[WindowAssessment, ...]


def attach_action_details(
    recommendations: tuple[Recommendation, ...], prepared: PreparedCalendar
) -> tuple[ActionableRecommendation, ...]:
    returned_date_count = sum(
        window.total_days
        for recommendation in recommendations
        for window in (recommendation.window, *recommendation.alternative_windows)
    )
    if returned_date_count > 6000:
        raise ActionDetailsTooLarge(
            "Reduce break length or result count to include complete action details"
        )
    return tuple(
        ActionableRecommendation(
            **recommendation.model_dump(),
            assessment=assess_window(
                recommendation.window.start_date, recommendation.window.end_date, prepared
            ),
            alternative_assessments=tuple(
                assess_window(window.start_date, window.end_date, prepared)
                for window in recommendation.alternative_windows
            ),
        )
        for recommendation in recommendations
    )

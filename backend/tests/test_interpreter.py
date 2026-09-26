"""Constraint interpretation proposes validated fields without searching."""

import pydantic_ai.models
import pytest
from pydantic import ValidationError
from pydantic_ai.models.test import TestModel

from vacation_window_planner.interpreter import (
    ConstraintInterpreter,
    InterpretationError,
    InterpretationInput,
    ModelProposalFields,
)


def test_valid_model_output_becomes_editable_typed_proposal() -> None:
    interpreter = ConstraintInterpreter(
        TestModel(
            custom_output_args={
                "balance_days": 8,
                "allowed_negative_days": 1,
                "country_code": "IL",
                "months": [{"year": 2027, "month": 1}],
                "preferred_length_days": 7,
            }
        )
    )

    proposal = interpreter.interpret("I have 8 days and want a week in January")

    assert proposal.balance_days == 8
    assert proposal.allowed_negative_days == 1
    assert proposal.country_code == "IL"
    assert proposal.months[0].month == 1
    assert proposal.preferred_length_days == 7
    assert proposal.weekend_days == frozenset({4, 5})
    assert proposal.missing_fields == ()
    assert proposal.source_text == "I have 8 days and want a week in January"


def test_israel_workweek_is_derived_after_model_output() -> None:
    interpreter = ConstraintInterpreter(TestModel(custom_output_args={"country_code": "IL"}))

    proposal = interpreter.interpret("I work Sunday through Thursday in Israel")

    assert proposal.weekend_days == frozenset({4, 5})


def test_non_israel_workweek_uses_monday_through_friday() -> None:
    interpreter = ConstraintInterpreter(TestModel(custom_output_args={"country_code": "GB"}))

    proposal = interpreter.interpret("I live in the UK")

    assert proposal.weekend_days == frozenset({5, 6})


def test_missing_country_does_not_override_editable_weekend_selection() -> None:
    proposal = ConstraintInterpreter(TestModel(custom_output_args={})).interpret("Next year")

    assert proposal.weekend_days is None


def test_model_schema_forbids_untrusted_weekend_days() -> None:
    with pytest.raises(ValidationError):
        ModelProposalFields.model_validate({"country_code": "IL", "weekend_days": [5, 6]})


@pytest.mark.parametrize("text", ["", "x" * 4001])
def test_interpreter_rejects_invalid_input_before_calling_model(text: str) -> None:
    with pytest.raises(ValidationError):
        InterpretationInput(text=text)


def test_real_model_requests_are_disabled_for_all_backend_tests() -> None:
    assert pydantic_ai.models.ALLOW_MODEL_REQUESTS is False


def test_missing_output_fields_are_reported_for_editing() -> None:
    proposal = ConstraintInterpreter(TestModel(custom_output_args={})).interpret(
        "Sometime next year"
    )

    assert proposal.missing_fields == (
        "balance_days",
        "country_code",
        "months",
        "preferred_length_days",
    )


def test_out_of_policy_model_output_is_rejected() -> None:
    interpreter = ConstraintInterpreter(
        TestModel(custom_output_args={"balance_days": 8, "allowed_negative_days": 10})
    )

    with pytest.raises(InterpretationError):
        interpreter.interpret("Let me borrow ten days")


def test_past_months_from_model_are_never_returned() -> None:
    from datetime import UTC, datetime

    interpreter = ConstraintInterpreter(
        TestModel(custom_output_args={"months": [{"year": 2025, "month": 4}]}),
        clock=lambda: datetime(2026, 9, 26, tzinfo=UTC),
    )
    with pytest.raises(InterpretationError):
        interpreter.interpret("next April")


def test_current_date_context_and_retry_correct_a_stale_relative_month() -> None:
    from datetime import UTC, datetime

    from pydantic_ai.messages import ModelResponse, RetryPromptPart, ToolCallPart
    from pydantic_ai.models.function import FunctionModel

    calls = 0

    def model(messages, info):
        nonlocal calls
        calls += 1
        assert "Current local date: 2026-09-26" in info.instructions
        assert "Next year: 2027" in info.instructions
        assert "next April" in info.instructions
        if calls == 2:
            assert any(
                isinstance(part, RetryPromptPart) for message in messages for part in message.parts
            )
        return ModelResponse(
            parts=[
                ToolCallPart(
                    info.output_tools[0].name,
                    {"months": [{"year": 2025 if calls == 1 else 2027, "month": 4}]},
                )
            ]
        )

    interpreter = ConstraintInterpreter(
        FunctionModel(model), clock=lambda: datetime(2026, 9, 26, tzinfo=UTC)
    )
    proposal = interpreter.interpret("I want a 12 day vacation next year in April")
    assert proposal.months[0].year == 2027
    assert proposal.months[0].month == 4
    assert calls == 2


def test_request_time_zone_controls_the_reference_month_at_midnight() -> None:
    from datetime import UTC, datetime

    now = datetime(2026, 9, 30, 22, 30, tzinfo=UTC)
    interpreter = ConstraintInterpreter(
        TestModel(custom_output_args={"months": [{"year": 2026, "month": 9}]}),
        clock=lambda: now,
    )
    # September is still current in Los Angeles, but already past in Jerusalem.
    assert interpreter.interpret(
        InterpretationInput(text="this month", time_zone="America/Los_Angeles")
    ).months
    with pytest.raises(InterpretationError):
        interpreter.interpret(InterpretationInput(text="this month", time_zone="Asia/Jerusalem"))

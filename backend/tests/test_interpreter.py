"""Constraint interpretation proposes validated fields without searching."""

import pytest
from pydantic_ai.models.test import TestModel

from vacation_window_planner.interpreter import ConstraintInterpreter, InterpretationError


def test_valid_model_output_becomes_editable_typed_proposal() -> None:
    interpreter = ConstraintInterpreter(
        TestModel(
            custom_output_args={
                "balance_days": 8,
                "allowed_negative_days": 1,
                "country_code": "IL",
                "months": [{"year": 2027, "month": 1}],
                "preferred_length_days": 7,
                "weekend_days": [4, 5],
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

"""Constraint interpretation validates model output without searching."""

import pytest

from vacation_window_planner.interpreter import (
    GeminiConstraintInterpreter,
    InterpretationError,
)


class FixtureGeminiClient:
    def __init__(self, response: str) -> None:
        self.response = response

    def generate_json(self, prompt: str, schema: dict[str, object]) -> str:
        assert "vacation search" in prompt.lower()
        assert schema["type"] == "object"
        return self.response


def test_valid_model_output_becomes_editable_typed_proposal() -> None:
    interpreter = GeminiConstraintInterpreter(
        FixtureGeminiClient(
            """{
                "balance_days": 8,
                "allowed_negative_days": 1,
                "country_code": "IL",
                "months": [{"year": 2027, "month": 1}],
                "preferred_length_days": 7,
                "weekend_days": [4, 5]
            }"""
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
    proposal = GeminiConstraintInterpreter(FixtureGeminiClient("{}")).interpret(
        "Sometime next year"
    )

    assert proposal.missing_fields == (
        "balance_days",
        "country_code",
        "months",
        "preferred_length_days",
    )


def test_malformed_or_out_of_policy_model_output_is_rejected() -> None:
    interpreter = GeminiConstraintInterpreter(
        FixtureGeminiClient('{"balance_days": 8, "allowed_negative_days": 10}')
    )

    with pytest.raises(InterpretationError, match="validated"):
        interpreter.interpret("Let me borrow ten days")

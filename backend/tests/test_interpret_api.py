"""Interpretation endpoint remains separate from recommendation search."""

from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from vacation_window_planner.api import create_app
from vacation_window_planner.interpreter import (
    ConstraintInterpreter,
    ConstraintProposal,
    InterpretationError,
)


def test_interpret_returns_proposal_without_starting_search() -> None:
    searches = 0

    def recommendation_service(_request: object) -> object:
        nonlocal searches
        searches += 1
        raise AssertionError("interpretation must not start a search")

    client = TestClient(
        create_app(
            database_probe=lambda: True,
            recommendation_service=recommendation_service,
            interpretation_service=lambda text: ConstraintProposal(
                source_text=text,
                balance_days=8,
                country_code="IL",
                months=(),
                preferred_length_days=7,
                missing_fields=("months",),
            ),
        )
    )

    response = client.post("/interpret", json={"text": "A week in winter"})

    assert response.status_code == 200
    assert response.json()["source_text"] == "A week in winter"
    assert response.json()["missing_fields"] == ["months"]
    assert searches == 0


def test_interpret_is_optional_while_structured_endpoint_remains_registered() -> None:
    client = TestClient(create_app(database_probe=lambda: True))

    response = client.post("/interpret", json={"text": "A week in winter"})

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "INTERPRETATION_UNAVAILABLE"
    assert any(route.path == "/recommendations" for route in client.app.routes)


def test_provider_failure_does_not_expose_details() -> None:
    def failed_interpretation(_text: str) -> ConstraintProposal:
        raise InterpretationError("sensitive provider response")

    client = TestClient(
        create_app(database_probe=lambda: True, interpretation_service=failed_interpretation)
    )

    response = client.post("/interpret", json={"text": "A week in winter"})

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "INTERPRETATION_ERROR"
    assert "sensitive provider response" not in response.text


def test_interpret_api_uses_validated_model_output_and_country_workweek() -> None:
    interpreter = ConstraintInterpreter(
        TestModel(
            custom_output_args={
                "balance_days": 6,
                "country_code": "IL",
                "months": [{"year": 2026, "month": 10}],
                "preferred_length_days": 9,
            }
        )
    )
    client = TestClient(
        create_app(database_probe=lambda: True, interpretation_service=interpreter.interpret)
    )

    response = client.post(
        "/interpret", json={"text": "Use the Israel calendar and Sunday-to-Thursday workweek"}
    )

    assert response.status_code == 200
    assert response.json()["weekend_days"] == [4, 5]
    assert response.json()["country_code"] == "IL"


def test_interpret_api_rejects_invalid_input_before_model_call() -> None:
    def interpretation_service(_text: str) -> ConstraintProposal:
        raise AssertionError("model must not run for invalid input")

    client = TestClient(
        create_app(
            database_probe=lambda: True,
            interpretation_service=interpretation_service,
        )
    )

    response = client.post("/interpret", json={"text": ""})

    assert response.status_code == 422

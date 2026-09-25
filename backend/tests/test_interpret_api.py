"""Interpretation endpoint remains separate from recommendation search."""

from fastapi.testclient import TestClient

from vacation_window_planner.api import create_app
from vacation_window_planner.interpreter import ConstraintProposal, InterpretationError


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

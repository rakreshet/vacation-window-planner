from datetime import date

from pydantic_ai.models.test import TestModel

from vacation_window_planner.annual_interpreter import AnnualInterpretationInput, AnnualInterpreter


def test_annual_interpretation_keeps_absent_fields_distinct_from_zero_and_empty() -> None:
    interpreter = AnnualInterpreter(
        TestModel(
            custom_output_args={
                "reserve_days": 0,
                "allowed_start_months": [],
                "references": [{"description": "my August trip"}],
            }
        )
    )

    proposal = interpreter.interpret(
        AnnualInterpretationInput(
            text="Keep my August trip and no reserve", year=2027, local_today=date(2026, 9, 26)
        )
    )

    assert proposal.model_dump(mode="json", exclude_none=True) == {
        "reserve_days": 0,
        "allowed_start_months": [],
        "references": [{"description": "my August trip"}],
        "assumptions": [],
    }


def test_explicit_mix_dates_and_budget_become_bounded_proposals() -> None:
    interpreter = AnnualInterpreter(
        TestModel(
            custom_output_args={
                "year": 2027,
                "available_days": 18,
                "minimum_gap_days": 7,
                "slots": [
                    {"label": "Long", "min_days": 7, "max_days": 14},
                    {"label": "Short", "min_days": 3, "max_days": 5},
                    {
                        "label": "Arranged",
                        "min_days": 2,
                        "max_days": 2,
                        "locked_dates": {"start_date": "2027-08-06", "end_date": "2027-08-07"},
                    },
                ],
                "assumptions": ["Long means 7–14 days; short means 3–5 days"],
            }
        )
    )

    proposal = interpreter.interpret(
        AnnualInterpretationInput(
            text="In 2027 I have 18 days; long, short and August 6–7",
            year=2027,
            local_today=date(2026, 9, 26),
        )
    )

    assert proposal.year == 2027
    assert proposal.available_days == 18
    assert proposal.minimum_gap_days == 7
    assert proposal.slots is not None
    assert [(slot.min_days, slot.max_days) for slot in proposal.slots] == [(7, 14), (3, 5), (2, 2)]
    assert proposal.slots[2].locked_dates is not None
    assert proposal.slots[2].locked_dates.start_date == date(2027, 8, 6)


def test_http_annual_patch_excludes_unspecified_values_and_never_runs_planning() -> None:
    from fastapi.testclient import TestClient

    from vacation_window_planner.annual_workflow import AnnualPlanningRequest, AnnualRun
    from vacation_window_planner.api import create_app

    def forbidden_plan(request: AnnualPlanningRequest) -> AnnualRun:
        raise AssertionError("Interpretation cannot calculate")

    interpreter = AnnualInterpreter(TestModel(custom_output_args={"reserve_days": 0}))
    client = TestClient(
        create_app(
            database_probe=lambda: True,
            annual_service=forbidden_plan,
            annual_interpretation_service=interpreter.interpret,
        )
    )
    response = client.post(
        "/annual-plans/interpret",
        json={"text": "No reserve", "year": 2027, "local_today": "2026-09-26"},
    )
    assert response.status_code == 200
    assert response.json() == {"reserve_days": 0, "references": [], "assumptions": []}


def test_annual_provider_selection_is_optional_and_uses_configured_provider() -> None:
    from vacation_window_planner.annual_interpreter import build_annual_interpreter
    from vacation_window_planner.settings import Settings

    assert (
        build_annual_interpreter(Settings(database_url="postgresql+psycopg://user:pass@db/app"))
        is None
    )
    assert (
        build_annual_interpreter(
            Settings(
                database_url="postgresql+psycopg://user:pass@db/app",
                interpret_provider="xai",
                xai_api_key="test-key",
            )
        )
        is not None
    )


def test_annual_interpretation_rejects_invalid_provider_fields() -> None:
    import pytest

    from vacation_window_planner.interpreter import InterpretationError

    for invalid in (
        {"available_days": 367},
        {"allowed_start_months": [13]},
        {"slots": [{"label": "Reversed", "min_days": 9, "max_days": 3}]},
        {"country_code": "US"},
    ):
        interpreter = AnnualInterpreter(TestModel(custom_output_args=invalid))
        with pytest.raises(InterpretationError):
            interpreter.interpret(
                AnnualInterpretationInput(
                    text="Change this", year=2027, local_today=date(2026, 9, 26)
                )
            )


def test_annual_http_failure_and_input_validation_keep_details_private() -> None:
    from fastapi.testclient import TestClient

    from vacation_window_planner.annual_interpreter import AnnualProposal
    from vacation_window_planner.api import create_app
    from vacation_window_planner.interpreter import InterpretationError

    def failing(request: AnnualInterpretationInput) -> AnnualProposal:
        raise InterpretationError("private provider error")

    body = {"text": "Interpret", "year": 2027, "local_today": "2026-09-26"}
    optional = TestClient(create_app(database_probe=lambda: True))
    assert optional.post("/annual-plans/interpret", json=body).status_code == 503
    client = TestClient(
        create_app(database_probe=lambda: True, annual_interpretation_service=failing)
    )
    failed = client.post("/annual-plans/interpret", json=body)
    assert failed.status_code == 502
    assert "private" not in failed.text
    assert (
        client.post("/annual-plans/interpret", json={**body, "text": "x" * 4001}).status_code == 422
    )

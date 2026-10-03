from datetime import date

from test_annual_api import AnnualApi
from test_annual_api import annual_api as annual_api

from vacation_window_planner.domain.calendar import FakeCalendarProvider

MAY_REQUEST = {
    "year": 2027,
    "allowed_start_months": [5],
    "slots": [{"slot_id": "break", "min_days": 3, "max_days": 14}],
}
BUDGET_CONTEXT = {
    "balance_days": 4,
    "country_code": "GB",
    "weekend_days": [5, 6],
    "time_zone": "Europe/London",
}


def test_authenticated_comparison_uses_the_session_budget_and_one_sanitized_context(
    annual_api: AnnualApi,
) -> None:
    client, main = annual_api
    main.calendar_provider = FakeCalendarProvider({"GB": frozenset({date(2027, 5, 3)})})
    owner = client.post("/sessions", json=BUDGET_CONTEXT).json()
    response = client.post(
        "/annual-plans/budget-comparison",
        json=MAY_REQUEST,
        headers={"Authorization": f"Bearer {owner['token']}"},
    )
    assert response.status_code == 200
    comparison = response.json()
    assert comparison["baseline_days"] == 4
    assert [
        (
            scenario["available_days"],
            scenario["outcome"]["plans"][0]["accounting"]["total_days_away"],
        )
        for scenario in comparison["scenarios"]
    ] == [(3, 6), (4, 9), (5, 10)]
    assert comparison["calculation_context"]["planning"]["balance_days"] == 4
    assert comparison["calculation_context"]["local_today"] == "2026-09-26"
    assert "session_id" not in comparison["calculation_context"]["planning"]
    assert "run_id" not in comparison


def test_invalid_comparison_body_uses_annual_field_validation(annual_api: AnnualApi) -> None:
    client, _ = annual_api
    owner = client.post("/sessions", json=BUDGET_CONTEXT).json()
    response = client.post(
        "/annual-plans/budget-comparison",
        json={"year": 2027, "slots": []},
        headers={"Authorization": f"Bearer {owner['token']}"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_ANNUAL_PLAN"
    assert "body.slots" in response.json()["error"]["fields"]


def test_comparison_resolves_one_calendar_and_captures_local_today_once(
    annual_api: AnnualApi, monkeypatch
) -> None:
    from datetime import timedelta

    from test_annual_api import NOW

    client, main = annual_api
    requested = []
    moments = iter((NOW, NOW + timedelta(days=1)))

    class RecordingCalendar(FakeCalendarProvider):
        def resolve(self, country_code, start_date, end_date, weekend_override=None):
            requested.append((country_code, start_date, end_date, weekend_override))
            return super().resolve(country_code, start_date, end_date, weekend_override)

    monkeypatch.setattr(main, "calendar_provider", RecordingCalendar())
    monkeypatch.setattr(main, "utc_now", lambda: next(moments))
    owner = client.post("/sessions", json=BUDGET_CONTEXT).json()
    response = client.post(
        "/annual-plans/budget-comparison",
        json=MAY_REQUEST,
        headers={"Authorization": f"Bearer {owner['token']}"},
    )
    assert response.status_code == 200
    comparison = response.json()
    assert requested == [("GB", date(2027, 1, 1), date(2027, 12, 31), frozenset({5, 6}))]
    assert comparison["calculation_context"]["calculated_at"] == "2026-09-26T22:00:00Z"
    assert comparison["calculation_context"]["local_today"] == "2026-09-26"
    calendars = [scenario["outcome"]["year_calendar"] for scenario in comparison["scenarios"]]
    assert calendars[0] == calendars[1] == calendars[2]


def test_budget_comparison_requires_an_active_session_and_rejects_invalid_context(
    annual_api: AnnualApi,
) -> None:
    client, _ = annual_api
    for headers in ({}, {"Authorization": "Bearer invalid"}):
        assert (
            client.post(
                "/annual-plans/budget-comparison", json=MAY_REQUEST, headers=headers
            ).status_code
            == 401
        )
    owner = client.post("/sessions", json={**BUDGET_CONTEXT, "allowed_negative_days": 1}).json()
    response = client.post(
        "/annual-plans/budget-comparison",
        json=MAY_REQUEST,
        headers={"Authorization": f"Bearer {owner['token']}"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["fields"] == ["context.allowed_negative_days"]

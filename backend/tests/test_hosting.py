"""Public routing preserves the existing API's authentication and error contracts."""

from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from vacation_window_planner.api import create_app
from vacation_window_planner.hosting import create_public_app
from vacation_window_planner.workflow import RecommendationResult


def public_client() -> TestClient:
    return TestClient(create_public_app(create_app(database_probe=lambda: True)))


def test_public_health_uses_same_origin_api_prefix() -> None:
    response = public_client().get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


def test_unknown_api_route_is_not_a_frontend_page() -> None:
    response = public_client().get("/api/unknown")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.parametrize("route", ["/api/annual-plans", "/api/annual-plans/budget-comparison"])
def test_mounted_annual_validation_keeps_its_error_code(route: str) -> None:
    response = public_client().post(route, json={})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_ANNUAL_PLAN"


def test_public_api_keeps_request_size_limit() -> None:
    response = public_client().post("/api/sessions", content="x" * 65_537)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_TOO_LARGE"


def test_public_recommendations_still_require_a_session_token() -> None:
    api = create_app(
        database_probe=lambda: True,
        session_lookup=lambda _token, _now: None,
        recommendation_service=lambda _request: RecommendationResult(
            search_id=UUID(int=0), recommendations=()
        ),
    )
    client = TestClient(create_public_app(api))
    response = client.post(
        "/api/recommendations",
        json={
            "months": [{"year": 2027, "month": 1}],
            "preferred_length_days": 5,
            "result_limit": 5,
            "source_text": None,
        },
    )
    assert response.status_code == 401


def test_frontend_files_and_navigation_fallback_preserve_api_routes(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<html>Vacation planner</html>")
    (tmp_path / "style.css").write_text("body { color: blue; }")
    api = create_app(database_probe=lambda: True)
    client = TestClient(create_public_app(api, frontend_directory=tmp_path))

    assert client.get("/").text == "<html>Vacation planner</html>"
    assert (
        client.get("/saved-options", headers={"Accept": "text/html"}).text
        == "<html>Vacation planner</html>"
    )
    assert client.get("/style.css").text == "body { color: blue; }"
    assert client.get("/missing.css").status_code == 404
    assert client.get("/api/health").json()["database"] == "connected"
    unknown_api = client.get("/api/unknown")
    assert unknown_api.status_code == 404
    assert unknown_api.json()["error"]["code"] == "NOT_FOUND"

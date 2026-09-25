from fastapi.testclient import TestClient

from vacation_window_planner.api import create_app


def test_health_reports_ready_when_database_is_reachable() -> None:
    client = TestClient(create_app(database_probe=lambda: True))

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


def test_health_reports_unavailable_when_database_is_unreachable() -> None:
    client = TestClient(create_app(database_probe=lambda: False))

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "disconnected"}


def test_unknown_endpoint_returns_a_stable_error_envelope() -> None:
    client = TestClient(create_app(database_probe=lambda: True))

    response = client.get("/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"error": {"code": "NOT_FOUND", "message": "Not found", "fields": []}}

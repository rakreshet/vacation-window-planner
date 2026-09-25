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

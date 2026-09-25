"""HTTP entry point for the backend."""

from collections.abc import Callable

from fastapi import FastAPI, Response, status


def create_app(database_probe: Callable[[], bool]) -> FastAPI:
    app = FastAPI(title="Vacation Window Planner")

    @app.get("/health")
    def health(response: Response) -> dict[str, str]:
        if database_probe():
            return {"status": "ok", "database": "connected"}
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable", "database": "disconnected"}

    return app

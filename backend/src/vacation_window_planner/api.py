"""HTTP entry point for the backend."""

from collections.abc import Callable

from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def create_app(database_probe: Callable[[], bool]) -> FastAPI:
    app = FastAPI(title="Vacation Window Planner")

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_request: Request, error: StarletteHTTPException) -> JSONResponse:
        is_not_found = error.status_code == status.HTTP_404_NOT_FOUND
        return JSONResponse(
            status_code=error.status_code,
            content={
                "error": {
                    "code": "NOT_FOUND" if is_not_found else "HTTP_ERROR",
                    "message": "Not found" if is_not_found else str(error.detail),
                    "fields": [],
                }
            },
        )

    @app.get("/health")
    def health(response: Response) -> dict[str, str]:
        if database_probe():
            return {"status": "ok", "database": "connected"}
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable", "database": "disconnected"}

    return app

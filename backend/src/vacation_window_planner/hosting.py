"""Same-origin frontend and API routing for the public deployment."""

from pathlib import Path

from fastapi import FastAPI


def create_public_app(api_app: FastAPI, *, frontend_directory: Path | None = None) -> FastAPI:
    app = FastAPI(title="Vacation Window Planner", docs_url=None, redoc_url=None, openapi_url=None)
    app.mount("/api", api_app)
    if frontend_directory is not None:
        # Vercel generates the directory during its build and promotes it to the CDN.
        app.frontend("/", directory=frontend_directory, fallback="index.html", check_dir=False)
    return app

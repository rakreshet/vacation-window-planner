"""Vercel entrypoint; the local Docker app keeps its existing entrypoint."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend" / "src"))

from vacation_window_planner.hosting import create_public_app  # noqa: E402
from vacation_window_planner.main import app as api_app  # noqa: E402

app = create_public_app(
    api_app, frontend_directory=Path(__file__).resolve().parent / "frontend" / "dist"
)

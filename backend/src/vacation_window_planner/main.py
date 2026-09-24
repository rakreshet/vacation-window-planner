"""ASGI application wiring."""

from vacation_window_planner.api import create_app
from vacation_window_planner.database import database_is_reachable, make_engine
from vacation_window_planner.settings import Settings

settings = Settings()
engine = make_engine(settings.database_url)
app = create_app(database_probe=lambda: database_is_reachable(engine))

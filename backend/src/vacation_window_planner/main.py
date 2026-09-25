"""ASGI application wiring."""

from datetime import UTC, datetime

from vacation_window_planner.api import create_app
from vacation_window_planner.database import (
    database_is_reachable,
    make_engine,
    make_session_factory,
)
from vacation_window_planner.domain.calendar import PythonHolidaysCalendarProvider
from vacation_window_planner.domain.policy import RecommendationPolicy
from vacation_window_planner.repositories.searches import SearchSnapshotRepository
from vacation_window_planner.repositories.sessions import (
    AnonymousSessionRepository,
    AnonymousSessionState,
)
from vacation_window_planner.settings import Settings
from vacation_window_planner.workflow import (
    RecommendationRequest,
    RecommendationResult,
    RecommendationWorkflow,
)

settings = Settings()
engine = make_engine(settings.database_url)
sessions = make_session_factory(engine)
policy = RecommendationPolicy()
calendar_provider = PythonHolidaysCalendarProvider()


def utc_now() -> datetime:
    return datetime.now(UTC)


def find_session(token: str, now: datetime) -> AnonymousSessionState | None:
    with sessions() as session:
        return AnonymousSessionRepository(session).find_active(token, now=now)


def recommend(request: RecommendationRequest) -> RecommendationResult:
    with sessions() as session:
        workflow = RecommendationWorkflow(
            calendar_provider=calendar_provider,
            snapshot_writer=SearchSnapshotRepository(session),
            policy=policy,
            clock=utc_now,
        )
        try:
            result = workflow.recommend(request)
            session.commit()
            return result
        except Exception:
            session.rollback()
            raise


app = create_app(
    database_probe=lambda: database_is_reachable(engine),
    session_lookup=find_session,
    recommendation_service=recommend,
    clock=utc_now,
)

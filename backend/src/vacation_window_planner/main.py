"""ASGI application wiring."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from vacation_window_planner.api import SessionHttpRequest, create_app
from vacation_window_planner.database import (
    database_is_reachable,
    make_engine,
    make_session_factory,
)
from vacation_window_planner.domain.calendar import PythonHolidaysCalendarProvider
from vacation_window_planner.domain.contracts import FeedbackValue
from vacation_window_planner.domain.policy import RecommendationPolicy
from vacation_window_planner.interpreter import (
    GeminiConstraintInterpreter,
    HttpGeminiStructuredClient,
)
from vacation_window_planner.repositories.feedback import FeedbackRepository
from vacation_window_planner.repositories.searches import SearchSnapshotRepository
from vacation_window_planner.repositories.sessions import (
    AnonymousSessionRepository,
    AnonymousSessionState,
    CreatedAnonymousSession,
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
interpreter = (
    GeminiConstraintInterpreter(
        HttpGeminiStructuredClient(
            api_key=settings.gemini_api_key.get_secret_value(),
            model=settings.gemini_model,
        )
    )
    if settings.gemini_api_key is not None and settings.gemini_api_key.get_secret_value()
    else None
)


def utc_now() -> datetime:
    return datetime.now(UTC)


def find_session(token: str, now: datetime) -> AnonymousSessionState | None:
    with sessions() as session:
        return AnonymousSessionRepository(session).find_active(token, now=now)


def create_session(request: SessionHttpRequest, now: datetime) -> CreatedAnonymousSession:
    with sessions() as session:
        created = AnonymousSessionRepository(session).create(
            balance_days=request.balance_days,
            allowed_negative_days=request.allowed_negative_days,
            country_code=request.country_code,
            weekend_days=request.weekend_days,
            now=now,
            expires_at=now + timedelta(days=30),
        )
        session.commit()
        return created


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


def save_feedback(search_id: UUID, rank: int, session_id: UUID, value: FeedbackValue) -> None:
    with sessions() as session:
        FeedbackRepository(session).set_for_rank(
            session_id=session_id,
            search_id=search_id,
            rank=rank,
            value=value,
            now=utc_now(),
        )
        session.commit()


app = create_app(
    database_probe=lambda: database_is_reachable(engine),
    session_lookup=find_session,
    recommendation_service=recommend,
    interpretation_service=interpreter.interpret if interpreter is not None else None,
    feedback_service=save_feedback,
    session_creator=create_session,
    clock=utc_now,
)

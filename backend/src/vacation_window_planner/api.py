"""Typed HTTP entry point for the backend."""

import logging
from collections.abc import Callable
from datetime import UTC, datetime
from time import perf_counter
from typing import Annotated
from uuid import UUID

from fastapi import FastAPI, Header, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import RequestResponseEndpoint

from vacation_window_planner.comparison_workflow import (
    ComparisonOriginError,
    ComparisonRequest,
    InvalidComparisonError,
)
from vacation_window_planner.domain.calendar import UnsupportedCalendarError
from vacation_window_planner.domain.comparison import ComparisonInput, ComparisonResult
from vacation_window_planner.domain.contracts import (
    FeedbackValue,
    Recommendation,
    SearchConstraints,
    UserVacationContext,
    YearMonth,
)
from vacation_window_planner.domain.date_ranges import PastSearchRangeError
from vacation_window_planner.domain.generator import SearchTooBroadError
from vacation_window_planner.domain.local_dates import DEFAULT_TIME_ZONE, validate_time_zone
from vacation_window_planner.interpreter import (
    ConstraintProposal,
    InterpretationError,
    InterpretationInput,
)
from vacation_window_planner.repositories.comparisons import ComparisonPersistenceError
from vacation_window_planner.repositories.feedback import FeedbackAuthorizationError
from vacation_window_planner.repositories.searches import SearchSnapshotPersistenceError
from vacation_window_planner.repositories.sessions import (
    AnonymousSessionState,
    CreatedAnonymousSession,
)
from vacation_window_planner.workflow import (
    RecommendationRequest,
    RecommendationResult,
)


class RecommendationHttpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    months: tuple[YearMonth, ...] = Field(min_length=1)
    preferred_length_days: int = Field(gt=0)
    result_limit: int = Field(default=5, gt=0)
    source_text: str | None = None


class RecommendationHttpResponse(BaseModel):
    search_id: UUID
    recommendations: tuple[Recommendation, ...]
    notice: str | None = None


class FeedbackHttpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: FeedbackValue


class FeedbackHttpResponse(BaseModel):
    value: FeedbackValue


class SessionHttpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    time_zone: str = DEFAULT_TIME_ZONE
    _validate_time_zone = field_validator("time_zone")(validate_time_zone)

    balance_days: StrictInt = Field(ge=0)
    allowed_negative_days: StrictInt = Field(default=0, ge=0, le=5)
    country_code: str = Field(pattern=r"^[A-Z]{2}$")
    weekend_days: frozenset[StrictInt]

    @field_validator("weekend_days")
    @classmethod
    def weekend_days_must_be_valid(cls, value: frozenset[int]) -> frozenset[int]:
        if any(day < 0 or day > 6 for day in value):
            raise ValueError("weekend days must use Monday=0 through Sunday=6")
        return value


class SessionHttpResponse(BaseModel):
    session_id: UUID
    token: str


def _error(
    status_code: int, code: str, message: str, fields: list[str] | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "fields": fields or []}},
    )


def create_app(
    database_probe: Callable[[], bool],
    session_lookup: Callable[[str, datetime], AnonymousSessionState | None] | None = None,
    recommendation_service: Callable[[RecommendationRequest], RecommendationResult] | None = None,
    comparison_service: Callable[[ComparisonRequest], ComparisonResult] | None = None,
    interpretation_service: Callable[[str], ConstraintProposal] | None = None,
    feedback_service: Callable[[UUID, int, UUID, FeedbackValue], None] | None = None,
    session_creator: Callable[[SessionHttpRequest, datetime], CreatedAnonymousSession]
    | None = None,
    clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    cors_origins: tuple[str, ...] = (),
    max_request_bytes: int = 65_536,
) -> FastAPI:
    app = FastAPI(title="Vacation Window Planner")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    request_logger = logging.getLogger("vacation_window_planner.requests")

    @app.middleware("http")
    async def request_guard_and_log(
        request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        started = perf_counter()
        content_length = request.headers.get("content-length")
        if (
            content_length is not None
            and content_length.isdigit()
            and int(content_length) > max_request_bytes
        ):
            response: Response = _error(
                413,
                "REQUEST_TOO_LARGE",
                f"Request body exceeds the {max_request_bytes}-byte limit",
            )
        else:
            response = await call_next(request)
        request_logger.info(
            "request_complete",
            extra={
                "http_method": request.method,
                "http_path": request.url.path,
                "http_status": response.status_code,
                "duration_ms": round((perf_counter() - started) * 1000, 2),
            },
        )
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_request: Request, error: StarletteHTTPException) -> JSONResponse:
        is_not_found = error.status_code == status.HTTP_404_NOT_FOUND
        return _error(
            error.status_code,
            "NOT_FOUND" if is_not_found else "HTTP_ERROR",
            "Not found" if is_not_found else str(error.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, error: RequestValidationError) -> JSONResponse:
        fields = [".".join(str(part) for part in item["loc"]) for item in error.errors()]
        return _error(422, "VALIDATION_ERROR", "Request validation failed", fields)

    @app.get("/health")
    def health(response: Response) -> dict[str, str]:
        if database_probe():
            return {"status": "ok", "database": "connected"}
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable", "database": "disconnected"}

    @app.post("/sessions", response_model=SessionHttpResponse, status_code=201)
    def create_session(body: SessionHttpRequest) -> SessionHttpResponse | JSONResponse:
        if session_creator is None:
            return _error(503, "SERVICE_UNAVAILABLE", "Session service is unavailable")
        created = session_creator(body, clock())
        return SessionHttpResponse(session_id=created.id, token=created.token)

    @app.post("/recommendations", response_model=RecommendationHttpResponse)
    def recommendations(
        body: RecommendationHttpRequest,
        authorization: Annotated[str | None, Header()] = None,
    ) -> RecommendationResult | JSONResponse:
        if session_lookup is None or recommendation_service is None:
            return _error(503, "SERVICE_UNAVAILABLE", "Recommendation service is unavailable")
        if authorization is None or not authorization.startswith("Bearer "):
            return _error(401, "INVALID_SESSION", "A bearer session token is required")
        token = authorization.removeprefix("Bearer ").strip()
        if not token:
            return _error(401, "INVALID_SESSION", "A bearer session token is required")
        session = session_lookup(token, clock())
        if session is None:
            return _error(401, "SESSION_EXPIRED", "Session is expired or unknown")
        request = RecommendationRequest(
            context=UserVacationContext(
                session_id=session.id,
                time_zone=session.time_zone,
                balance_days=session.balance_days,
                allowed_negative_days=session.allowed_negative_days,
                country_code=session.country_code,
                weekend_days=session.weekend_days,
            ),
            constraints=SearchConstraints(
                months=body.months,
                preferred_length_days=body.preferred_length_days,
                result_limit=body.result_limit,
            ),
            source_text=body.source_text,
        )
        try:
            return recommendation_service(request)
        except SearchTooBroadError as error:
            return _error(422, error.code, str(error))
        except (PastSearchRangeError, UnsupportedCalendarError) as error:
            return _error(422, "INVALID_SEARCH", str(error))
        except SearchSnapshotPersistenceError:
            return _error(503, "PERSISTENCE_ERROR", "Search could not be saved")

    @app.post("/comparisons", response_model=ComparisonResult)
    def comparisons(
        body: ComparisonInput,
        authorization: Annotated[str | None, Header()] = None,
    ) -> ComparisonResult | JSONResponse:
        if session_lookup is None or comparison_service is None:
            return _error(503, "SERVICE_UNAVAILABLE", "Comparison service is unavailable")
        if authorization is None or not authorization.startswith("Bearer "):
            return _error(401, "INVALID_SESSION", "A bearer session token is required")
        token = authorization.removeprefix("Bearer ").strip()
        session = session_lookup(token, clock()) if token else None
        if session is None:
            return _error(401, "SESSION_EXPIRED", "Session is expired or unknown")
        context = UserVacationContext(
            session_id=session.id,
            balance_days=session.balance_days,
            allowed_negative_days=session.allowed_negative_days,
            country_code=session.country_code,
            weekend_days=session.weekend_days,
            time_zone=session.time_zone,
        )
        try:
            return comparison_service(ComparisonRequest(context=context, dates=body))
        except ComparisonPersistenceError:
            return _error(503, "PERSISTENCE_ERROR", "Comparison could not be saved")
        except ComparisonOriginError as error:
            return _error(404, "NOT_FOUND", str(error))
        except (InvalidComparisonError, UnsupportedCalendarError) as error:
            return _error(422, "INVALID_COMPARISON", str(error))

    @app.post("/interpret", response_model=ConstraintProposal)
    def interpret(body: InterpretationInput) -> ConstraintProposal | JSONResponse:
        if interpretation_service is None:
            return _error(
                503,
                "INTERPRETATION_UNAVAILABLE",
                "Text interpretation is not configured; use structured search fields",
            )
        try:
            return interpretation_service(body.text)
        except InterpretationError:
            return _error(502, "INTERPRETATION_ERROR", "Text interpretation failed")

    @app.post(
        "/recommendations/{search_id}/{rank}/feedback",
        response_model=FeedbackHttpResponse,
    )
    def feedback(
        search_id: UUID,
        rank: int,
        body: FeedbackHttpRequest,
        authorization: Annotated[str | None, Header()] = None,
    ) -> dict[str, str] | JSONResponse:
        if feedback_service is None or session_lookup is None:
            return _error(503, "SERVICE_UNAVAILABLE", "Feedback service is unavailable")
        if authorization is None or not authorization.startswith("Bearer "):
            return _error(401, "INVALID_SESSION", "A bearer session token is required")
        session = session_lookup(authorization.removeprefix("Bearer ").strip(), clock())
        if session is None:
            return _error(401, "SESSION_EXPIRED", "Session is expired or unknown")
        try:
            feedback_service(search_id, rank, session.id, body.value)
        except FeedbackAuthorizationError:
            return _error(404, "RECOMMENDATION_NOT_FOUND", "Recommendation not found")
        return {"value": body.value.value}

    return app

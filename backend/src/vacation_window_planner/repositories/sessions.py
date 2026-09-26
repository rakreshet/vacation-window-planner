"""Hashed-token anonymous-session persistence."""

import hashlib
import secrets
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from vacation_window_planner.domain.local_dates import DEFAULT_TIME_ZONE, validate_time_zone
from vacation_window_planner.domain.personal_calendar import PersonalCalendar
from vacation_window_planner.models import AnonymousSession


class SessionTokenCollisionError(RuntimeError):
    """A generated token duplicated an existing token hash."""


@dataclass(frozen=True)
class CreatedAnonymousSession:
    id: UUID
    token: str


@dataclass(frozen=True)
class AnonymousSessionState:
    id: UUID
    balance_days: int
    allowed_negative_days: int
    country_code: str
    weekend_days: frozenset[int]
    created_at: datetime
    expires_at: datetime
    time_zone: str = DEFAULT_TIME_ZONE
    personal_calendar: PersonalCalendar = field(default_factory=PersonalCalendar)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class AnonymousSessionRepository:
    def __init__(
        self,
        session: Session,
        token_factory: Callable[[], str] = secrets.token_urlsafe,
    ) -> None:
        self._session = session
        self._token_factory = token_factory

    def create(
        self,
        *,
        balance_days: int,
        allowed_negative_days: int,
        country_code: str,
        weekend_days: frozenset[int],
        now: datetime,
        expires_at: datetime,
        time_zone: str = DEFAULT_TIME_ZONE,
        personal_calendar: PersonalCalendar | None = None,
    ) -> CreatedAnonymousSession:
        if expires_at <= now:
            raise ValueError("session expiry must be after creation")
        token = self._token_factory()
        record = AnonymousSession(
            id=uuid4(),
            token_hash=_token_hash(token),
            created_at=now,
            expires_at=expires_at,
            balance_days=balance_days,
            allowed_negative_days=allowed_negative_days,
            country_code=country_code,
            weekend_days=sorted(weekend_days),
            time_zone=validate_time_zone(time_zone),
            personal_calendar=(personal_calendar or PersonalCalendar()).model_dump(mode="json"),
        )
        self._session.add(record)
        try:
            self._session.flush()
        except IntegrityError as error:
            self._session.rollback()
            raise SessionTokenCollisionError("generated session token is not unique") from error
        return CreatedAnonymousSession(id=record.id, token=token)

    def find_active(self, token: str, *, now: datetime) -> AnonymousSessionState | None:
        record = self._session.scalar(
            select(AnonymousSession).where(
                AnonymousSession.token_hash == _token_hash(token),
                AnonymousSession.expires_at > now,
            )
        )
        if record is None:
            return None
        return AnonymousSessionState(
            id=record.id,
            balance_days=record.balance_days,
            allowed_negative_days=record.allowed_negative_days,
            country_code=record.country_code,
            weekend_days=frozenset(record.weekend_days),
            created_at=record.created_at,
            expires_at=record.expires_at,
            time_zone=record.time_zone,
            personal_calendar=PersonalCalendar.model_validate(record.personal_calendar),
        )

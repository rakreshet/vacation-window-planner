"""Authorized thumbs feedback persistence."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from vacation_window_planner.domain.contracts import Feedback, FeedbackValue
from vacation_window_planner.models import FeedbackRecord, RecommendationRecord, SearchRecord


class FeedbackAuthorizationError(ValueError):
    """The recommendation does not belong to the anonymous session."""


class FeedbackRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def set_for_rank(
        self,
        *,
        session_id: UUID,
        search_id: UUID,
        rank: int,
        value: FeedbackValue,
        now: datetime,
    ) -> Feedback:
        recommendation_id = self._session.scalar(
            select(RecommendationRecord.id)
            .join(SearchRecord, RecommendationRecord.search_id == SearchRecord.id)
            .where(
                SearchRecord.id == search_id,
                SearchRecord.session_id == session_id,
                RecommendationRecord.rank == rank,
            )
        )
        if recommendation_id is None:
            raise FeedbackAuthorizationError("recommendation does not belong to this session")

        record = self._session.scalar(
            select(FeedbackRecord).where(
                FeedbackRecord.session_id == session_id,
                FeedbackRecord.recommendation_id == recommendation_id,
            )
        )
        if record is None:
            record = FeedbackRecord(
                id=uuid4(),
                session_id=session_id,
                recommendation_id=recommendation_id,
                value=value.value,
                created_at=now,
                updated_at=now,
            )
            self._session.add(record)
        else:
            record.value = value.value
            record.updated_at = now
        self._session.flush()
        return Feedback(
            session_id=session_id,
            recommendation_id=recommendation_id,
            value=value,
        )

    def get(self, session_id: UUID, recommendation_id: UUID) -> Feedback | None:
        record = self._session.scalar(
            select(FeedbackRecord).where(
                FeedbackRecord.session_id == session_id,
                FeedbackRecord.recommendation_id == recommendation_id,
            )
        )
        if record is None:
            return None
        return Feedback(
            session_id=record.session_id,
            recommendation_id=record.recommendation_id,
            value=FeedbackValue(record.value),
        )

    def count_for_recommendation(self, recommendation_id: UUID) -> int:
        return (
            self._session.scalar(
                select(func.count())
                .select_from(FeedbackRecord)
                .where(FeedbackRecord.recommendation_id == recommendation_id)
            )
            or 0
        )

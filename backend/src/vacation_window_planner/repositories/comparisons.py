"""Session-owned immutable comparison snapshots."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from vacation_window_planner.models import ComparisonRecord


class ComparisonPersistenceError(RuntimeError):
    """A complete comparison could not be stored."""


@dataclass(frozen=True)
class ComparisonSnapshot:
    id: UUID
    structured_input: dict[str, object]
    result: dict[str, object]


class ComparisonSnapshotRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def save_completed(
        self,
        *,
        comparison_id: UUID,
        session_id: UUID,
        structured_input: dict[str, object],
        result: dict[str, object],
        created_at: datetime,
    ) -> None:
        try:
            self._session.add(
                ComparisonRecord(
                    id=comparison_id,
                    session_id=session_id,
                    structured_input=structured_input,
                    result=result,
                    created_at=created_at,
                )
            )
            self._session.flush()
        except SQLAlchemyError as error:
            self._session.rollback()
            raise ComparisonPersistenceError("Comparison could not be saved") from error

    def get_for_session(self, comparison_id: UUID, session_id: UUID) -> ComparisonSnapshot | None:
        record = self._session.scalar(
            select(ComparisonRecord).where(
                ComparisonRecord.id == comparison_id,
                ComparisonRecord.session_id == session_id,
            )
        )
        if record is None:
            return None
        return ComparisonSnapshot(
            id=record.id, structured_input=dict(record.structured_input), result=dict(record.result)
        )

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from vacation_window_planner.models import AnnualPlanRun


class AnnualPersistenceError(RuntimeError):
    pass


@dataclass(frozen=True)
class AnnualSnapshot:
    id: UUID
    structured_input: dict[str, object]
    result: dict[str, object]


class AnnualRunRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def save_completed(
        self,
        *,
        run_id: UUID,
        session_id: UUID,
        structured_input: dict[str, object],
        result: dict[str, object],
        created_at: datetime,
    ) -> None:
        try:
            self._session.add(
                AnnualPlanRun(
                    id=run_id,
                    session_id=session_id,
                    structured_input=structured_input,
                    result=result,
                    created_at=created_at,
                )
            )
            self._session.flush()
            self._session.commit()
        except SQLAlchemyError as error:
            self._session.rollback()
            raise AnnualPersistenceError("Annual calculation could not be saved") from error

    def get_for_session(self, run_id: UUID, session_id: UUID) -> AnnualSnapshot | None:
        record = self._session.scalar(
            select(AnnualPlanRun).where(
                AnnualPlanRun.id == run_id,
                AnnualPlanRun.session_id == session_id,
            )
        )
        if record is None:
            return None
        return AnnualSnapshot(
            id=record.id,
            structured_input=dict(record.structured_input),
            result=dict(record.result),
        )

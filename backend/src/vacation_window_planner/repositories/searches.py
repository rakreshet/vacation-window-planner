"""Immutable search and recommendation snapshot persistence."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from vacation_window_planner.models import RecommendationRecord, SearchRecord


class SearchSnapshotPersistenceError(RuntimeError):
    """A completed search could not be stored atomically."""


@dataclass(frozen=True)
class RecommendationSnapshotInput:
    rank: int
    result: dict[str, object]
    warnings: tuple[str, ...]


@dataclass(frozen=True)
class RecommendationSnapshot:
    id: UUID
    rank: int
    result: dict[str, object]
    warnings: tuple[str, ...]


@dataclass(frozen=True)
class SearchSnapshot:
    id: UUID
    session_id: UUID
    engine_version: str
    structured_input: dict[str, object]
    source_text: str | None
    created_at: datetime
    recommendations: tuple[RecommendationSnapshot, ...]
    opportunities: dict[str, object] | None = None


class SearchSnapshotRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def save_completed(
        self,
        *,
        session_id: UUID,
        engine_version: str,
        structured_input: dict[str, object],
        source_text: str | None,
        recommendations: tuple[RecommendationSnapshotInput, ...],
        created_at: datetime,
    ) -> UUID:
        search_id = uuid4()
        try:
            self._session.add(
                SearchRecord(
                    id=search_id,
                    session_id=session_id,
                    engine_version=engine_version,
                    structured_input=structured_input,
                    opportunities=opportunity_snapshot(structured_input),
                    source_text=source_text,
                    created_at=created_at,
                )
            )
            self._session.flush()
            self._session.add_all(
                RecommendationRecord(
                    id=uuid4(),
                    search_id=search_id,
                    rank=item.rank,
                    result=item.result,
                    warnings=list(item.warnings),
                )
                for item in recommendations
            )
            self._session.flush()
        except SQLAlchemyError as error:
            self._session.rollback()
            raise SearchSnapshotPersistenceError("completed search was not persisted") from error
        return search_id

    def belongs_to_session(self, search_id: UUID, session_id: UUID) -> bool:
        return (
            self._session.scalar(
                select(SearchRecord.id).where(
                    SearchRecord.id == search_id, SearchRecord.session_id == session_id
                )
            )
            is not None
        )

    def get(self, search_id: UUID) -> SearchSnapshot | None:
        search = self._session.get(SearchRecord, search_id)
        if search is None:
            return None
        records = self._session.scalars(
            select(RecommendationRecord)
            .where(RecommendationRecord.search_id == search_id)
            .order_by(RecommendationRecord.rank)
        ).all()
        return SearchSnapshot(
            id=search.id,
            session_id=search.session_id,
            engine_version=search.engine_version,
            structured_input=dict(search.structured_input),
            opportunities=search.opportunities,
            source_text=search.source_text,
            created_at=search.created_at,
            recommendations=tuple(
                RecommendationSnapshot(
                    id=record.id,
                    rank=record.rank,
                    result=dict(record.result),
                    warnings=tuple(record.warnings),
                )
                for record in records
            ),
        )

    def list_for_session(self, session_id: UUID) -> tuple[SearchSnapshot, ...]:
        search_ids = self._session.scalars(
            select(SearchRecord.id)
            .where(SearchRecord.session_id == session_id)
            .order_by(SearchRecord.created_at, SearchRecord.id)
        ).all()
        snapshots = (self.get(search_id) for search_id in search_ids)
        return tuple(snapshot for snapshot in snapshots if snapshot is not None)

    def purge_source_text_before(self, cutoff: datetime) -> int:
        records = self._session.scalars(
            select(SearchRecord).where(
                SearchRecord.created_at < cutoff,
                SearchRecord.source_text.is_not(None),
            )
        ).all()
        for record in records:
            record.source_text = None
        self._session.flush()
        return len(records)


def opportunity_snapshot(structured_input: dict[str, object]) -> dict[str, object] | None:
    value = structured_input.get("opportunities")
    if value is None:
        return None
    if not isinstance(value, dict) or any(not isinstance(key, str) for key in value):
        raise ValueError("opportunity snapshot must be an object")
    return dict(value)

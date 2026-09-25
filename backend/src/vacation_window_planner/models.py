"""SQLAlchemy schema models."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AnonymousSession(Base):
    __tablename__ = "anonymous_sessions"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    balance_days: Mapped[int] = mapped_column(Integer(), nullable=False)
    allowed_negative_days: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False)
    weekend_days: Mapped[list[int]] = mapped_column(JSON(), nullable=False)


class SearchRecord(Base):
    __tablename__ = "searches"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("anonymous_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    engine_version: Mapped[str] = mapped_column(String(100), nullable=False)
    structured_input: Mapped[dict[str, object]] = mapped_column(JSON(), nullable=False)
    source_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class RecommendationRecord(Base):
    __tablename__ = "recommendations"
    __table_args__ = (UniqueConstraint("search_id", "rank"),)

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    search_id: Mapped[UUID] = mapped_column(
        ForeignKey("searches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rank: Mapped[int] = mapped_column(Integer(), nullable=False)
    result: Mapped[dict[str, object]] = mapped_column(JSON(), nullable=False)
    warnings: Mapped[list[str]] = mapped_column(JSON(), nullable=False)


class FeedbackRecord(Base):
    __tablename__ = "feedback"
    __table_args__ = (UniqueConstraint("session_id", "recommendation_id"),)

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("anonymous_sessions.id", ondelete="CASCADE"), nullable=False
    )
    recommendation_id: Mapped[UUID] = mapped_column(
        ForeignKey("recommendations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    value: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

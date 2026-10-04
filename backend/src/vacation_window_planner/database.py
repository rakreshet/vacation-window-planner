"""PostgreSQL connectivity at the application boundary."""

import os

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError, SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool


def normalize_database_url(value: str) -> str:
    """Accept provider PostgreSQL URLs while always selecting the installed driver."""
    try:
        url = make_url(value)
    except ArgumentError as error:
        raise ValueError("DATABASE_URL must be a PostgreSQL URL") from error
    if (
        url.drivername not in {"postgres", "postgresql", "postgresql+psycopg"}
        or not url.host
        or not url.database
    ):
        raise ValueError("DATABASE_URL must be a PostgreSQL URL")
    return url.set(drivername="postgresql+psycopg").render_as_string(hide_password=False)


def make_engine(database_url: str) -> Engine:
    if os.environ.get("VERCEL") == "1":
        # Neon owns pooling; idle function instances should not hold connections.
        return create_engine(database_url, poolclass=NullPool)
    return create_engine(database_url, pool_pre_ping=True)


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)


def database_is_reachable(engine: Engine) -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        return False

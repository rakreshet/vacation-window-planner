"""Apply migrations to an explicitly selected hosted PostgreSQL database."""

import os
import sys
from getpass import getpass
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url
from vacation_window_planner.database import normalize_database_url


def main() -> None:
    try:
        url = normalize_database_url(getpass("Direct hosted PostgreSQL URL (hidden): "))
    except ValueError:
        raise SystemExit("Enter a complete PostgreSQL connection URL.") from None
    target = make_url(url)
    if target.query.get("sslmode") not in {"require", "verify-ca", "verify-full"}:
        raise SystemExit("The hosted connection must require TLS with sslmode.")
    print(f"Target: {target.host} / {target.database}")
    if input("Type migrate to apply the schema to this database: ") != "migrate":
        raise SystemExit("Cancelled; no migrations applied.")
    config = Config(str(Path(__file__).resolve().parents[1] / "backend" / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    # env.py accepts DATABASE_URL for Docker; the hidden prompt owns this target.
    os.environ.pop("DATABASE_URL", None)
    try:
        command.upgrade(config, "head")
    except Exception:
        print("Migration failed. Verify the connection and database permissions.", file=sys.stderr)
        raise SystemExit(1) from None
    print("Schema is up to date.")


if __name__ == "__main__":
    main()

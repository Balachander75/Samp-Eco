"""Copy reference masters from samp_eco_db into navneet_samp.

The source database URL can be supplied with SOURCE_DATABASE_URL. When it is
omitted, the script derives it from the configured target URL by changing only
the database name to ``samp_eco_db``.

This intentionally replaces only the target ``customers`` and ``plants``
tables. Operational request data and the users table are left untouched.
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
from dotenv import dotenv_values
from psycopg.rows import dict_row

from app.database import Base, engine
from app.models.master import Customer, Plant  # noqa: F401 - register models


BACKEND_DIR = Path(__file__).resolve().parents[1]


def configured_database_url() -> str:
    values = dotenv_values(BACKEND_DIR / ".env")
    return os.environ.get("TARGET_DATABASE_URL") or values.get("DATABASE_URL") or ""


def source_database_url(target_url: str) -> str:
    explicit = os.environ.get("SOURCE_DATABASE_URL")
    if explicit:
        return explicit

    parsed = urlsplit(target_url)
    return urlunsplit((parsed.scheme, parsed.netloc, "/samp_eco_db", parsed.query, parsed.fragment))


def main() -> None:
    target_url = configured_database_url()
    if not target_url:
        raise RuntimeError("DATABASE_URL is not configured")

    source_url = source_database_url(target_url)

    # Create the target tables from the application models before copying data.
    Base.metadata.create_all(bind=engine)

    with psycopg.connect(source_url, row_factory=dict_row) as source:
        customers = source.execute(
            """
            SELECT id, name, country, created_at, updated_at
            FROM public.customers
            ORDER BY id
            """
        ).fetchall()
        plants = source.execute(
            """
            SELECT id, code, name, location, is_active, created_by, created_at, updated_at
            FROM public.plants
            ORDER BY id
            """
        ).fetchall()

    with psycopg.connect(target_url) as target:
        with target.cursor() as cursor:
            # The target currently has no operational tables that reference
            # these masters. Replacing only these two tables makes the copy exact.
            cursor.execute("TRUNCATE TABLE customers, plants RESTART IDENTITY")

            cursor.executemany(
                """
                INSERT INTO customers (id, name, country, created_at, updated_at)
                VALUES (%(id)s, %(name)s, %(country)s, %(created_at)s, %(updated_at)s)
                """,
                customers,
            )
            cursor.executemany(
                """
                INSERT INTO plants
                    (id, code, name, location, is_active, created_by, created_at, updated_at)
                VALUES
                    (%(id)s, %(code)s, %(name)s, %(location)s, %(is_active)s,
                     %(created_by)s, %(created_at)s, %(updated_at)s)
                """,
                plants,
            )

            # Keep future auto-generated IDs above the explicitly copied IDs.
            for table in ("customers", "plants"):
                cursor.execute(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM {table}), 1), true)"
                )

        target.commit()

    print(f"Copied {len(customers)} customers and {len(plants)} plants into navneet_samp.")


if __name__ == "__main__":
    main()

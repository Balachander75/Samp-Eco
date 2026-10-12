"""Add concurrent indexes used by workflow and year-scoped desk queues.

Run once during deployment with:
    python scripts/migrations/add_workflow_query_indexes.py

CONCURRENTLY avoids blocking normal writes while PostgreSQL builds the indexes.
"""

import sys
from pathlib import Path

from sqlalchemy import text

backend_dir = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(backend_dir))

from app.database import engine


INDEX_STATEMENTS = (
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_create_sample_requests_year "
    "ON create_sample_requests (year)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_create_sample_requests_year_id "
    "ON create_sample_requests (year, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_create_sample_requests_target_plant "
    "ON create_sample_requests (target_plant)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_create_sample_requests_plant_year "
    "ON create_sample_requests (target_plant, year)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_design_requests_created_at "
    "ON design_requests (created_at)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_design_requests_program_year "
    "ON design_requests (program_year)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_requests_program_year "
    "ON program_requests (program_year)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_requests_created_at "
    "ON program_requests (created_at)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_requests_request_raised_at "
    "ON feasibility_requests (request_raised_at)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_requests_raised_id "
    "ON feasibility_requests (request_raised_at, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_requests_target_plant_normalized "
    "ON program_requests ("
    "(regexp_replace(lower(coalesce(target_plant, '')), '[^a-z0-9]+', ' ', 'g'))"
    ")",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_requests_year_id "
    "ON program_requests (program_year, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_requests_status_id "
    "ON program_requests (status, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_activity_request_id_id "
    "ON program_activity_logs (program_request_id, id)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_requests_status_id "
    "ON feasibility_requests (status, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_activity_request_id_id "
    "ON feasibility_activity_logs (feasibility_request_id, id)",
)

ANALYZE_STATEMENTS = (
    "ANALYZE create_sample_requests",
    "ANALYZE design_requests",
    "ANALYZE program_requests",
    "ANALYZE program_activity_logs",
    "ANALYZE feasibility_requests",
    "ANALYZE feasibility_activity_logs",
)


def run_migration() -> None:
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        for statement in INDEX_STATEMENTS:
            connection.execute(text(statement))
        for statement in ANALYZE_STATEMENTS:
            connection.execute(text(statement))


if __name__ == "__main__":
    run_migration()
    print("Workflow query indexes are ready.")

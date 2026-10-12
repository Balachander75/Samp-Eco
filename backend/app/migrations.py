"""Versioned, serialized database upgrades for the PostgreSQL schema.

The first migration adopts the application's historical idempotent startup
upgrades. New schema changes should be added as numbered migration functions
below so they run once and have an auditable version record.
"""

import logging
from typing import Callable, List, Tuple

from sqlalchemy import text

from app.database import Base, engine

logger = logging.getLogger("uvicorn.error")
_MIGRATION_LOCK = 741_902_311


def _bootstrap_existing_schema() -> None:
    # Import every model before create_all so SQLAlchemy sees the complete graph.
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    from app.database import (
        ensure_costing_detail_columns,
        ensure_design_requests_table,
        ensure_design_workflow_columns,
        ensure_feasibility_workflow_columns,
        ensure_mockup_workflow_columns,
        ensure_product_category_columns,
        ensure_program_feedback_columns,
        ensure_program_review_columns,
        ensure_sample_reference_columns,
        ensure_sample_request_draft_keys,
        ensure_sample_request_types_default,
        ensure_user_team_columns,
        ensure_user_theme_column,
    )

    for upgrade in (
        ensure_design_requests_table,
        ensure_user_team_columns,
        ensure_user_theme_column,
        ensure_feasibility_workflow_columns,
        ensure_design_workflow_columns,
        ensure_program_review_columns,
        ensure_program_feedback_columns,
        ensure_product_category_columns,
        ensure_costing_detail_columns,
        ensure_sample_reference_columns,
        ensure_sample_request_draft_keys,
        ensure_mockup_workflow_columns,
        ensure_sample_request_types_default,
    ):
        upgrade()


def _link_feasibility_conversions() -> None:
    """Backfill and enforce the Feasibility-to-commercial-request relationship."""
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS converted_sample_request_id INTEGER"))
        connection.execute(text("ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS converted_sr_number VARCHAR(50)"))
        connection.execute(text("ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ"))
        connection.execute(text("ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS converted_by VARCHAR(255)"))
        connection.execute(text("""
            UPDATE feasibility_requests AS feasibility
            SET converted_sample_request_id = sample.id
            FROM create_sample_requests AS sample
            WHERE (feasibility.converted_sample_request_id IS NULL OR NOT EXISTS (
                    SELECT 1 FROM create_sample_requests AS linked
                    WHERE linked.id = feasibility.converted_sample_request_id
                  ))
              AND NULLIF(trim(feasibility.converted_sr_number), '') = sample.sr_number
        """))
        connection.execute(text("""
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_feasibility_requests_converted_sample_request'
                  AND conrelid = 'feasibility_requests'::regclass
              ) THEN
                ALTER TABLE feasibility_requests
                  ADD CONSTRAINT fk_feasibility_requests_converted_sample_request
                  FOREIGN KEY (converted_sample_request_id)
                  REFERENCES create_sample_requests(id)
                  ON DELETE RESTRICT NOT VALID;
              END IF;
            END; $$
        """))

        duplicate_links = connection.execute(text("""
            SELECT converted_sample_request_id, count(*)
            FROM feasibility_requests
            WHERE converted_sample_request_id IS NOT NULL
            GROUP BY converted_sample_request_id
            HAVING count(*) > 1
            LIMIT 1
        """)).first()
        if duplicate_links:
            raise RuntimeError(
                "Cannot enforce one-to-one Feasibility conversions: multiple feasibility rows "
                f"point to sample request {duplicate_links[0]}. Resolve the duplicate links before migration."
            )

        connection.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_feasibility_requests_converted_sample_request_id
            ON feasibility_requests (converted_sample_request_id)
            WHERE converted_sample_request_id IS NOT NULL
        """))

        orphan_count = connection.execute(text("""
            SELECT count(*)
            FROM feasibility_requests AS feasibility
            LEFT JOIN create_sample_requests AS sample
              ON sample.id = feasibility.converted_sample_request_id
            WHERE feasibility.converted_sample_request_id IS NOT NULL
              AND sample.id IS NULL
        """)).scalar_one()
        if not orphan_count:
            connection.execute(text("""
                ALTER TABLE feasibility_requests
                VALIDATE CONSTRAINT fk_feasibility_requests_converted_sample_request
            """))
        else:
            logger.warning(
                "Feasibility conversion migration retained %s legacy orphan link(s); "
                "the new foreign key protects future writes but remains unvalidated until those rows are reconciled.",
                orphan_count,
            )


def _backfill_sample_request_activity() -> None:
    """Normalize process events previously embedded in workflow JSON documents."""
    with engine.begin() as connection:
        connection.execute(text("""
            INSERT INTO sample_request_activity_logs (
                sample_request_id, request_sr_number, actor_name, actor_department,
                action, payload, created_at
            )
            SELECT sample.id,
                   sample.sr_number,
                   COALESCE(NULLIF(event.value->>'actorName', ''), 'System'),
                   NULLIF(event.value->>'actorDepartment', ''),
                   LEFT(COALESCE(NULLIF(event.value->>'action', ''), 'MOCKUP_EVENT'), 64),
                   event.value,
                   CASE
                     WHEN COALESCE(event.value->>'timestamp', event.value->>'createdAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
                       THEN (COALESCE(event.value->>'timestamp', event.value->>'createdAt'))::timestamptz
                     ELSE now()
                   END
            FROM create_sample_requests AS sample
            CROSS JOIN LATERAL jsonb_array_elements(
                CASE WHEN jsonb_typeof(sample.mockup_workflow_state->'events') = 'array'
                     THEN sample.mockup_workflow_state->'events' ELSE '[]'::jsonb END
            ) AS event(value)
        """))

        connection.execute(text("""
            INSERT INTO sample_request_activity_logs (
                sample_request_id, request_sr_number, actor_user_id, actor_name,
                actor_department, action, to_status, payload, created_at
            )
            SELECT sample.id,
                   sample.sr_number,
                   CASE WHEN EXISTS (
                       SELECT 1 FROM users WHERE users.id = sample.created_by_user_id
                   ) THEN sample.created_by_user_id ELSE NULL END,
                   COALESCE(NULLIF(sample.created_by, ''), 'Legacy import'),
                   'Marketing',
                   CASE WHEN lower(COALESCE(sample.status, '')) LIKE 'draft%'
                        THEN 'DRAFT_CREATED' ELSE 'REQUEST_CREATED' END,
                   sample.status,
                   jsonb_build_object(
                       'request_types', sample.request_types,
                       'creation_mode', sample.creation_mode,
                       'legacy_backfill', true
                   ),
                   sample.created_at
            FROM create_sample_requests AS sample
            WHERE NOT EXISTS (
                SELECT 1
                FROM sample_request_activity_logs AS history
                WHERE history.sample_request_id = sample.id
                  AND history.action IN ('DRAFT_CREATED', 'REQUEST_CREATED')
            )
        """))

        connection.execute(text("""
            INSERT INTO sample_request_activity_logs (
                sample_request_id, request_sr_number, actor_name, actor_department,
                action, payload, created_at
            )
            SELECT sample.id,
                   sample.sr_number,
                   COALESCE(NULLIF(event.value->>'actorName', ''), 'System'),
                   NULLIF(event.value->>'actorDepartment', ''),
                   LEFT(COALESCE(NULLIF(event.value->>'action', ''), 'DESIGN_EVENT'), 64),
                   event.value,
                   CASE
                     WHEN COALESCE(event.value->>'timestamp', event.value->>'createdAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
                       THEN (COALESCE(event.value->>'timestamp', event.value->>'createdAt'))::timestamptz
                     ELSE now()
                   END
            FROM design_requests AS design
            JOIN create_sample_requests AS sample ON sample.sr_number = design.sr_number
            CROSS JOIN LATERAL jsonb_array_elements(
                CASE WHEN jsonb_typeof(design.workflow_state->'events') = 'array'
                     THEN design.workflow_state->'events' ELSE '[]'::jsonb END
            ) AS event(value)
        """))


def _index_request_type_scopes() -> None:
    """Build a non-blocking JSONB index for scope-specific operational desks."""
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.execute(text("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_create_sample_requests_request_types_gin
            ON create_sample_requests USING GIN (request_types jsonb_path_ops)
        """))
        connection.execute(text("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_requests_created_by_user_id
            ON feasibility_requests (created_by_user_id)
        """))
        connection.execute(text("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_activity_request_id_id
            ON feasibility_activity_logs (feasibility_request_id, id)
        """))
        connection.execute(text("ANALYZE create_sample_requests"))
        connection.execute(text("ANALYZE feasibility_requests"))


def _synchronize_request_type_flags() -> None:
    """Reconcile normalized scope flags with the request's JSON scope list."""
    with engine.begin() as connection:
        connection.execute(text("""
            INSERT INTO sample_request_types (
                sample_request_id, design, mockup, sample, costing
            )
            SELECT id,
                   request_types @> '["design"]'::jsonb,
                   request_types @> '["mockup"]'::jsonb,
                   request_types @> '["sample"]'::jsonb,
                   request_types @> '["costing"]'::jsonb
            FROM create_sample_requests
            ON CONFLICT (sample_request_id) DO UPDATE SET
                design = EXCLUDED.design,
                mockup = EXCLUDED.mockup,
                sample = EXCLUDED.sample,
                costing = EXCLUDED.costing,
                updated_at = now()
            WHERE sample_request_types.design IS DISTINCT FROM EXCLUDED.design
               OR sample_request_types.mockup IS DISTINCT FROM EXCLUDED.mockup
               OR sample_request_types.sample IS DISTINCT FROM EXCLUDED.sample
               OR sample_request_types.costing IS DISTINCT FROM EXCLUDED.costing
        """))


def _preserve_feasibility_activity_history() -> None:
    """Keep immutable feasibility logs and their request-code reference after deletion."""
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE feasibility_activity_logs ADD COLUMN IF NOT EXISTS request_code VARCHAR(32)"
        ))
        connection.execute(text("""
            UPDATE feasibility_activity_logs AS activity
            SET request_code = request.request_code
            FROM feasibility_requests AS request
            WHERE activity.feasibility_request_id = request.id
              AND activity.request_code IS DISTINCT FROM request.request_code
        """))
        connection.execute(text(
            "ALTER TABLE feasibility_activity_logs ALTER COLUMN feasibility_request_id DROP NOT NULL"
        ))
        connection.execute(text(
            "ALTER TABLE feasibility_activity_logs DROP CONSTRAINT IF EXISTS feasibility_activity_logs_feasibility_request_id_fkey"
        ))
        connection.execute(text("""
            ALTER TABLE feasibility_activity_logs
            ADD CONSTRAINT feasibility_activity_logs_feasibility_request_id_fkey
            FOREIGN KEY (feasibility_request_id)
            REFERENCES feasibility_requests(id)
            ON DELETE SET NULL
            NOT VALID
        """))
        connection.execute(text(
            "ALTER TABLE feasibility_activity_logs DROP CONSTRAINT IF EXISTS feasibility_activity_logs_actor_id_fkey"
        ))
        connection.execute(text("""
            ALTER TABLE feasibility_activity_logs
            ADD CONSTRAINT feasibility_activity_logs_actor_id_fkey
            FOREIGN KEY (actor_id)
            REFERENCES users(id)
            ON DELETE SET NULL
            NOT VALID
        """))
        missing_request = connection.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM feasibility_activity_logs AS activity
                LEFT JOIN feasibility_requests AS request ON request.id = activity.feasibility_request_id
                WHERE activity.feasibility_request_id IS NOT NULL AND request.id IS NULL
            )
        """)).scalar_one()
        if not missing_request:
            connection.execute(text(
                "ALTER TABLE feasibility_activity_logs VALIDATE CONSTRAINT feasibility_activity_logs_feasibility_request_id_fkey"
            ))
        else:
            logger.warning("Feasibility history migration found orphan request references; the new FK remains unvalidated until they are reconciled.")

        missing_actor = connection.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM feasibility_activity_logs AS activity
                LEFT JOIN users AS actor ON actor.id = activity.actor_id
                WHERE activity.actor_id IS NOT NULL AND actor.id IS NULL
            )
        """)).scalar_one()
        if not missing_actor:
            connection.execute(text(
                "ALTER TABLE feasibility_activity_logs VALIDATE CONSTRAINT feasibility_activity_logs_actor_id_fkey"
            ))
        else:
            logger.warning("Feasibility history migration found orphan actor references; the new actor FK remains unvalidated until they are reconciled.")
        connection.execute(text("DROP INDEX IF EXISTS ix_feasibility_activity_logs_id"))
        connection.execute(text("DROP INDEX IF EXISTS ix_feasibility_activity_logs_feasibility_request_id"))

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.execute(text("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_activity_request_code_created
            ON feasibility_activity_logs (request_code, created_at, id)
        """))


MIGRATIONS: List[Tuple[str, str, Callable[[], None]]] = [
    ("0001_legacy_schema_bootstrap", "Record and run existing schema upgrades", _bootstrap_existing_schema),
    ("0002_feasibility_conversion_relations", "Connect Feasibility conversions to sample requests", _link_feasibility_conversions),
    ("0003_backfill_sample_request_activity", "Normalize legacy sample and design workflow events", _backfill_sample_request_activity),
    ("0004_index_request_type_scopes", "Index operational scopes and owner-filtered queues", _index_request_type_scopes),
    ("0005_sync_normalized_request_types", "Synchronize relational scope flags from request records", _synchronize_request_type_flags),
    ("0006_preserve_feasibility_activity_history", "Retain feasibility audit history when its request is deleted", _preserve_feasibility_activity_history),
]


def apply_database_migrations() -> None:
    """Apply each database upgrade once, serializing startup across app workers."""
    with engine.connect() as connection:
        connection.execute(text("SELECT pg_advisory_lock(:lock_id)"), {"lock_id": _MIGRATION_LOCK})
        connection.commit()
        try:
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(100) PRIMARY KEY,
                    description VARCHAR(255) NOT NULL,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """))
            connection.commit()
            applied = {
                row[0]
                for row in connection.execute(text("SELECT version FROM schema_migrations")).all()
            }
            for version, description, upgrade in MIGRATIONS:
                if version in applied:
                    continue
                logger.info("[Database] Applying migration %s: %s", version, description)
                upgrade()
                connection.execute(
                    text("INSERT INTO schema_migrations (version, description) VALUES (:version, :description)"),
                    {"version": version, "description": description},
                )
                connection.commit()
                logger.info("[Database] Applied migration %s", version)
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": _MIGRATION_LOCK})
            connection.commit()

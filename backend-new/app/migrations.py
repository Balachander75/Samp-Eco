"""Versioned, serialized database upgrades for the PostgreSQL schema.

The first migration adopts the application's historical idempotent startup
upgrades. New schema changes should be added as numbered migration functions
below so they run once and have an auditable version record.
"""

import logging
import json
import re
from datetime import date, datetime
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


def _reconcile_released_costing_workflows() -> None:
    """Move released Costing requests left at Marketing by the old batch route."""
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TEMP TABLE costing_release_repair ON COMMIT DROP AS
            SELECT workflow.id AS workflow_id,
                   request.id AS sample_request_id,
                   request.sr_number,
                   workflow.status AS old_status,
                   CASE WHEN request.costing_creative_input_needed THEN 'creative' ELSE 'costing' END AS target_stage,
                   CASE WHEN request.costing_creative_input_needed THEN 'Creative Review' ELSE 'Costing Work' END AS target_status,
                   CASE WHEN request.costing_creative_input_needed THEN 'Creative' ELSE 'Costing' END AS target_request_status,
                   COALESCE(request.request_types, '[]'::jsonb) AS request_types,
                   request.customer,
                   request.brand_name,
                   request.material_code,
                   request.qty_design_costing AS quantity,
                   request.costing_required_date AS required_date,
                   request.costing_creative_input_needed,
                   request.costing_creative_input_remark,
                   request.product_description
            FROM costing_workflows AS workflow
            JOIN create_sample_requests AS request ON request.id = workflow.sample_request_id
            WHERE workflow.current_stage = 'marketing'
              AND request.request_types ? 'costing'
              AND lower(trim(COALESCE(request.status, ''))) IN (
                  'creative', 'costing', 'creative review', 'costing work'
              )
        """))

        connection.execute(text("""
            INSERT INTO costing_workflow_logs (
                workflow_id, sample_request_id, sr_number, actor_name, actor_team,
                action, from_stage, to_stage, from_status, to_status, details, created_at
            )
            SELECT workflow_id, sample_request_id, sr_number, 'System migration', 'System',
                   'MARKETING_RELEASE_RECONCILED', 'marketing', target_stage,
                   old_status, target_status,
                   jsonb_build_object(
                       'source', 'batch-status costing handoff repair',
                       'request_types', request_types,
                       'costing_creative_input_needed', costing_creative_input_needed,
                       'required_date', required_date
                   ),
                   now()
            FROM costing_release_repair
        """))

        connection.execute(text("""
            UPDATE costing_workflows AS workflow
            SET current_stage = repair.target_stage,
                status = repair.target_status,
                request_data = COALESCE(workflow.request_data, '{}'::jsonb) || jsonb_build_object(
                    'customer', repair.customer,
                    'brand_name', repair.brand_name,
                    'material_code', repair.material_code,
                    'quantity', repair.quantity,
                    'required_date', repair.required_date,
                    'costing_creative_input_needed', repair.costing_creative_input_needed,
                    'costing_creative_input_remark', repair.costing_creative_input_remark,
                    'product_description', repair.product_description
                ),
                updated_at = now()
            FROM costing_release_repair AS repair
            WHERE workflow.id = repair.workflow_id
        """))

        connection.execute(text("""
            UPDATE create_sample_requests AS request
            SET status = repair.target_request_status,
                updated_at = now()
            FROM costing_release_repair AS repair
            WHERE request.id = repair.sample_request_id
              AND CASE
                    WHEN jsonb_typeof(repair.request_types) = 'array'
                    THEN jsonb_array_length(repair.request_types) = 1
                    ELSE FALSE
                  END
        """))


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


def _add_costing_creative_handoff_fields() -> None:
    """Persist Marketing's Creative choice and the two-workday Creative SLA."""
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS costing_creative_input_needed BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        connection.execute(text(
            "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS costing_creative_input_remark TEXT"
        ))
        connection.execute(text(
            "ALTER TABLE costing_workflows ADD COLUMN IF NOT EXISTS creative_due_at TIMESTAMPTZ"
        ))


def _backfill_design_request_creation_activity() -> None:
    """Ensure each existing Design request has a normalized creation audit row."""
    with engine.begin() as connection:
        connection.execute(text("""
            INSERT INTO sample_request_activity_logs (
                sample_request_id, request_sr_number, actor_user_id, actor_name,
                actor_department, action, from_status, to_status, payload, created_at
            )
            SELECT sample.id,
                   design.sr_number,
                   CASE WHEN EXISTS (
                       SELECT 1 FROM users WHERE users.id = design.created_by_user_id
                   ) THEN design.created_by_user_id ELSE NULL END,
                   COALESCE(NULLIF(design.created_by, ''), 'Legacy import'),
                   'Marketing',
                   'DESIGN_REQUEST_CREATED',
                   NULL,
                   design.status,
                   jsonb_build_object(
                       'design_request_id', design.id,
                       'request_code', design.request_code,
                       'number_of_designs', design.number_of_designs,
                       'legacy_backfill', true
                   ),
                   design.created_at
            FROM design_requests AS design
            LEFT JOIN create_sample_requests AS sample ON sample.sr_number = design.sr_number
            WHERE NOT EXISTS (
                SELECT 1
                FROM sample_request_activity_logs AS history
                WHERE history.action = 'DESIGN_REQUEST_CREATED'
                  AND history.payload->>'design_request_id' = design.id::text
            )
        """))


def _backfill_unambiguous_activity_actor_ids() -> None:
    """Attach historical activity rows to users only when the name is unique."""
    with engine.begin() as connection:
        connection.execute(text("""
            UPDATE sample_request_activity_logs AS activity
            SET actor_user_id = matching_user.id
            FROM (
                SELECT id, lower(trim(name)) AS normalized_name
                FROM users
                WHERE NULLIF(trim(name), '') IS NOT NULL
            ) AS matching_user
            WHERE activity.actor_user_id IS NULL
              AND lower(trim(COALESCE(activity.actor_name, ''))) = matching_user.normalized_name
              AND 1 = (
                  SELECT count(*)
                  FROM users AS candidate
                  WHERE lower(trim(COALESCE(candidate.name, ''))) = matching_user.normalized_name
              )
        """))


def _add_high_concurrency_indexes() -> None:
    """Add covering and composite indexes to eliminate table scans under high concurrency."""
    statements = (
        "CREATE INDEX IF NOT EXISTS ix_create_sample_requests_updated_id ON create_sample_requests (updated_at DESC, id DESC)",
        "CREATE INDEX IF NOT EXISTS ix_create_sample_requests_status ON create_sample_requests (status)",
        "CREATE INDEX IF NOT EXISTS ix_create_sample_requests_status_updated ON create_sample_requests (status, updated_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_create_sample_requests_year_status ON create_sample_requests (year, status, id DESC)",
        "CREATE INDEX IF NOT EXISTS ix_product_details_sample_request_char_name ON product_details (sample_request_id, characteristic_name)",
        "CREATE INDEX IF NOT EXISTS ix_design_requests_updated_id ON design_requests (updated_at DESC, id DESC)",
    )
    with engine.begin() as connection:
        for stmt in statements:
            connection.execute(text(stmt))


def _add_request_code_sequences() -> None:
    """Store per-type codes while making SR optional for non-Sample requests."""
    statements = (
        "CREATE TABLE IF NOT EXISTS request_code_sequences (prefix VARCHAR(8) NOT NULL, business_year_start INTEGER NOT NULL, last_value INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (prefix, business_year_start))",
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS request_codes JSONB NOT NULL DEFAULT '{}'::jsonb",
        "ALTER TABLE create_sample_requests ALTER COLUMN sr_number DROP NOT NULL",
        "ALTER TABLE program_requests ALTER COLUMN sr_number DROP NOT NULL",
        "ALTER TABLE mockup_workflows ADD COLUMN IF NOT EXISTS request_code VARCHAR(50)",
        "ALTER TABLE mockup_workflows ALTER COLUMN sr_number DROP NOT NULL",
        "ALTER TABLE mockup_workflow_logs ALTER COLUMN sr_number DROP NOT NULL",
        "ALTER TABLE costing_workflows ADD COLUMN IF NOT EXISTS request_code VARCHAR(50)",
        "ALTER TABLE costing_workflows ALTER COLUMN sr_number DROP NOT NULL",
        "ALTER TABLE costing_workflow_logs ALTER COLUMN sr_number DROP NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_mockup_workflows_request_code ON mockup_workflows (request_code) WHERE request_code IS NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_costing_workflows_request_code ON costing_workflows (request_code) WHERE request_code IS NOT NULL",
    )
    with engine.begin() as connection:
        for stmt in statements:
            connection.execute(text(stmt))

        # Resume numbering after any records already using the new format.
        sources = (
            ("FC", "SELECT request_code AS code FROM feasibility_requests"),
            ("PP", "SELECT request_code AS code FROM program_requests"),
            ("DR", "SELECT request_code AS code FROM design_requests UNION ALL SELECT request_codes->>'design' AS code FROM create_sample_requests"),
            ("CR", "SELECT request_code AS code FROM costing_workflows UNION ALL SELECT request_codes->>'costing' AS code FROM create_sample_requests"),
            ("MR", "SELECT request_code AS code FROM mockup_workflows UNION ALL SELECT request_codes->>'mockup' AS code FROM create_sample_requests"),
            ("SR", "SELECT sr_number AS code FROM create_sample_requests"),
        )
        for prefix, source_sql in sources:
            connection.execute(
                text(f"""
                INSERT INTO request_code_sequences (prefix, business_year_start, last_value)
                SELECT '{prefix}', 2000 + substring(code from '^{prefix}-([0-9]{{2}})-')::INTEGER,
                       MAX(substring(code from '-([0-9]+)$')::INTEGER)
                FROM ({source_sql}) AS existing_codes
                WHERE code ~ '^{prefix}-[0-9]{{2}}-[0-9]{{3,}}$'
                GROUP BY substring(code from '^{prefix}-([0-9]{{2}})-')::INTEGER
                ON CONFLICT (prefix, business_year_start) DO UPDATE
                SET last_value = GREATEST(request_code_sequences.last_value, EXCLUDED.last_value)
            """)  # nosec B608
            )
        connection.execute(text("""
            UPDATE mockup_workflows AS workflow
            SET request_code = request.request_codes->>'mockup'
            FROM create_sample_requests AS request
            WHERE request.id = workflow.sample_request_id
              AND workflow.request_code IS NULL
              AND NULLIF(request.request_codes->>'mockup', '') IS NOT NULL
        """))
        connection.execute(text("""
            UPDATE costing_workflows AS workflow
            SET request_code = request.request_codes->>'costing'
            FROM create_sample_requests AS request
            WHERE request.id = workflow.sample_request_id
              AND workflow.request_code IS NULL
              AND NULLIF(request.request_codes->>'costing', '') IS NOT NULL
        """))


def _add_scoped_request_reference_images() -> None:
    """Store up to two compressed image references per Sample/Mockup/Costing scope."""
    from app.models.sample_request import SampleRequestReferenceImage

    SampleRequestReferenceImage.__table__.create(bind=engine, checkfirst=True)


def _backfill_scoped_request_codes() -> None:
    """Give legacy non-Sample requests the same scoped codes as new requests."""
    prefix_by_scope = {"design": "DR", "mockup": "MR", "costing": "CR"}
    valid_code = re.compile(r"^(DR|MR|CR)-\d{2}-\d{3,}$")

    def business_year_start(year_value, created_value) -> int:
        year_match = re.match(r"^\s*(20\d{2})-\d{2,4}\s*$", str(year_value or ""))
        if year_match:
            return int(year_match.group(1))
        try:
            created_date = created_value.date() if isinstance(created_value, datetime) else date.fromisoformat(str(created_value)[:10])
        except (TypeError, ValueError):
            created_date = datetime.now().date()
        return created_date.year if created_date.month >= 10 else created_date.year - 1

    with engine.begin() as connection:
        rows = connection.execute(text("""
            SELECT request.id, request.sr_number, request.year, request.date_request_created,
                   request.created_at, request.material_code, request.request_types,
                   request.request_codes,
                   scope.sample_request_id AS has_scope_audit,
                   COALESCE(scope.design, false) AS audited_design,
                   COALESCE(scope.mockup, false) AS audited_mockup,
                   COALESCE(scope.sample, false) AS audited_sample,
                   COALESCE(scope.costing, false) AS audited_costing
            FROM create_sample_requests AS request
            LEFT JOIN sample_request_types AS scope ON scope.sample_request_id = request.id
            ORDER BY request.created_at, request.id
        """)).mappings().all()

        def allocate_code(prefix: str, year_start: int) -> str:
            sequence = connection.execute(text("""
                INSERT INTO request_code_sequences (prefix, business_year_start, last_value)
                VALUES (:prefix, :year_start, 1)
                ON CONFLICT (prefix, business_year_start) DO UPDATE
                SET last_value = request_code_sequences.last_value + 1
                RETURNING last_value
            """), {"prefix": prefix, "year_start": year_start}).scalar_one()
            return f"{prefix}-{year_start % 100:02d}-{sequence:03d}"

        for row in rows:
            request_types = set(row["request_types"] or [])
            if row["has_scope_audit"] is not None:
                request_types = {
                    scope for scope in ("design", "mockup", "sample", "costing")
                    if row[f"audited_{scope}"]
                }
            request_codes = dict(row["request_codes"] or {})
            changed = request_types != set(row["request_types"] or [])

            for scope, prefix in prefix_by_scope.items():
                if scope not in request_types:
                    continue
                current_code = str(request_codes.get(scope) or "").strip().upper()
                if valid_code.fullmatch(current_code) and current_code.startswith(f"{prefix}-"):
                    continue

                linked_code = None
                legacy_design_code = request_codes.get("design") or row["material_code"]
                if scope == "design":
                    linked_code = connection.execute(text("""
                        SELECT request_code FROM design_requests
                        WHERE (
                            (:sr_number IS NOT NULL AND sr_number = :sr_number)
                            OR (:legacy_code IS NOT NULL AND request_code = :legacy_code)
                        ) AND request_code ~ '^DR-[0-9]{2}-[0-9]{3,}$'
                        ORDER BY id LIMIT 1
                    """), {
                        "sr_number": row["sr_number"],
                        "legacy_code": legacy_design_code,
                    }).scalar()
                elif scope in {"mockup", "costing"}:
                    workflow_table = "mockup_workflows" if scope == "mockup" else "costing_workflows"
                    linked_code = connection.execute(
                        text(f"""
                        SELECT request_code FROM {workflow_table}
                        WHERE sample_request_id = :request_id
                          AND request_code ~ '^{prefix}-[0-9]{{2}}-[0-9]{{3,}}$'
                        LIMIT 1
                    """),  # nosec B608
                        {"request_id": row["id"]},
                    ).scalar()
                request_codes[scope] = linked_code or allocate_code(
                    prefix,
                    business_year_start(row["year"], row["date_request_created"] or row["created_at"]),
                )
                changed = True

                if scope == "mockup":
                    connection.execute(text("""
                        UPDATE mockup_workflows SET request_code = :code
                        WHERE sample_request_id = :request_id
                          AND (request_code IS NULL OR request_code !~ '^MR-[0-9]{2}-[0-9]{3,}$')
                    """), {"code": request_codes[scope], "request_id": row["id"]})
                elif scope == "costing":
                    connection.execute(text("""
                        UPDATE costing_workflows SET request_code = :code
                        WHERE sample_request_id = :request_id
                          AND (request_code IS NULL OR request_code !~ '^CR-[0-9]{2}-[0-9]{3,}$')
                    """), {"code": request_codes[scope], "request_id": row["id"]})
                elif scope == "design":
                    connection.execute(text("""
                        UPDATE design_requests SET request_code = :code
                        WHERE id = (
                            SELECT id FROM design_requests
                            WHERE (
                                (:sr_number IS NOT NULL AND sr_number = :sr_number)
                                OR (:legacy_code IS NOT NULL AND request_code = :legacy_code)
                            )
                            ORDER BY id LIMIT 1
                        ) AND request_code !~ '^DR-[0-9]{2}-[0-9]{3,}$'
                    """), {
                        "code": request_codes[scope],
                        "sr_number": row["sr_number"],
                        "legacy_code": legacy_design_code,
                    })

            if changed:
                material_code = row["material_code"] or ""
                if "sample" not in request_types:
                    material_code = next((request_codes[scope] for scope in ("design", "mockup", "costing") if request_codes.get(scope)), "")
                connection.execute(text("""
                    UPDATE create_sample_requests
                    SET request_codes = CAST(:request_codes AS jsonb),
                        material_code = :material_code,
                        request_types = CAST(:request_types AS jsonb)
                    WHERE id = :request_id
                """), {
                    "request_codes": json.dumps(request_codes),
                    "material_code": material_code,
                    "request_types": json.dumps(sorted(request_types)),
                    "request_id": row["id"],
                })

        # Standalone legacy Design rows may not have an SR parent to link them
        # to, so normalize their own code as well.
        design_rows = connection.execute(text("""
            SELECT id, request_code, sr_number, created_at
            FROM design_requests
            WHERE request_code !~ '^DR-[0-9]{2}-[0-9]{3,}$'
            ORDER BY created_at, id
        """)).mappings().all()
        for row in design_rows:
            code = None
            parent = None
            if row["sr_number"]:
                parent = connection.execute(text("""
                    SELECT id, year, date_request_created, created_at, material_code, request_types, request_codes
                    FROM create_sample_requests WHERE sr_number = :sr_number LIMIT 1
                """), {"sr_number": row["sr_number"]}).mappings().first()
                if parent:
                    parent_codes = dict(parent["request_codes"] or {})
                    existing = str(parent_codes.get("design") or "").strip().upper()
                    if valid_code.fullmatch(existing) and existing.startswith("DR-"):
                        code = existing
                    else:
                        code = allocate_code("DR", business_year_start(
                            parent["year"], parent["date_request_created"] or parent["created_at"]
                        ))
                        parent_codes["design"] = code
                        parent_types = set(parent["request_types"] or [])
                        parent_material = parent["material_code"] or ""
                        if "sample" not in parent_types:
                            parent_material = code
                        connection.execute(text("""
                            UPDATE create_sample_requests
                            SET request_codes = CAST(:request_codes AS jsonb), material_code = :material_code
                            WHERE id = :request_id
                        """), {
                            "request_codes": json.dumps(parent_codes),
                            "material_code": parent_material,
                            "request_id": parent["id"],
                        })
            if not code:
                code = allocate_code("DR", business_year_start(None, row["created_at"]))
            connection.execute(text("UPDATE design_requests SET request_code = :code WHERE id = :id"), {
                "code": code,
                "id": row["id"],
            })


def _index_feasibility_workflow() -> None:
    statements = (
        "CREATE INDEX IF NOT EXISTS ix_feasibility_requests_status ON feasibility_requests (status)",
        "CREATE INDEX IF NOT EXISTS ix_feasibility_activity_logs_feasibility_request_id ON feasibility_activity_logs (feasibility_request_id)",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def _add_costing_claim_fields() -> None:
    statements = (
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_costing_admin BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE costing_workflows ADD COLUMN IF NOT EXISTS claimed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
        "ALTER TABLE costing_workflows ADD COLUMN IF NOT EXISTS claimed_by VARCHAR(255)",
        "ALTER TABLE costing_workflows ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ",
        "CREATE INDEX IF NOT EXISTS ix_costing_workflows_claimed_by_user_id ON costing_workflows (claimed_by_user_id)",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def _link_design_requests_to_sample_requests() -> None:
    """Give Design workflow rows a stable parent link to their intake request."""
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE design_requests ADD COLUMN IF NOT EXISTS sample_request_id INTEGER"
        ))
        connection.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'fk_design_requests_sample_request'
                      AND conrelid = 'design_requests'::regclass
                ) THEN
                    ALTER TABLE design_requests
                    ADD CONSTRAINT fk_design_requests_sample_request
                    FOREIGN KEY (sample_request_id)
                    REFERENCES create_sample_requests(id) ON DELETE SET NULL;
                END IF;
            END $$
        """))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_design_requests_sample_request_id "
            "ON design_requests (sample_request_id)"
        ))
        connection.execute(text("""
            UPDATE design_requests AS design
            SET sample_request_id = (
                SELECT sample.id
                FROM create_sample_requests AS sample
                WHERE sample.request_codes->>'design' = design.request_code
                   OR (design.sr_number IS NOT NULL AND sample.sr_number = design.sr_number)
                ORDER BY
                    CASE WHEN sample.request_codes->>'design' = design.request_code THEN 0 ELSE 1 END,
                    sample.id DESC
                LIMIT 1
            )
            WHERE design.sample_request_id IS NULL
              AND EXISTS (
                  SELECT 1
                  FROM create_sample_requests AS sample
                  WHERE sample.request_codes->>'design' = design.request_code
                     OR (design.sr_number IS NOT NULL AND sample.sr_number = design.sr_number)
              )
        """))


MIGRATIONS: List[Tuple[str, str, Callable[[], None]]] = [
    ("0001_legacy_schema_bootstrap", "Record and run existing schema upgrades", _bootstrap_existing_schema),
    ("0002_feasibility_conversion_relations", "Connect Feasibility conversions to sample requests", _link_feasibility_conversions),
    ("0003_backfill_sample_request_activity", "Normalize legacy sample and design workflow events", _backfill_sample_request_activity),
    ("0004_index_request_type_scopes", "Index operational scopes and owner-filtered queues", _index_request_type_scopes),
    ("0005_sync_normalized_request_types", "Synchronize relational scope flags from request records", _synchronize_request_type_flags),
    ("0006_preserve_feasibility_activity_history", "Retain feasibility audit history when its request is deleted", _preserve_feasibility_activity_history),
    ("0007_costing_creative_handoff", "Persist conditional Creative routing and its SLA deadline", _add_costing_creative_handoff_fields),
    ("0008_complete_costing_creative_handoff_columns", "Ensure all Costing Creative handoff fields exist", _add_costing_creative_handoff_fields),
    ("0009_backfill_design_creation_activity", "Normalize creation history for existing Design requests", _backfill_design_request_creation_activity),
    ("0010_backfill_activity_actor_ids", "Attribute historical workflow logs to unambiguous users", _backfill_unambiguous_activity_actor_ids),
    ("0011_high_concurrency_database_indexes", "Add composite and covering indexes for 1000+ concurrency", _add_high_concurrency_indexes),
    ("0012_business_year_request_codes", "Add business-year request codes and optional sample identifiers", _add_request_code_sequences),
    ("0013_scoped_request_reference_images", "Store scope-specific Sample, Mockup, and Costing images", _add_scoped_request_reference_images),
    ("0014_backfill_scoped_request_codes", "Assign request codes to legacy scoped requests", _backfill_scoped_request_codes),
    ("0015_reconcile_released_costing_workflows", "Route released Costing requests out of Marketing", _reconcile_released_costing_workflows),
    ("0016_index_feasibility_workflow", "Index feasibility requests status and activity logs request_id", _index_feasibility_workflow),
    ("0017_costing_claim_tracking", "Add Costing task ownership and Costing administrator access", _add_costing_claim_fields),
    ("0018_design_sample_request_link", "Link Design workflow records to their Sample Request parent", _link_design_requests_to_sample_requests),
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


if __name__ == "__main__":
    apply_database_migrations()

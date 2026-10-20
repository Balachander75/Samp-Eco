from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=1800,
    pool_timeout=settings.DB_POOL_TIMEOUT_SECONDS,
    pool_use_lifo=True,
    connect_args={
        "connect_timeout": 5,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    },
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_downstream_schema():
    """Create the persistent Studio, Creative, and Costing tables if missing."""
    from app.models.downstream import CostingEstimation, CreativeBrief, StudioDieline

    for model in (StudioDieline, CreativeBrief, CostingEstimation):
        model.__table__.create(bind=engine, checkfirst=True)


def ensure_program_schema():
    """Create and upgrade the Program Planning tables in the configured database."""
    from app.models.program_request import (
        ProgramActivityLog,
        ProgramMaterialSpecification,
        ProgramRequest,
    )

    # These tables are also present in the legacy database. Creating them with
    # checkfirst makes a fresh backend-new database usable without resetting it.
    for model in (ProgramRequest, ProgramMaterialSpecification, ProgramActivityLog):
        model.__table__.create(bind=engine, checkfirst=True)

    statements = (
        "ALTER TABLE program_requests ALTER COLUMN sr_number DROP NOT NULL",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_seen_at TIMESTAMPTZ",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_seen_by VARCHAR(255)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_verdict VARCHAR(64)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_remark TEXT",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_signed_at TIMESTAMPTZ",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_signed_by VARCHAR(255)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_seen_at TIMESTAMPTZ",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_seen_by VARCHAR(255)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_verdict VARCHAR(64)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_remark TEXT",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_signed_at TIMESTAMPTZ",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_signed_by VARCHAR(255)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id)",
        "CREATE INDEX IF NOT EXISTS ix_program_requests_created_by_user_id ON program_requests (created_by_user_id)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_claimed_by_user_id INTEGER REFERENCES users(id)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_claimed_by VARCHAR(255)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_claimed_by_user_id INTEGER REFERENCES users(id)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_claimed_by VARCHAR(255)",
        "CREATE INDEX IF NOT EXISTS ix_program_requests_sampling_claimed_by_user_id ON program_requests (sampling_claimed_by_user_id)",
        "CREATE INDEX IF NOT EXISTS ix_program_requests_plant_claimed_by_user_id ON program_requests (plant_claimed_by_user_id)",
        "ALTER TABLE program_activity_logs ADD COLUMN IF NOT EXISTS pinned_by_marketing BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE program_activity_logs ADD COLUMN IF NOT EXISTS pinned_by VARCHAR(255)",
        "ALTER TABLE program_activity_logs ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE program_material_specifications ADD COLUMN IF NOT EXISTS promoted_sample_request_id INTEGER REFERENCES create_sample_requests(id) ON DELETE SET NULL",
        "ALTER TABLE program_material_specifications ADD COLUMN IF NOT EXISTS promoted_sr_number VARCHAR(50)",
        "CREATE INDEX IF NOT EXISTS ix_pms_promoted_sample_request_id ON program_material_specifications (promoted_sample_request_id)",
        "ALTER TABLE program_material_specifications ADD COLUMN IF NOT EXISTS plant_remark TEXT",
        "CREATE INDEX IF NOT EXISTS ix_program_requests_year_id ON program_requests (program_year, id DESC)",
        "CREATE INDEX IF NOT EXISTS ix_program_requests_status_id ON program_requests (status, id DESC)",
        "CREATE INDEX IF NOT EXISTS ix_program_materials_request_id_id ON program_material_specifications (program_request_id, id)",
        "CREATE INDEX IF NOT EXISTS ix_program_activity_request_id_id ON program_activity_logs (program_request_id, id)",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        connection.execute(text("""
            UPDATE program_requests AS p
            SET sampling_claimed_by_user_id = u.id,
                sampling_claimed_by = COALESCE(p.sampling_signed_by, u.name)
            FROM users AS u
            WHERE p.sampling_claimed_by_user_id IS NULL
              AND NULLIF(trim(p.sampling_signed_by), '') IS NOT NULL
              AND lower(trim(u.name)) = lower(trim(p.sampling_signed_by))
              AND 1 = (SELECT count(*) FROM users AS candidate
                       WHERE lower(trim(candidate.name)) = lower(trim(p.sampling_signed_by)))
        """))
        connection.execute(text("""
            UPDATE program_requests AS p
            SET plant_claimed_by_user_id = u.id,
                plant_claimed_by = COALESCE(p.plant_signed_by, u.name)
            FROM users AS u
            WHERE p.plant_claimed_by_user_id IS NULL
              AND NULLIF(trim(p.plant_signed_by), '') IS NOT NULL
              AND lower(trim(u.name)) = lower(trim(p.plant_signed_by))
              AND 1 = (SELECT count(*) FROM users AS candidate
                       WHERE lower(trim(candidate.name)) = lower(trim(p.plant_signed_by)))
        """))
        connection.execute(text("""
            UPDATE program_requests AS request
            SET created_by_user_id = matching_user.id
            FROM (
                SELECT id, lower(trim(name)) AS normalized_name
                FROM users
                WHERE NULLIF(trim(name), '') IS NOT NULL
            ) AS matching_user
            WHERE request.created_by_user_id IS NULL
              AND lower(trim(coalesce(request.created_by, ''))) = matching_user.normalized_name
              AND 1 = (
                SELECT count(*) FROM users AS candidate
                WHERE lower(trim(coalesce(candidate.name, ''))) = matching_user.normalized_name
              )
        """))


def ensure_request_workflow_schema():
    """Create dedicated Costing/Mockup workflow tables and import current requests once."""
    from app.models.request_workflows import (
        CostingWorkflow,
        CostingWorkflowLog,
        MockupWorkflow,
        MockupWorkflowLog,
    )

    for model in (MockupWorkflow, MockupWorkflowLog, CostingWorkflow, CostingWorkflowLog):
        model.__table__.create(bind=engine, checkfirst=True)

    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE costing_workflows ADD COLUMN IF NOT EXISTS creative_due_at TIMESTAMPTZ"
        ))

    statements = (
        """
        UPDATE create_sample_requests
        SET mockup_workflow_state = jsonb_set(
              COALESCE(mockup_workflow_state, '{}'::jsonb), '{stage}', '"sampling_review"'::jsonb, true)
        WHERE mockup_workflow_state->>'stage' = 'awaiting_marketing_acceptance'
           OR (mockup_workflow_state->>'stage' IS NULL
               AND lower(coalesce(status, '')) LIKE '%awaiting marketing mockup acceptance%')
        """,
        """
        INSERT INTO mockup_workflows
            (sample_request_id, sr_number, status, current_stage, workflow_data,
             created_by_user_id, started_at, created_at, updated_at)
        SELECT r.id, r.sr_number,
               CASE WHEN r.mockup_workflow_state->>'stage' = 'sampling_review' THEN 'Sampling Review (Mockup)'
                    ELSE COALESCE(r.status, 'In Progress') END,
               CASE WHEN r.mockup_workflow_state->>'stage' = 'awaiting_marketing_acceptance'
                          OR lower(coalesce(r.status, '')) LIKE '%awaiting marketing mockup acceptance%' THEN 'sampling_review'
                    ELSE COALESCE(NULLIF(r.mockup_workflow_state->>'stage', ''),
                 CASE WHEN lower(r.status) LIKE 'draft%' THEN 'marketing'
                      WHEN lower(r.status) LIKE '%studio%' THEN 'studio'
                      WHEN lower(r.status) LIKE '%marketing%accept%' THEN 'awaiting_marketing_acceptance'
                      WHEN lower(r.status) LIKE '%creative%approval%' THEN 'creative_approval'
                      ELSE 'creative' END) END,
               COALESCE(r.mockup_workflow_state, '{}'::jsonb), r.created_by_user_id,
               COALESCE(r.created_at, now()), COALESCE(r.created_at, now()), COALESCE(r.updated_at, now())
        FROM create_sample_requests AS r
        WHERE (r.request_types ? 'mockup' OR lower(coalesce(r.mockup_required, '')) = 'yes')
          AND NOT EXISTS (SELECT 1 FROM mockup_workflows w WHERE w.sample_request_id = r.id)
        ON CONFLICT (sample_request_id) DO NOTHING
        """,
        """
        INSERT INTO costing_workflows
            (sample_request_id, sr_number, status, current_stage, request_data, costing_output_path,
             created_by_user_id, started_at, created_at, updated_at)
        SELECT r.id, r.sr_number, COALESCE(r.status, 'In Progress'),
               CASE WHEN lower(r.status) LIKE '%sampling review%costing%' THEN 'sampling_review'
                    WHEN lower(r.status) LIKE '%approved%' OR lower(r.status) LIKE '%closed%' THEN 'done'
                    WHEN lower(r.status) LIKE '%cost%' OR lower(r.status) LIKE '%estimation%' THEN 'costing'
                    WHEN lower(r.status) LIKE '%creative%' THEN 'creative'
                    WHEN lower(r.status) LIKE 'draft%' THEN 'marketing'
                    ELSE 'creative' END,
               jsonb_build_object('customer', r.customer, 'brand_name', r.brand_name,
                 'material_code', r.material_code, 'barcode', r.barcode,
                 'customer_product_code', r.customer_product_code, 'unit_pc_pack', r.unit_pc_pack,
                 'quantity', r.qty_design_costing, 'required_date', r.costing_required_date,
                 'product_description', r.product_description, 'request_types', r.request_types),
               r.costing_output_path, r.created_by_user_id, COALESCE(r.created_at, now()),
               COALESCE(r.created_at, now()), COALESCE(r.updated_at, now())
        FROM create_sample_requests AS r
        WHERE r.request_types ? 'costing'
          AND NOT EXISTS (SELECT 1 FROM costing_workflows w WHERE w.sample_request_id = r.id)
        ON CONFLICT (sample_request_id) DO NOTHING
        """,
        """
        INSERT INTO mockup_workflow_logs
            (workflow_id, sample_request_id, sr_number, actor_name, actor_team, action,
             from_stage, to_stage, from_status, to_status, details, created_at)
        SELECT w.id, w.sample_request_id, w.sr_number, 'System migration', 'System',
               'LEGACY_WORKFLOW_IMPORTED', NULL, w.current_stage, NULL, w.status,
               jsonb_build_object('source', 'create_sample_requests.mockup_workflow_state'), w.created_at
        FROM mockup_workflows w
        WHERE NOT EXISTS (SELECT 1 FROM mockup_workflow_logs l WHERE l.workflow_id = w.id)
        """,
        """
        INSERT INTO costing_workflow_logs
            (workflow_id, sample_request_id, sr_number, actor_name, actor_team, action,
             from_stage, to_stage, from_status, to_status, details, created_at)
        SELECT w.id, w.sample_request_id, w.sr_number, 'System migration', 'System',
               'LEGACY_WORKFLOW_IMPORTED', NULL, w.current_stage, NULL, w.status,
               jsonb_build_object('source', 'create_sample_requests'), w.created_at
        FROM costing_workflows w
        WHERE NOT EXISTS (SELECT 1 FROM costing_workflow_logs l WHERE l.workflow_id = w.id)
        """,
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
def ensure_user_team_columns():
    """Bring older users tables up to the team fields used by the current User model."""
    statements = (
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS sub_role VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS team VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_team_head BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS plant_code VARCHAR(50)",
        "ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'",
        "CREATE INDEX IF NOT EXISTS ix_users_team ON users (team)",
        "CREATE INDEX IF NOT EXISTS ix_users_team_head ON users (team, is_team_head)",
        "CREATE INDEX IF NOT EXISTS ix_users_userid_lower ON users (lower(userid))",
        "CREATE INDEX IF NOT EXISTS ix_users_email_lower ON users (lower(email))",
        "UPDATE users SET team = 'marketing' WHERE NULLIF(trim(team), '') IS NULL AND (lower(coalesce(role, '')) LIKE '%marketing%' OR lower(coalesce(sub_role, '')) LIKE '%marketing%')",
        "UPDATE users SET team = 'samp' WHERE NULLIF(trim(team), '') IS NULL AND (lower(coalesce(role, '')) LIKE '%samp%' OR lower(coalesce(sub_role, '')) LIKE '%samp%' OR lower(coalesce(sub_role, '')) LIKE '%sampling%')",
        "UPDATE users SET team = 'plant' WHERE NULLIF(trim(team), '') IS NULL AND (lower(coalesce(role, '')) LIKE '%plant%' OR lower(coalesce(sub_role, '')) LIKE '%plant%')",
        "UPDATE users SET team = 'creative_studio' WHERE NULLIF(trim(team), '') IS NULL AND (lower(coalesce(role, '')) LIKE '%creative%' OR lower(coalesce(role, '')) LIKE '%studio%' OR lower(coalesce(sub_role, '')) LIKE '%creative%' OR lower(coalesce(sub_role, '')) LIKE '%studio%')",
        "UPDATE users SET is_team_head = TRUE WHERE NOT is_team_head AND lower(trim(role)) NOT IN ('admin', 'administrator') AND (lower(trim(role)) IN ('head', 'team head', 'department lead') OR lower(coalesce(sub_role, '')) LIKE '%head%' OR lower(coalesce(sub_role, '')) LIKE '%lead%')",
        "UPDATE users SET role = 'user' WHERE lower(trim(role)) IN ('head', 'team head', 'department lead')",
        "UPDATE users SET role = 'admin' WHERE lower(trim(role)) = 'administrator'",
        "UPDATE users SET role = 'user' WHERE lower(trim(role)) NOT IN ('admin', 'administrator') AND role IS DISTINCT FROM 'user'",
        "UPDATE users SET is_team_head = FALSE WHERE lower(trim(role)) IN ('admin', 'administrator') AND is_team_head",
        "UPDATE users SET is_team_head = FALSE WHERE is_team_head AND NULLIF(trim(team), '') IS NULL",
        """DO $$ BEGIN
             IF NOT EXISTS (
               SELECT 1 FROM pg_constraint
               WHERE conname = 'ck_users_team_head_requires_team'
                 AND conrelid = 'users'::regclass
             ) THEN
               ALTER TABLE users ADD CONSTRAINT ck_users_team_head_requires_team
                 CHECK (NOT is_team_head OR NULLIF(trim(team), '') IS NOT NULL);
             END IF;
           END; $$""",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_user_theme_column():
    """Add the per-user UI theme preference without disturbing existing accounts."""
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_id VARCHAR(20) NOT NULL DEFAULT 'emerald'"
        ))


def ensure_feasibility_workflow_columns():
    """Upgrade the scoped feasibility workflow and retire its duplicate legacy SR code."""
    statements = (
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS target_plant VARCHAR(100)",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS taken_by_samp_user_id INTEGER REFERENCES users(id)",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS feasibility_conditions TEXT",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS lead_time_note TEXT",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS samp_counter_date DATE",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS samp_counter_date_reason TEXT",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS samp_counter_date_proposed_at TIMESTAMPTZ",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS samp_counter_date_proposed_by VARCHAR(255)",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS samp_counter_date_proposed_by_user_id INTEGER REFERENCES users(id)",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS counter_date_decision VARCHAR(32)",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS counter_date_decision_at TIMESTAMPTZ",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS counter_date_decision_by VARCHAR(255)",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS counter_date_decision_by_user_id INTEGER REFERENCES users(id)",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS counter_date_decision_remark TEXT",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS counter_date_decision_due_at TIMESTAMPTZ",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS counter_date_wait_workdays INTEGER",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS samp_sla_paused_workdays INTEGER NOT NULL DEFAULT 0",
        "CREATE INDEX IF NOT EXISTS ix_feasibility_requests_counter_date_due ON feasibility_requests (counter_date_decision_due_at) WHERE counter_date_decision = 'pending'",
        "CREATE INDEX IF NOT EXISTS ix_feasibility_requests_target_plant ON feasibility_requests (target_plant)",
        "CREATE INDEX IF NOT EXISTS ix_feasibility_requests_taken_by_samp_user_id ON feasibility_requests (taken_by_samp_user_id)",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        connection.execute(text(
            """UPDATE feasibility_requests
               SET target_plant = COALESCE(
                   (SELECT name FROM plants WHERE code = '1505' ORDER BY id LIMIT 1),
                   '1505 - Khaniwade'
               )
               WHERE target_plant IS NULL OR trim(target_plant) = ''"""
        ))
        connection.execute(text(
            """UPDATE feasibility_requests
               SET request_code = 'FC-' || LPAD(id::text, GREATEST(4, LENGTH(id::text)), '0')
               WHERE request_code IS DISTINCT FROM 'FC-' || LPAD(id::text, GREATEST(4, LENGTH(id::text)), '0')"""
        ))
        connection.execute(text(
            "ALTER TABLE feasibility_requests DROP COLUMN IF EXISTS sr_number"
        ))
        connection.execute(text(
            "ALTER TABLE feasibility_requests DROP COLUMN IF EXISTS request_created_by"
        ))
        connection.execute(text(
            "ALTER TABLE feasibility_requests DROP COLUMN IF EXISTS reference_images"
        ))
        connection.execute(text(
            "DROP TABLE IF EXISTS feasibility_technical_attachments CASCADE"
        ))
        connection.execute(text(
            """UPDATE feasibility_requests
               SET custom_feasibility_type = LEFT(custom_feasibility_type, 25)
               WHERE LENGTH(custom_feasibility_type) > 25"""
        ))
        connection.execute(text(
            """UPDATE feasibility_requests
               SET description_notes = LEFT(description_notes, 75)
               WHERE LENGTH(description_notes) > 75"""
        ))
        connection.execute(text(
            """UPDATE feasibility_requests
               SET marketing_remarks = LEFT(marketing_remarks, 100)
               WHERE LENGTH(marketing_remarks) > 100"""
        ))
        connection.execute(text(
            "ALTER TABLE feasibility_requests ALTER COLUMN custom_feasibility_type TYPE VARCHAR(25)"
        ))
        connection.execute(text(
            "ALTER TABLE feasibility_requests ALTER COLUMN description_notes TYPE VARCHAR(75)"
        ))
        connection.execute(text(
            "ALTER TABLE feasibility_requests ALTER COLUMN marketing_remarks TYPE VARCHAR(100)"
        ))


def ensure_design_requests_table():
    """Create the durable design request table and align its ID sequence."""
    from app.models.sample_request import DesignRequest

    DesignRequest.__table__.create(bind=engine, checkfirst=True)
    with engine.begin() as connection:
        connection.execute(text(
            """SELECT setval(
                pg_get_serial_sequence('design_requests', 'id'),
                GREATEST(COALESCE((SELECT MAX(id) FROM design_requests), 0), 1),
                COALESCE((SELECT MAX(id) FROM design_requests), 0) > 0
            )"""
        ))


def ensure_design_workflow_columns():
    """Add fields for Creative submissions and Marketing decisions to existing databases."""
    statements = (
        "ALTER TABLE design_requests ADD COLUMN IF NOT EXISTS design_remarks TEXT",
        "ALTER TABLE design_requests ADD COLUMN IF NOT EXISTS reference_images JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE design_requests ADD COLUMN IF NOT EXISTS reference_links JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE design_requests ADD COLUMN IF NOT EXISTS creative_submissions JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE design_requests ADD COLUMN IF NOT EXISTS marketing_decision VARCHAR(40)",
        "ALTER TABLE design_requests ADD COLUMN IF NOT EXISTS remaining_design_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE design_requests ADD COLUMN IF NOT EXISTS workflow_state JSONB NOT NULL DEFAULT '{}'::jsonb",
        "ALTER TABLE design_requests ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id)",
        "CREATE INDEX IF NOT EXISTS ix_design_requests_created_by_user_id ON design_requests (created_by_user_id)",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_program_review_columns():
    """Add columns for dual review (Sampling & Plant) to program_requests."""
    statements = (
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_seen_at TIMESTAMPTZ",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_seen_by VARCHAR(255)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_verdict VARCHAR(64)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_remark TEXT",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_signed_at TIMESTAMPTZ",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_signed_by VARCHAR(255)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_seen_at TIMESTAMPTZ",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_seen_by VARCHAR(255)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_verdict VARCHAR(64)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_remark TEXT",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_signed_at TIMESTAMPTZ",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_signed_by VARCHAR(255)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id)",
        "CREATE INDEX IF NOT EXISTS ix_program_requests_created_by_user_id ON program_requests (created_by_user_id)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_claimed_by_user_id INTEGER REFERENCES users(id)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS sampling_claimed_by VARCHAR(255)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_claimed_by_user_id INTEGER REFERENCES users(id)",
        "ALTER TABLE program_requests ADD COLUMN IF NOT EXISTS plant_claimed_by VARCHAR(255)",
        "CREATE INDEX IF NOT EXISTS ix_program_requests_sampling_claimed_by_user_id ON program_requests (sampling_claimed_by_user_id)",
        "CREATE INDEX IF NOT EXISTS ix_program_requests_plant_claimed_by_user_id ON program_requests (plant_claimed_by_user_id)",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        connection.execute(text("""
            UPDATE program_requests AS p
            SET sampling_claimed_by_user_id = u.id,
                sampling_claimed_by = COALESCE(p.sampling_signed_by, u.name)
            FROM users AS u
            WHERE p.sampling_claimed_by_user_id IS NULL
              AND NULLIF(trim(p.sampling_signed_by), '') IS NOT NULL
              AND lower(trim(u.name)) = lower(trim(p.sampling_signed_by))
              AND 1 = (SELECT count(*) FROM users AS candidate
                       WHERE lower(trim(candidate.name)) = lower(trim(p.sampling_signed_by)))
        """))
        connection.execute(text("""
            UPDATE program_requests AS p
            SET plant_claimed_by_user_id = u.id,
                plant_claimed_by = COALESCE(p.plant_signed_by, u.name)
            FROM users AS u
            WHERE p.plant_claimed_by_user_id IS NULL
              AND NULLIF(trim(p.plant_signed_by), '') IS NOT NULL
              AND lower(trim(u.name)) = lower(trim(p.plant_signed_by))
              AND 1 = (SELECT count(*) FROM users AS candidate
                       WHERE lower(trim(candidate.name)) = lower(trim(p.plant_signed_by)))
        """))


def ensure_program_feedback_columns():
    """Add Marketing pin metadata to existing Program Planning activity rows."""
    statements = (
        "ALTER TABLE program_activity_logs ADD COLUMN IF NOT EXISTS pinned_by_marketing BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE program_activity_logs ADD COLUMN IF NOT EXISTS pinned_by VARCHAR(255)",
        "ALTER TABLE program_activity_logs ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_product_category_columns():
    """Add product merchandising category columns to create_sample_requests table."""
    statements = (
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS product_category VARCHAR(150)",
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS product_sub_category VARCHAR(150)",
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS product_third_category VARCHAR(150)",
        "CREATE INDEX IF NOT EXISTS ix_create_sample_requests_product_category ON create_sample_requests (product_category)",
        "CREATE INDEX IF NOT EXISTS ix_create_sample_requests_product_sub_category ON create_sample_requests (product_sub_category)",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_costing_detail_columns():
    """Add Costing details and Marketing's Creative handoff choice to existing databases."""
    statements = (
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS qty_per_pack VARCHAR(50)",
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS costing_required_date VARCHAR(50)",
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS costing_creative_input_needed BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS costing_creative_input_remark TEXT",
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS costing_counter_date VARCHAR(50)",
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS costing_output_path TEXT",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_sample_reference_columns():
    """Persist reference moodboards and links on sample request records."""
    statements = (
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS reference_images JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS reference_links JSONB NOT NULL DEFAULT '[]'::jsonb",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_sample_request_draft_keys():
    """Add retry-safe idempotency keys to existing sample request databases."""
    statements = (
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS client_draft_key VARCHAR(160)",
        "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_create_sample_requests_client_draft_key ON create_sample_requests (client_draft_key)",
        "CREATE INDEX IF NOT EXISTS ix_create_sample_requests_created_by_user_id ON create_sample_requests (created_by_user_id)",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        for table in ("create_sample_requests", "design_requests", "program_requests"):
            connection.execute(
                text(f"""
                UPDATE {table} AS request
                SET created_by_user_id = matching_user.id
                FROM (
                    SELECT id, lower(trim(name)) AS normalized_name
                    FROM users
                    WHERE NULLIF(trim(name), '') IS NOT NULL
                ) AS matching_user
                WHERE request.created_by_user_id IS NULL
                  AND lower(trim(coalesce(request.created_by, ''))) = matching_user.normalized_name
                  AND 1 = (
                    SELECT count(*) FROM users AS candidate
                    WHERE lower(trim(coalesce(candidate.name, ''))) = matching_user.normalized_name
                  )
            """)  # nosec B608
            )


def ensure_mockup_workflow_columns():
    """Persist Creative → Studio → Marketing mockup handoffs on sample requests."""
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS mockup_workflow_state JSONB NOT NULL DEFAULT '{}'::jsonb"
        ))
        connection.execute(text("""
            UPDATE create_sample_requests
            SET mockup_workflow_state = jsonb_set(
                jsonb_set(
                    COALESCE(mockup_workflow_state, '{}'::jsonb),
                    '{stage}', to_jsonb('creative_approval'::text), true
                ),
                '{creativeApprovalDueAt}',
                to_jsonb(COALESCE(
                    NULLIF(mockup_workflow_state->>'creativeApprovalDueAt', ''),
                    (timezone('utc', now()) + interval '24 hours')::text
                )),
                true
            ) || jsonb_build_object(
                'events', COALESCE(mockup_workflow_state->'events', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
                    'action', 'MOCKUP_LEGACY_OUTPUT_ROUTED_TO_CREATIVE_APPROVAL',
                    'title', 'Legacy Studio output routed to Creative approval',
                    'actorName', 'System',
                    'actorDepartment', 'System',
                    'timestamp', timezone('utc', now())::text
                ))
            ),
            updated_at = timezone('utc', now())
            WHERE COALESCE(mockup_workflow_state->>'stage', '') = 'marketing'
              AND NULLIF(trim(COALESCE(mockup_workflow_state->>'mockupUrl', mockup_workflow_state->>'mockup_url', '')), '') IS NOT NULL
              AND (request_types @> '["mockup"]'::jsonb OR lower(COALESCE(mockup_required, '')) = 'yes')
              AND lower(COALESCE(status, '')) NOT LIKE '%draft%'
              AND lower(COALESCE(status, '')) NOT LIKE '%closed%'
              AND lower(COALESCE(status, '')) NOT LIKE '%approved%'
        """))
        connection.execute(text("""
            UPDATE create_sample_requests
            SET mockup_workflow_state = jsonb_set(
                jsonb_set(
                    jsonb_set(
                        COALESCE(mockup_workflow_state, '{}'::jsonb),
                        '{stage}',
                        to_jsonb(CASE
                            WHEN COALESCE(mockup_workflow_state->>'designNeeded', mockup_workflow_state->>'design_needed') = 'false'
                                THEN 'studio'
                            ELSE 'creative'
                        END),
                        true
                    ),
                    CASE
                        WHEN COALESCE(mockup_workflow_state->>'designNeeded', mockup_workflow_state->>'design_needed') = 'false'
                            THEN ARRAY['releasedToStudioAt']::text[]
                        ELSE ARRAY['releasedToCreativeAt']::text[]
                    END,
                    COALESCE(
                        mockup_workflow_state -> (CASE
                            WHEN COALESCE(mockup_workflow_state->>'designNeeded', mockup_workflow_state->>'design_needed') = 'false'
                                THEN 'releasedToStudioAt'
                            ELSE 'releasedToCreativeAt'
                        END),
                        to_jsonb(timezone('utc', now())::text)
                    ),
                    true
                ),
                '{events}',
                COALESCE(mockup_workflow_state->'events', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
                    'action', CASE
                        WHEN COALESCE(mockup_workflow_state->>'designNeeded', mockup_workflow_state->>'design_needed') = 'false'
                            THEN 'MOCKUP_LEGACY_ROUTE_RECONCILED_TO_STUDIO'
                        ELSE 'MOCKUP_LEGACY_ROUTE_RECONCILED_TO_CREATIVE'
                    END,
                    'title', CASE
                        WHEN COALESCE(mockup_workflow_state->>'designNeeded', mockup_workflow_state->>'design_needed') = 'false'
                            THEN 'Legacy Mockup request routed to Studio'
                        ELSE 'Legacy Mockup request routed to Creative'
                    END,
                    'actorName', 'System',
                    'actorDepartment', 'System',
                    'timestamp', timezone('utc', now())::text
                )),
                true
            ),
            updated_at = timezone('utc', now())
            WHERE COALESCE(mockup_workflow_state->>'stage', 'marketing') = 'marketing'
              AND NULLIF(trim(COALESCE(mockup_workflow_state->>'mockupUrl', mockup_workflow_state->>'mockup_url', '')), '') IS NULL
              AND (request_types @> '["mockup"]'::jsonb OR lower(COALESCE(mockup_required, '')) = 'yes')
              AND lower(COALESCE(status, '')) NOT LIKE '%draft%'
              AND lower(COALESCE(status, '')) NOT LIKE '%smt%'
              AND lower(COALESCE(status, '')) NOT LIKE '%pending allocation%'
              AND lower(COALESCE(status, '')) NOT LIKE '%closed%'
              AND lower(COALESCE(status, '')) NOT LIKE '%dispatched%'
              AND lower(COALESCE(status, '')) NOT LIKE '%approved%'
              AND lower(COALESCE(status, '')) NOT LIKE '%rejected%'
              AND lower(COALESCE(status, '')) NOT LIKE '%cancelled%'
              AND lower(COALESCE(status, '')) NOT LIKE '%canceled%'
              AND lower(COALESCE(status, '')) NOT LIKE '%actual deal%'
        """))


def ensure_sample_request_types_default():
    """Ensure all sample requests have request_types defaulted to ['sample']."""
    statement = """
        UPDATE create_sample_requests
        SET request_types = '["sample"]'::jsonb
        WHERE request_types IS NULL
           OR request_types = '{}'::jsonb
           OR request_types = '[]'::jsonb
           OR jsonb_typeof(request_types) != 'array'
           OR jsonb_array_length(CASE WHEN jsonb_typeof(request_types) = 'array' THEN request_types ELSE '[]'::jsonb END) = 0
    """
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE create_sample_requests ADD COLUMN IF NOT EXISTS request_types JSONB NOT NULL DEFAULT '[]'::jsonb"
        ))
        connection.execute(text(statement))


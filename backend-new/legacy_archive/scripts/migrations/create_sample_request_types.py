"""Create sample_request_types table with cascade delete and backfill existing sample requests."""
from sqlalchemy import text
from app.database import engine


def main() -> None:
    ddl = """
    CREATE TABLE IF NOT EXISTS sample_request_types (
        id SERIAL PRIMARY KEY,
        sample_request_id INTEGER NOT NULL UNIQUE REFERENCES create_sample_requests(id) ON DELETE CASCADE,
        design BOOLEAN NOT NULL DEFAULT FALSE,
        mockup BOOLEAN NOT NULL DEFAULT FALSE,
        sample BOOLEAN NOT NULL DEFAULT FALSE,
        costing BOOLEAN NOT NULL DEFAULT FALSE,
        design_selected_at TIMESTAMPTZ,
        mockup_selected_at TIMESTAMPTZ,
        sample_selected_at TIMESTAMPTZ,
        costing_selected_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS ix_sample_request_types_sample_request_id ON sample_request_types(sample_request_id);
    """

    backfill = """
    INSERT INTO sample_request_types (
        sample_request_id,
        design,
        mockup,
        sample,
        costing,
        created_at,
        updated_at
    )
    SELECT 
        id,
        COALESCE(request_types::jsonb ? 'design', false),
        COALESCE(request_types::jsonb ? 'mockup', false),
        COALESCE(request_types::jsonb ? 'sample', false),
        COALESCE(request_types::jsonb ? 'costing', false),
        created_at,
        updated_at
    FROM create_sample_requests
    ON CONFLICT (sample_request_id) DO NOTHING;
    """

    with engine.begin() as conn:
        conn.execute(text(ddl))
        conn.execute(text(backfill))
    print("Migration create_sample_request_types executed successfully and existing records backfilled.")


if __name__ == "__main__":
    main()

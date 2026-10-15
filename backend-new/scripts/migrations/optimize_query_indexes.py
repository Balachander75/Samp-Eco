"""Add online indexes for the high-volume SAMP query paths.

Run from ``backend-new`` with the backend database configured:
    python scripts/migrations/optimize_query_indexes.py

Indexes are built CONCURRENTLY so normal application reads and writes continue.
The script is safe to re-run and refreshes planner statistics when finished.
"""

import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

backend_dir = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(backend_dir))

from app.database import engine


INDEX_STATEMENTS = (
    # Sample request lists are ordered newest first and commonly restricted by FY.
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_create_sample_requests_year_id "
    "ON create_sample_requests (year, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_create_sample_requests_plant_year_id "
    "ON create_sample_requests (target_plant, year, id DESC)",
    # Product-detail lookup feeds catalog binding joins and per-request summaries.
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_product_details_request_id_id "
    "ON product_details (sample_request_id, id)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_product_details_binding_lookup "
    "ON product_details ("
    "sample_request_id, "
    "(regexp_replace(lower(coalesce(class_name, ''::character varying)), '[^a-z0-9]+', '', 'g')), "
    "(regexp_replace(lower(coalesce(characteristic_name, ''::character varying)), '[^a-z0-9]+', '', 'g'))"
    ")",
    # Global binding-facet aggregation starts from characteristic type then joins products.
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_product_details_binding_scan "
    "ON product_details ("
    "(regexp_replace(lower(coalesce(class_name, ''::character varying)), '[^a-z0-9]+', '', 'g')), "
    "(regexp_replace(lower(coalesce(characteristic_name, ''::character varying)), '[^a-z0-9]+', '', 'g')), "
    "sample_request_id"
    ")",
    # Hierarchical catalog filters normalize labels before exact comparisons.
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_create_sample_requests_taxonomy_normalized "
    "ON create_sample_requests ("
    "(regexp_replace(lower(coalesce(product_category, ''::character varying)), '[^a-z0-9]+', '', 'g')), "
    "(regexp_replace(lower(coalesce(product_sub_category, ''::character varying)), '[^a-z0-9]+', '', 'g')), "
    "(regexp_replace(lower(coalesce(product_third_category, ''::character varying)), '[^a-z0-9]+', '', 'g'))"
    ")",
    # Program queues filter by year/status/owner and return newest request IDs first.
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_requests_year_id "
    "ON program_requests (program_year, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_requests_status_id "
    "ON program_requests (status, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_requests_creator_id_id "
    "ON program_requests (created_by_user_id, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_requests_sampling_claim_id_id "
    "ON program_requests (sampling_claimed_by_user_id, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_requests_plant_claim_id_id "
    "ON program_requests (plant_claimed_by_user_id, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_requests_normalized_plant_id "
    "ON program_requests ("
    "(regexp_replace(lower(coalesce(target_plant, ''::character varying)), '[^a-z0-9]+', ' ', 'g')), id DESC"
    ")",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_materials_request_id_id "
    "ON program_material_specifications (program_request_id, id)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_program_activity_request_id_id "
    "ON program_activity_logs (program_request_id, id)",
    # Feasibility desk filtering, chronological FY scans, and due-date automation.
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_requests_raised_id "
    "ON feasibility_requests (request_raised_at, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_requests_status_id "
    "ON feasibility_requests (status, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_requests_creator_id_id "
    "ON feasibility_requests (created_by_user_id, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_requests_samp_owner_id_id "
    "ON feasibility_requests (taken_by_samp_user_id, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_requests_due_pending "
    "ON feasibility_requests (counter_date_decision_due_at) "
    "WHERE counter_date_decision = 'pending'",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_activity_request_id_id "
    "ON feasibility_activity_logs (feasibility_request_id, id)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feasibility_images_request_sort "
    "ON feasibility_reference_images (feasibility_request_id, sort_order)",
    # Case-insensitive exact lookups and product-characteristic ordering.
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_lower_userid "
    "ON users (lower(userid))",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_lower_email "
    "ON users (lower(email))",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_normalized_name "
    "ON users (lower(trim(name)))",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_team_head_name "
    "ON users (lower(team), is_team_head DESC, name)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_customers_lower_name "
    "ON customers (lower(name))",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_plants_lower_code "
    "ON plants (lower(code))",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_plants_lower_name "
    "ON plants (lower(name))",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_product_characteristics_active_class_sequence "
    "ON product_characteristics (upper(class_name), sequence) WHERE is_active IS TRUE",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_sample_activity_request_id_id "
    "ON sample_request_activity_logs (sample_request_id, id)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_design_requests_year_id "
    "ON design_requests (program_year, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_login_audit_created_id "
    "ON login_audit_logs (created_at DESC, id DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_login_audit_failed_identifier_created "
    "ON login_audit_logs (lower(identifier), created_at DESC) "
    "WHERE status IN ('FAILED_CREDENTIALS', 'FAILED_RATE_LIMITED')",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_login_audit_failed_ip_created "
    "ON login_audit_logs (ip_address, created_at DESC) "
    "WHERE status IN ('FAILED_CREDENTIALS', 'FAILED_RATE_LIMITED')",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_refresh_tokens_expired_at "
    "ON refresh_tokens (expires_at)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_refresh_tokens_old_revoked "
    "ON refresh_tokens (created_at, id) WHERE is_revoked IS TRUE",
)

TRIGRAM_INDEX_STATEMENTS = (
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_create_sample_requests_customer_trgm "
    "ON create_sample_requests USING gin (customer gin_trgm_ops)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_create_sample_requests_creator_trgm "
    "ON create_sample_requests USING gin (created_by gin_trgm_ops)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_create_sample_requests_material_trgm "
    "ON create_sample_requests USING gin (material_code gin_trgm_ops)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_create_sample_requests_description_trgm "
    "ON create_sample_requests USING gin (product_description gin_trgm_ops)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_customers_name_trgm "
    "ON customers USING gin (name gin_trgm_ops)",
)

ANALYZE_STATEMENTS = (
    "ANALYZE create_sample_requests",
    "ANALYZE product_details",
    "ANALYZE product_characteristics",
    "ANALYZE program_requests",
    "ANALYZE program_material_specifications",
    "ANALYZE program_activity_logs",
    "ANALYZE feasibility_requests",
    "ANALYZE feasibility_activity_logs",
    "ANALYZE feasibility_reference_images",
    "ANALYZE design_requests",
    "ANALYZE customers",
    "ANALYZE users",
    "ANALYZE plants",
    "ANALYZE sample_request_activity_logs",
    "ANALYZE login_audit_logs",
)


def run_migration() -> None:
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        trigram_available = False
        try:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
            trigram_available = True
        except SQLAlchemyError as exc:
            print(f"pg_trgm unavailable; substring indexes skipped ({type(exc).__name__}).")

        for statement in INDEX_STATEMENTS:
            connection.execute(text(statement))
        if trigram_available:
            for statement in TRIGRAM_INDEX_STATEMENTS:
                connection.execute(text(statement))
        for statement in ANALYZE_STATEMENTS:
            connection.execute(text(statement))


if __name__ == "__main__":
    run_migration()
    print("Query indexes are ready and planner statistics have been refreshed.")

# Database Queries & Schema (`db/`)

This directory contains the complete database setup for **Navneet SAMP ERP** (PostgreSQL 14+).

## Files

- **`schema.sql`**: Full DDL schema — tables (`users`, `plants`, `customers`, `create_sample_requests`, `sample_request_types`, `product_characteristics`, `product_details`, `design_requests`, `design_request_activity_logs`, `feasibility_requests`, `feasibility_activity_logs`, `feasibility_reference_images`, `program_requests`, `program_material_specifications`, `program_activity_logs`, `refresh_tokens`, `login_audit_logs`), sequences, triggers, constraints, and indexes.
- **`seed_data.sql`**: Full seed & master data queries — manufacturing plants, admin user, 199 corporate customers, and packaging product characteristics catalog.

## Quick Setup Instructions

The active `backend-new` app applies numbered upgrades from `backend-new/app/migrations.py` when automatic schema migration is enabled and records them in `schema_migrations`; a PostgreSQL advisory lock serializes concurrent workers. Production deployments with `AUTO_SCHEMA_MIGRATION=false` run `python -m app.migrations` from `backend-new` before deploying workers, followed by the documented additive schema and index scripts. Keep new schema changes in numbered migrations instead of running legacy one-off scripts.

`backend-new` provisions the Seasonal Program Planning tables (`program_requests`, `program_material_specifications`, and `program_activity_logs`), workflow tables, and downstream Studio/Creative/Costing tables in its configured `DATABASE_URL` at startup when automatic schema migration is enabled. The corresponding one-time scripts can prepare these schemas before a production deploy.

The schema includes `sample_request_activity_logs` for durable request history, preserves Feasibility activity rows with a request-code snapshot when a request is deleted, and includes `schema_migrations` for applied upgrades.

Accepted Feasibility requests link to one commercial request through a unique foreign key. Marketing can create Sampling, Costing, or both scopes in one transaction, with normalized scope flags, selection timestamps, and conversion audit entries committed together. Sample-request events are stored in `sample_request_activity_logs`; existing Mockup and linked Design events are imported from workflow JSON, and sample updates, status changes, scope changes, and Mockup/Sampling handoffs write new audit rows in the same transaction as the state change. The Costing queue uses an indexed JSONB scope filter to avoid loading unrelated requests. Legacy scope flags are reconciled from each request's authoritative `request_types` list during migration.

User access is stored on `users.team` and `users.is_team_head`. The account `role` is reserved for global privilege (`admin`); ordinary accounts use `user`. Team Heads are read-only in operational workflow APIs. On startup, the backend fills missing team assignments from legacy role/designation labels, moves legacy head labels into `is_team_head`, and creates the team/head lookup index.

Request creator IDs are persisted on Marketing sample, design, program, and feasibility requests. Ordinary Marketing members only receive their own requests from request lists and details; Team Heads can read their team's queue. SAMP feasibility reviews and Creative design requests keep a single persisted claimant, while program planning keeps separate SAMP and Plant claim owners. A member who has claimed a task sees it in their own queue; other members cannot open or claim that same task. Startup migrations add the owner columns and indexes to existing databases and backfill unambiguous legacy creator names.

```bash
# 1. Create database
createdb -U postgres -h localhost navneet_samp

# 2. Run schema queries
psql -U postgres -h localhost -d navneet_samp -f db/schema.sql

# 3. Seed master data
psql -U postgres -h localhost -d navneet_samp -f db/seed_data.sql
```

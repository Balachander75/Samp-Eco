# SAMP backend-new deployment

## Runtime

Use Python 3.11 or later. Install `requirements.txt`, configure the environment, apply migrations, then start the API with `python run.py`. In production, `WEB_CONCURRENCY` controls Uvicorn worker count; schema changes are deliberately not run by each web worker.

Required production settings:

```dotenv
APP_ENV=production
DEBUG=false
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@DB_HOST:5432/DB_NAME
JWT_SECRET_KEY=<unique random secret of at least 32 characters>
ALLOWED_HOSTS=["api.example.com"]
CORS_ORIGINS=["https://portal.example.com"]
AUTO_SCHEMA_MIGRATION=false
WEB_CONCURRENCY=2
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=2
```

Generate a secret with a deployment secret manager or a cryptographically secure random generator. Do not commit `.env` or put secrets in the frontend build. For same-origin hosting, set `CORS_ORIGINS=[]`. If the API is behind a reverse proxy, set `TRUSTED_PROXY_IPS` to the proxy's exact IP addresses or CIDR ranges; otherwise forwarded client-IP headers are ignored. `ALLOWED_HOSTS` contains hostnames only, without scheme or path.

### Database connection budget

Each API worker can open up to `DB_POOL_SIZE + DB_MAX_OVERFLOW` PostgreSQL connections. Keep the total across all API replicas, migration jobs, and other services below PostgreSQL's `max_connections`, leaving capacity for administration and maintenance. For example, 3 replicas × 2 workers × (5 + 2) permits up to 42 API connections. Set pool size from that budget and measured concurrency; increasing it without a database connection budget can make latency and availability worse.

The engine uses bounded pools, connection health checks, connection recycling, and a finite pool wait. `/health` is a liveness check; `/ready` checks database connectivity and should be used by the deployment's readiness probe. API responses are not cached, production docs are disabled, and the server applies trusted-host, compression, CORS, and security-header middleware.

Large queue and product-search endpoints cap a single response at 5,000 rows. Sample, program, and feasibility queues accept a `before_id` keyset cursor; use that cursor for deep queue navigation instead of large offsets. The frontend currently requests its selected business-year data in one call, so keep business-year views scoped and introduce incremental loading before a single year grows beyond that response cap.

## Migrations and indexes

Run these once per release, before sending traffic to new workers, from this directory with the production database environment loaded:

```powershell
python -m app.migrations
python -m scripts.migrations.ensure_program_schema
python -m scripts.migrations.ensure_request_workflow_schema
python -m scripts.migrations.ensure_downstream_schema
python -m scripts.migrations.optimize_query_indexes
```

The versioned migration command applies the existing schema upgrades once under a PostgreSQL advisory lock and records them in `schema_migrations`. The schema commands apply additive Program Planning, workflow, and downstream Creative/Studio/Costing tables; the index command builds indexes concurrently, enables `pg_trgm` when database permissions allow it, and refreshes planner statistics. It can be rerun safely. The trigram indexes are optional; exact-match and queue indexes are still installed if extension privileges are unavailable. Review migration output before sending traffic.

Historical one-off repair/import scripts are preserved under [`legacy_archive/`](legacy_archive/README.md) for reference; they are not part of the active migration sequence.

Keep PostgreSQL backups and point-in-time recovery enabled. Take a restorable backup before schema releases that change stored data. Do not run schema migrations simultaneously from multiple API workers.

## Frontend

Build `frontend-new` with `npm ci` and `npm run build`; serve `dist/` over HTTPS and configure the web server to fall back to `index.html` for client-side routes. Set `VITE_API_URL` to the API origin before building, or leave it empty when the reverse proxy serves `/api` on the same origin. `VITE_API_BASE_URL` remains accepted for compatibility. Vite variables are embedded into the public bundle and must never contain credentials.

Set an upload/body-size limit at the reverse proxy to match the application's reference-image workflow. Terminate TLS at the edge, forward only trusted client-IP headers, and expose `/health` and `/ready` only to the platform's probes where practical.

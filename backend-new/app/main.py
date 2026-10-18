"""
Navneet SAMP ERP — FastAPI Application Entry Point (backend-new)
Authentication, master/header data, feasibility, and Program Planning services.
"""
import logging
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app.auth.permissions import require_workflow_write_access
from app.routers import auth, downstream, feasibility, master, program_requests, request_workflows, sample_requests
from app.database import (
    SessionLocal,
    engine,
    ensure_downstream_schema,
    ensure_program_schema,
    ensure_request_workflow_schema,
)
from app.migrations import apply_database_migrations
from app.auth.security import prune_expired_refresh_tokens

logger = logging.getLogger("uvicorn.error")


def _prune_refresh_tokens_once() -> int:
    db = SessionLocal()
    try:
        return prune_expired_refresh_tokens(
            db,
            older_than_days=settings.REFRESH_TOKEN_RETENTION_DAYS,
        )
    finally:
        db.close()


async def _refresh_token_cleanup_loop():
    while True:
        await asyncio.sleep(settings.REFRESH_TOKEN_CLEANUP_INTERVAL_SECONDS)
        try:
            deleted = await asyncio.to_thread(_prune_refresh_tokens_once)
            if deleted:
                logger.info("[Maintenance] Pruned %s stale refresh tokens.", deleted)
        except Exception:
            logger.exception("[Maintenance] Refresh-token cleanup failed.")


def _auto_accept_feasibility_proposals_once() -> int:
    from app.services.feasibility_service import FeasibilityService
    db = SessionLocal()
    try:
        return FeasibilityService.auto_accept_due_counter_dates(db)
    finally:
        db.close()


async def _feasibility_auto_accept_loop():
    while True:
        await asyncio.sleep(60)
        try:
            count = await asyncio.to_thread(_auto_accept_feasibility_proposals_once)
            if count:
                logger.info("[Maintenance] Auto-accepted %s due feasibility counter-dates.", count)
        except Exception:
            logger.exception("[Maintenance] Feasibility counter-date auto-accept background loop failed.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[Startup] Navneet SAMP backend-new initialized.")
    if settings.AUTO_SCHEMA_MIGRATION:
        apply_database_migrations()
        ensure_program_schema()
        ensure_request_workflow_schema()
        ensure_downstream_schema()
    else:
        logger.info("[Startup] Runtime schema DDL disabled; deployment migrations must be applied before traffic.")
    cleanup_task = asyncio.create_task(_refresh_token_cleanup_loop())
    counter_date_task = asyncio.create_task(_feasibility_auto_accept_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        counter_date_task.cancel()
        for task in (cleanup_task, counter_date_task):
            try:
                await task
            except asyncio.CancelledError:
                pass
        engine.dispose()

app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise authentication, reference data, request workflows, and downstream operational services.",
    version="1.0.0",
    debug=settings.DEBUG,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https:;",
    )
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "private, no-store")
    if settings.APP_ENV.strip().lower() in ("production", "prod"):
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    return response



# Mount Routers
app.include_router(auth.router)
app.include_router(master.router)
app.include_router(
    feasibility.router,
    dependencies=[Depends(require_workflow_write_access)],
)
app.include_router(
    program_requests.router,
    dependencies=[Depends(require_workflow_write_access)],
)
app.include_router(
    sample_requests.router,
    dependencies=[Depends(require_workflow_write_access)],
)
app.include_router(
    request_workflows.router,
    dependencies=[Depends(require_workflow_write_access)],
)
app.include_router(
    downstream.router,
    dependencies=[Depends(require_workflow_write_access)],
)

@app.get("/", tags=["Health"])
def root():
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "auth": "live",
    }

@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}


@app.get("/ready", include_in_schema=False)
def readiness():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("[Readiness] Database check failed.")
        raise HTTPException(status_code=503, detail="Service is not ready")
    return {"status": "ready", "database": "ready"}


# Keep CORS outside FastAPI's ServerErrorMiddleware so unhandled API errors
# still carry CORS headers. This lets the frontend receive the real 500
# response instead of reporting a misleading browser CORS failure.
fastapi_app = app
app = CORSMiddleware(
    fastapi_app,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=(
        r"^https?://(localhost|127\.0\.0\.1|(?:\d{1,3}\.){3}\d{1,3})(:\d+)?$"
        if settings.DEBUG
        else None
    ),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
    max_age=600,
)
# Preserve FastAPI's standard test override hook on the exported ASGI app.
app.dependency_overrides = fastapi_app.dependency_overrides

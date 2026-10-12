"""
Navneet SAMP ERP — FastAPI Application Entry Point

Startup sequence:
1. Apply versioned database schema and data migrations
2. Mount CORS middleware (strict allowlist)
3. Register all routers
"""
import asyncio
import logging
import re
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from app.config import settings
from app.database import SessionLocal
from app.migrations import apply_database_migrations
from app.routers import auth, feasibility, master, program_requests, sample_requests
from app.auth.permissions import require_workflow_write_access

logger = logging.getLogger("uvicorn.error")


# ---------------------------------------------------------------------------
# Application Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks before serving requests."""
    apply_database_migrations()
    try:
        from app.services.downstream_service import DownstreamService
        from app.auth.security import prune_expired_refresh_tokens
        with SessionLocal() as db:
            DownstreamService(db).seed_if_empty()
            pruned_tokens = prune_expired_refresh_tokens(db, older_than_days=14)
            if pruned_tokens:
                logger.info("[Startup] Cleaned up %d expired/revoked refresh token(s).", pruned_tokens)
    except Exception as e:
        logger.warning("[Startup] Downstream seeding or token prune skipped: %s", e)
    logger.info("[Startup] Database migrations applied.")
    from app.services.feasibility_service import FeasibilityService

    def process_due_counter_dates():
        with SessionLocal() as db:
            return FeasibilityService.auto_accept_due_counter_dates(db)

    async def auto_accept_counter_dates():
        while True:
            try:
                count = await asyncio.to_thread(process_due_counter_dates)
                if count:
                    logger.info("[Feasibility] Auto-accepted %s expired counter-date proposal(s).", count)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("[Feasibility] Counter-date auto-accept worker failed")
            await asyncio.sleep(30)

    counter_date_worker = asyncio.create_task(auto_accept_counter_dates())
    yield
    counter_date_worker.cancel()
    try:
        await counter_date_worker
    except asyncio.CancelledError:
        pass



# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Enterprise Packaging & Sampling Workflow API for Navneet Education Ltd. "
        "Authentication and reference master data are live. Operational modules are being rebuilt from scratch."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)



# ---------------------------------------------------------------------------
# Global Exception Handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all handler so unhandled errors always return structured JSON without leaking traces."""
    logger.error("Unhandled Exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    origin = request.headers.get("origin")
    cors_headers = {}
    if origin and (
        origin in settings.CORS_ORIGINS
        or re.fullmatch(r"https?://(localhost|127\.0\.0\.1)(:\d+)?", origin)
    ):
        # Unhandled exceptions are converted by Starlette's outer server-error
        # middleware, outside CORSMiddleware. Preserve CORS so clients can read
        # the structured 500 response instead of reporting a misleading fetch error.
        cors_headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return JSONResponse(
        status_code=500,
        headers=cors_headers,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again or contact support.",
            },
        },
    )


# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["http://localhost:5173"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth.router)
app.include_router(master.router)
app.include_router(feasibility.router, dependencies=[Depends(require_workflow_write_access)])
app.include_router(program_requests.router, dependencies=[Depends(require_workflow_write_access)])
app.include_router(sample_requests.router, dependencies=[Depends(require_workflow_write_access)])


# ---------------------------------------------------------------------------
# Health Endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"], summary="API root")
def root():
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "auth": "live",
        "other_modules": "rebuilding from scratch",
    }


@app.get("/health", tags=["Health"], summary="Lightweight health ping")
def health():
    return {"status": "healthy"}

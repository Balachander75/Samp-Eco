"""
Authentication Router
Handles /api/auth/login, /api/auth/refresh, /api/auth/logout, /api/auth/me,
and /api/auth/audit-logs with full production-level JWT auth, sliding-window
brute-force rate limiting, refresh token rotation, and security telemetry.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from sqlalchemy.orm import Session
from datetime import datetime

from app.config import settings
from app.database import get_db
from app.models.master import User, LoginAuditLog
from app.auth.rate_limiter import login_rate_limiter
from app.auth.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    rotate_refresh_token,
    revoke_refresh_token,
    get_current_user,
    require_admin,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
ThemeId = Literal[
    "emerald",
    "ocean",
    "violet",
    "amber",
    "rose",
    "midnight",
    "forest-night",
    "nocturne",
    "neo-brutalism",
    "nordic-frost",
    "terracotta",
    "tokyo-neon",
    "titanium",
]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    """Accept login by userid OR email, plus password."""
    identifier: Optional[str] = Field(
        None,
        description="Username (userid) or email address",
        examples=["Admin", "parin.dedhia@navneet.com"],
    )
    # legacy aliases sent by existing clients
    userid: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    password: str = Field(..., min_length=1, description="Account password")
    remember_me: Optional[bool] = True


class UserOut(BaseModel):
    id: int
    name: str
    userid: str
    email: str
    role: str
    sub_role: Optional[str] = None
    team: Optional[str] = None
    is_team_head: bool = False
    plant_code: Optional[str] = None
    plant_codes: List[str] = Field(default_factory=list)
    theme_id: ThemeId = "emerald"
    is_active: bool
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., description="Active refresh token")


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class ThemePreferenceUpdate(BaseModel):
    theme_id: ThemeId


class ThemePreferenceOut(BaseModel):
    theme_id: ThemeId


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    identifier: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    status: str
    failure_reason: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ErrorDetail(BaseModel):
    code: str
    message: str
    field: Optional[str] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_to_out(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "userid": user.userid,
        "email": user.email,
        "role": user.role,
        "sub_role": user.sub_role,
        "team": getattr(user, "team", None),
        "is_team_head": getattr(user, "is_team_head", False),
        "plant_code": getattr(user, "plant_code", None),
        "plant_codes": getattr(user, "plant_codes", []),
        "theme_id": getattr(user, "theme_id", "emerald"),
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _resolve_identifier(payload: LoginRequest) -> str:
    """Return the first non-empty identifier from the request."""
    return (
        payload.identifier
        or payload.userid
        or payload.username
        or payload.email
        or ""
    ).strip()


def _get_client_ip(request: Request) -> str:
    """Extract client IP respecting X-Forwarded-For reverse proxy header."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _record_audit(
    db: Session,
    identifier: str,
    status_label: str,
    ip_address: str,
    user_agent: str,
    user_id: Optional[int] = None,
    failure_reason: Optional[str] = None,
):
    """Safely log security telemetry without interrupting request lifecycle."""
    try:
        log = LoginAuditLog(
            user_id=user_id,
            identifier=identifier[:255],
            ip_address=ip_address[:100],
            user_agent=user_agent[:500],
            status=status_label,
            failure_reason=failure_reason[:255] if failure_reason else None,
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/login",
    response_model=LoginResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Invalid credentials"},
        403: {"model": ErrorResponse, "description": "Account deactivated"},
        422: {"description": "Validation error"},
        429: {"model": ErrorResponse, "description": "Too many failed attempts"},
    },
    summary="Sign in to the Navneet SAMP Enterprise Portal",
)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a user with their userid/email and password.
    Includes sliding-window brute-force rate limiting and login audit telemetry.
    Returns short-lived access token + long-lived rotating refresh token.
    """
    identifier = _resolve_identifier(payload)
    client_ip = _get_client_ip(request)
    user_agent = request.headers.get("user-agent", "unknown")

    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "success": False,
                "error": {
                    "code": "MISSING_IDENTIFIER",
                    "message": "Please provide your username or email address.",
                    "field": "identifier",
                },
            },
        )

    # 1. Dual-Tier Rate Limiter
    # A) Account-level limit (prevents targeted brute-forcing against a specific user)
    id_rate_key = f"id:{identifier.lower()}"
    is_id_limited, id_retry_after = login_rate_limiter.is_rate_limited(
        id_rate_key,
        max_attempts=settings.RATE_LIMIT_LOGIN_MAX_ATTEMPTS,
        window_seconds=settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
    )

    # B) IP-level limit (prevents distributed password spraying across many users from the same IP)
    ip_rate_key = f"ip:{client_ip}"
    is_ip_limited, ip_retry_after = login_rate_limiter.is_rate_limited(
        ip_rate_key,
        max_attempts=settings.RATE_LIMIT_LOGIN_MAX_ATTEMPTS * 5,
        window_seconds=settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
    )

    if is_id_limited or is_ip_limited:
        retry_after = max(id_retry_after, ip_retry_after)
        _record_audit(
            db,
            identifier=identifier,
            status_label="FAILED_RATE_LIMITED",
            ip_address=client_ip,
            user_agent=user_agent,
            failure_reason=f"Rate limit exceeded ({'Account' if is_id_limited else 'IP'}). Wait {retry_after}s.",
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "success": False,
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Too many failed login attempts. Please wait {retry_after} seconds before trying again.",
                },
            },
            headers={"Retry-After": str(retry_after)},
        )

    # 2. Look up user by userid OR email (case-insensitive)
    user: Optional[User] = (
        db.query(User)
        .filter(
            (User.userid.ilike(identifier)) | (User.email.ilike(identifier))
        )
        .first()
    )

    # Unified "invalid credentials" message — never reveal which field is wrong
    INVALID_CREDS = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "success": False,
            "error": {
                "code": "INVALID_CREDENTIALS",
                "message": "Invalid username or password. Please verify your credentials and try again.",
            },
        },
        headers={"WWW-Authenticate": "Bearer"},
    )

    if user is None:
        login_rate_limiter.record_attempt(id_rate_key)
        login_rate_limiter.record_attempt(ip_rate_key)
        _record_audit(
            db,
            identifier=identifier,
            status_label="FAILED_CREDENTIALS",
            ip_address=client_ip,
            user_agent=user_agent,
            failure_reason="Non-existent user or invalid username",
        )
        raise INVALID_CREDS

    if not verify_password(payload.password, user.password_hash):
        login_rate_limiter.record_attempt(id_rate_key)
        login_rate_limiter.record_attempt(ip_rate_key)
        _record_audit(
            db,
            identifier=identifier,
            user_id=user.id,
            status_label="FAILED_CREDENTIALS",
            ip_address=client_ip,
            user_agent=user_agent,
            failure_reason="Password verification failed",
        )
        raise INVALID_CREDS

    if not user.is_active:
        _record_audit(
            db,
            identifier=identifier,
            user_id=user.id,
            status_label="FAILED_DEACTIVATED",
            ip_address=client_ip,
            user_agent=user_agent,
            failure_reason="Account deactivated",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "error": {
                    "code": "ACCOUNT_DISABLED",
                    "message": "Your account has been deactivated. Please contact your administrator.",
                },
            },
        )

    # Authentication Success: Reset rate limiter attempts for this identifier
    login_rate_limiter.reset_key(id_rate_key)

    # Issue Short-Lived Access Token + Long-Lived Refresh Token
    access_token = create_access_token(
        subject=user.id,
        role=user.role,
        extra={"name": user.name, "userid": user.userid},
    )
    refresh_token = create_refresh_token(user.id, db)

    _record_audit(
        db,
        identifier=identifier,
        user_id=user.id,
        status_label="SUCCESS",
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": _user_to_out(user),
    }


@router.post(
    "/refresh",
    response_model=RefreshTokenResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Invalid or expired refresh token"},
    },
    summary="Rotate refresh token and issue new access token",
)
def refresh_session(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Exchanges an active refresh token for a fresh access token and rotated refresh token.
    Detects reuse and invalidates compromised token families.
    """
    user, new_refresh_token = rotate_refresh_token(payload.refresh_token, db)
    new_access_token = create_access_token(
        subject=user.id,
        role=user.role,
        extra={"name": user.name, "userid": user.userid},
    )

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": _user_to_out(user),
    }


@router.post(
    "/logout",
    summary="Explicitly revoke session refresh token",
)
def logout(payload: LogoutRequest, db: Session = Depends(get_db)):
    """Revokes the given refresh token from the database."""
    if payload.refresh_token:
        revoke_refresh_token(payload.refresh_token, db)
    return {"success": True, "message": "Session terminated successfully."}


@router.get(
    "/me",
    response_model=UserOut,
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    },
    summary="Get the currently authenticated user's profile",
)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the profile of the user identified by the Bearer token."""
    return _user_to_out(current_user)


@router.get(
    "/preferences/theme",
    response_model=ThemePreferenceOut,
    summary="Get the current user's workspace theme",
)
def get_theme_preference(current_user: User = Depends(get_current_user)):
    return {"theme_id": current_user.theme_id or "emerald"}


@router.put(
    "/preferences/theme",
    response_model=ThemePreferenceOut,
    summary="Save the current user's workspace theme",
)
def update_theme_preference(
    payload: ThemePreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.theme_id != payload.theme_id:
        current_user.theme_id = payload.theme_id
        db.add(current_user)
        db.commit()
        db.refresh(current_user)
    return {"theme_id": current_user.theme_id}


@router.get(
    "/audit-logs",
    response_model=List[AuditLogOut],
    summary="Get recent authentication audit logs (Admin only)",
)
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Compliance Telemetry: Retrieve historical login events."""
    logs = (
        db.query(LoginAuditLog)
        .order_by(LoginAuditLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return logs

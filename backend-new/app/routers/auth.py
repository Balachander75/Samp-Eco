"""
Authentication Router
Handles /api/auth/login, /api/auth/refresh, /api/auth/logout, /api/auth/me,
and /api/auth/audit-logs with full production-level JWT auth, sliding-window
brute-force rate limiting, refresh token rotation, and security telemetry.
"""
from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status, Query
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Literal
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from ipaddress import ip_address, ip_network

from app.config import settings
from app.database import get_db
from app.models.master import User, LoginAuditLog
from app.auth.rate_limiter import recent_failed_login_counts
from app.auth.security import (
    verify_password,
    hash_password,
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
    identifier: Optional[str] = Field(None, max_length=255, description="Username (userid) or email address")
    userid: Optional[str] = Field(None, max_length=255)
    username: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    password: str = Field(..., min_length=1, max_length=1024, description="Account password")
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
    is_costing_admin: bool = False
    plant_code: Optional[str] = None
    plant_codes: List[str] = Field(default_factory=list)
    theme_id: ThemeId = "emerald"
    is_active: bool
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)



class LoginResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class RefreshTokenRequest(BaseModel):
    refresh_token: Optional[str] = Field(None, description="Active refresh token (optional when provided via HttpOnly cookie)")


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, description="Current account password")
    new_password: str = Field(..., min_length=6, description="New password (minimum 6 characters)")
    confirm_password: Optional[str] = None


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

    model_config = ConfigDict(from_attributes=True)



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
        "is_costing_admin": getattr(user, "is_costing_admin", False),
        "plant_code": getattr(user, "plant_code", None),
        "plant_codes": getattr(user, "plant_codes", []),
        "theme_id": getattr(user, "theme_id", "emerald"),
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _resolve_identifier(payload: LoginRequest) -> str:
    return (
        payload.identifier
        or payload.userid
        or payload.username
        or payload.email
        or ""
    ).strip()


def _get_client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    try:
        peer_ip = ip_address(peer)
    except ValueError:
        return peer

    trusted_networks = [ip_network(network, strict=False) for network in settings.TRUSTED_PROXY_IPS]
    if not any(peer_ip in network for network in trusted_networks):
        return peer

    forwarded = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip") or ""
    forwarded_ips = []
    for candidate in forwarded.split(","):
        try:
            forwarded_ips.append(ip_address(candidate.strip()))
        except ValueError:
            continue

    # Walk from the trusted proxy toward the client. This ignores spoofed
    # entries farther left while supporting a chain of known proxies.
    for candidate in reversed([*forwarded_ips, peer_ip]):
        if any(candidate in network for network in trusted_networks):
            continue
        return str(candidate)
    return peer


def _retry_after(oldest: Optional[datetime], window_seconds: int) -> int:
    if oldest is None:
        return 0
    oldest_utc = oldest.replace(tzinfo=timezone.utc) if oldest.tzinfo is None else oldest.astimezone(timezone.utc)
    remaining = window_seconds - (datetime.now(timezone.utc) - oldest_utc).total_seconds()
    return max(1, int(remaining))


def _record_audit(
    db: Session,
    identifier: str,
    status_label: str,
    ip_address: str,
    user_agent: str,
    user_id: Optional[int] = None,
    failure_reason: Optional[str] = None,
):
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


def _set_refresh_cookie(response: Response, token: str):
    is_prod = settings.APP_ENV.strip().lower() in ("production", "prod")
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        path="/api/auth",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


def _clear_refresh_cookie(response: Response):
    response.delete_cookie(
        key="refresh_token",
        path="/api/auth",
    )


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
def login(request: Request, response: Response, payload: LoginRequest, db: Session = Depends(get_db)):
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

    # Shared across workers: failed login audit rows are the authoritative counters.
    id_attempts, id_oldest, ip_attempts, ip_oldest = recent_failed_login_counts(
        db,
        identifier,
        client_ip,
        settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
    )
    is_id_limited = id_attempts >= settings.RATE_LIMIT_LOGIN_MAX_ATTEMPTS
    is_ip_limited = ip_attempts >= settings.RATE_LIMIT_LOGIN_MAX_ATTEMPTS * 5
    id_retry_after = _retry_after(id_oldest, settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS) if is_id_limited else 0
    ip_retry_after = _retry_after(ip_oldest, settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS) if is_ip_limited else 0

    if is_id_limited or is_ip_limited:
        retry_after = max(id_retry_after, ip_retry_after)
        _record_audit(
            db,
            identifier=identifier,
            status_label="FAILED_RATE_LIMITED",
            ip_address=client_ip,
            user_agent=user_agent,
            failure_reason=f"Rate limit exceeded. Wait {retry_after}s.",
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

    # Look up user by userid OR email (case-insensitive)
    user: Optional[User] = (
        db.query(User)
        .filter(
            (func.lower(User.userid) == identifier.lower())
            | (func.lower(User.email) == identifier.lower())
        )
        .first()
    )

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
        _record_audit(
            db,
            identifier=identifier,
            status_label="FAILED_CREDENTIALS",
            ip_address=client_ip,
            user_agent=user_agent,
            failure_reason="User handle or email not found",
        )
        raise INVALID_CREDS

    if not verify_password(payload.password, user.password_hash):
        _record_audit(
            db,
            identifier=identifier,
            status_label="FAILED_CREDENTIALS",
            ip_address=client_ip,
            user_agent=user_agent,
            user_id=user.id,
            failure_reason="Incorrect password hash check",
        )
        raise INVALID_CREDS

    if not user.is_active:
        _record_audit(
            db,
            identifier=identifier,
            status_label="FAILED_DEACTIVATED",
            ip_address=client_ip,
            user_agent=user_agent,
            user_id=user.id,
            failure_reason="Account is disabled/deactivated",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "error": {
                    "code": "ACCOUNT_DISABLED",
                    "message": "Your account has been deactivated. Please contact an administrator.",
                },
            },
        )

    # Successful authentication
    _record_audit(
        db,
        identifier=identifier,
        status_label="SUCCESS",
        ip_address=client_ip,
        user_agent=user_agent,
        user_id=user.id,
    )

    access_token = create_access_token(
        subject=user.id,
        role=user.role,
        extra={"name": user.name, "userid": user.userid},
    )

    refresh_token = create_refresh_token(user.id, db) if payload.remember_me else None
    if refresh_token:
        _set_refresh_cookie(response, refresh_token)
    else:
        _clear_refresh_cookie(response)

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
    summary="Rotate refresh token and issue fresh access token",
)
def refresh(
    request: Request,
    response: Response,
    payload: Optional[RefreshTokenRequest] = None,
    db: Session = Depends(get_db),
):
    raw_token = (payload.refresh_token if payload and payload.refresh_token else None) or request.cookies.get("refresh_token")
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error": {
                    "code": "MISSING_REFRESH_TOKEN",
                    "message": "No refresh token provided in request or cookie.",
                },
            },
        )
    user, new_refresh_token = rotate_refresh_token(raw_token, db)
    _set_refresh_cookie(response, new_refresh_token)
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
def logout(
    request: Request,
    response: Response,
    payload: Optional[LogoutRequest] = None,
    db: Session = Depends(get_db),
):
    raw_token = (payload.refresh_token if payload and payload.refresh_token else None) or request.cookies.get("refresh_token")
    if raw_token:
        revoke_refresh_token(raw_token, db)
    _clear_refresh_cookie(response)
    return {"success": True, "message": "Session terminated successfully."}


@router.get(
    "/me",
    response_model=UserOut,
    summary="Get the currently authenticated user's profile",
)
def get_me(current_user: User = Depends(get_current_user)):
    return _user_to_out(current_user)


@router.post(
    "/change-password",
    summary="Change current user's password",
)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Allow authenticated user to change their account password.
    Requires current password verification and a minimum 6-character new password.
    """
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_CURRENT_PASSWORD",
                    "message": "Current password is incorrect.",
                },
            },
        )

    if payload.confirm_password and payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {
                    "code": "PASSWORDS_DO_NOT_MATCH",
                    "message": "New password and confirmation do not match.",
                },
            },
        )

    if len(payload.new_password.strip()) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {
                    "code": "PASSWORD_TOO_SHORT",
                    "message": "New password must be at least 6 characters long.",
                },
            },
        )

    current_user.password_hash = hash_password(payload.new_password.strip())
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "message": "Password updated successfully.",
    }


@router.get(
    "/preferences/theme",
    response_model=ThemePreferenceOut,
    summary="Get the current user's workspace theme",
)
def get_theme_preference(current_user: User = Depends(get_current_user)):
    return {"theme_id": getattr(current_user, "theme_id", "emerald") or "emerald"}


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
    if getattr(current_user, "theme_id", None) != payload.theme_id:
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
    return (
        db.query(LoginAuditLog)
        .order_by(LoginAuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

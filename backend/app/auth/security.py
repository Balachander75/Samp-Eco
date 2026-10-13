"""
Authentication Security Utilities
Handles password hashing with bcrypt and JWT token creation/validation.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Union
import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db

# ---------------------------------------------------------------------------
# Password Utilities
# ---------------------------------------------------------------------------

def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT Token Utilities
# ---------------------------------------------------------------------------

def create_access_token(
    subject: Union[str, int],
    role: str = "user",
    extra: Optional[dict] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT access token."""
    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(subject),
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "iss": "navneet-samp-erp",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _hash_token(raw_token: str) -> str:
    """Compute SHA-256 hash of a token for safe database persistence."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_refresh_token(user_id: int, db: Session) -> str:
    """
    Generate a high-entropy refresh token and store its hash in the database.
    Returns the plaintext token to be transmitted securely to the client.
    """
    from app.models.master import RefreshToken

    raw_token = secrets.token_urlsafe(48)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    token_record = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        is_revoked=False,
    )
    db.add(token_record)
    db.commit()
    return raw_token


def rotate_refresh_token(raw_token: str, db: Session):
    """
    Validate an incoming refresh token, revoke it, and issue a fresh one (rotation).
    Detects token reuse to protect against stolen tokens.
    Returns (user, new_raw_token).
    """
    from app.models.master import RefreshToken, User

    token_hash = _hash_token(raw_token)
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "error": {"code": "INVALID_REFRESH_TOKEN", "message": "Invalid session token."}},
        )

    # Detect token reuse attack
    if record.is_revoked:
        # Compromise detected: revoke ALL active tokens for this user!
        db.query(RefreshToken).filter(RefreshToken.user_id == record.user_id).update({"is_revoked": True})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "error": {"code": "SESSION_REVOKED", "message": "Security alert: token reuse detected. Please sign in again."}},
        )

    # Check expiration
    now = datetime.now(timezone.utc)
    record_expires = record.expires_at if record.expires_at.tzinfo else record.expires_at.replace(tzinfo=timezone.utc)
    if record_expires < now:
        record.is_revoked = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "error": {"code": "EXPIRED_REFRESH_TOKEN", "message": "Session has expired. Please sign in again."}},
        )

    # Check user account
    user = db.query(User).filter(User.id == record.user_id).first()
    if not user or not user.is_active:
        record.is_revoked = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"success": False, "error": {"code": "ACCOUNT_DISABLED", "message": "Account has been deactivated."}},
        )

    # Revoke old token and issue new rotated token
    record.is_revoked = True
    new_raw_token = secrets.token_urlsafe(48)
    new_token_hash = _hash_token(new_raw_token)
    new_expires_at = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    new_record = RefreshToken(
        user_id=user.id,
        token_hash=new_token_hash,
        expires_at=new_expires_at,
        is_revoked=False,
    )
    db.add(new_record)
    db.commit()

    return user, new_raw_token


def revoke_refresh_token(raw_token: str, db: Session) -> bool:
    """Explicitly revoke a refresh token (e.g. during logout)."""
    from app.models.master import RefreshToken

    token_hash = _hash_token(raw_token)
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if record:
        record.is_revoked = True
        db.commit()
        return True
    return False


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises HTTPException on failure."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials. Please sign in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception


# ---------------------------------------------------------------------------
# FastAPI Dependency: get_current_user
# ---------------------------------------------------------------------------

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """
    FastAPI dependency that validates the Bearer token and returns the active User ORM object.
    Requires a valid bearer token in every environment. Development mode must not
    silently attribute mutations to whichever active user happens to be first.
    """
    from app.models.master import User

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing or invalid.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found or deactivated.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_admin(current_user=Depends(get_current_user)):
    """Dependency: raises 403 if the authenticated user is not an admin."""
    if (current_user.role or "").lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required to access this resource.",
        )
    return current_user


def prune_expired_refresh_tokens(db: Session, older_than_days: int = 14) -> int:
    """
    Safely delete revoked or expired refresh tokens older than N days.
    Prevents unbounded growth of the refresh_tokens table.
    """
    from app.models.master import RefreshToken

    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    try:
        deleted = (
            db.query(RefreshToken)
            .filter((RefreshToken.is_revoked == True) | (RefreshToken.expires_at < cutoff))
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted
    except Exception:
        db.rollback()
        return 0


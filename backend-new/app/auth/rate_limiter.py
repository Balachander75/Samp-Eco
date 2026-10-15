"""Shared login failure counters backed by PostgreSQL audit records.

Unlike process-local counters, these limits are consistent across API workers
and instances. Failed attempts already create an audit record, so enforcing the
window does not add a second write per attempt.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy import func, or_
from sqlalchemy.orm import Session


def recent_failed_login_counts(
    db: Session,
    identifier: str,
    client_ip: str,
    window_seconds: int,
) -> Tuple[int, Optional[datetime], int, Optional[datetime]]:
    """Return identifier/IP failure counts and oldest timestamps in the window."""
    from app.models.master import LoginAuditLog

    identifier_match = func.lower(LoginAuditLog.identifier) == identifier.casefold()
    ip_match = LoginAuditLog.ip_address == client_ip
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)

    result = (
        db.query(
            func.count(LoginAuditLog.id).filter(identifier_match),
            func.min(LoginAuditLog.created_at).filter(identifier_match),
            func.count(LoginAuditLog.id).filter(ip_match),
            func.min(LoginAuditLog.created_at).filter(ip_match),
        )
        .filter(
            # Rate-limited requests are audited, but do not extend their own
            # lockout window when someone repeatedly retries a blocked account.
            LoginAuditLog.status == "FAILED_CREDENTIALS",
            LoginAuditLog.created_at >= cutoff,
            or_(identifier_match, ip_match),
        )
        .one()
    )
    return int(result[0] or 0), result[1], int(result[2] or 0), result[3]

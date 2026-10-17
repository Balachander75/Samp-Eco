"""Shared request identifier allocation for the Oct-Sep business year."""

from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.request_code_sequence import RequestCodeSequence
from app.utils.business_year import get_business_year_start

REQUEST_CODE_PREFIX_BY_SCOPE = {
    "feasibility": "FC",
    "program": "PP",
    "design": "DR",
    "costing": "CR",
    "mockup": "MR",
    "sample": "SR",
}
VALID_REQUEST_CODE_PREFIXES = frozenset(REQUEST_CODE_PREFIX_BY_SCOPE.values())


def temporary_request_code() -> str:
    """Return a collision-resistant placeholder that fits 32-character code columns."""
    return f"P-{uuid4().hex[:30]}"


def next_request_code(db: Session, prefix: str, created_at: date | datetime | None = None) -> str:
    """Allocate a unique ``PREFIX-YY-NNN`` code, resetting by business year."""
    prefix = str(prefix or "").strip().upper()
    if prefix not in VALID_REQUEST_CODE_PREFIXES:
        raise ValueError(f"Unsupported request-code prefix: {prefix or '(empty)'}")

    stamp = created_at or datetime.now(timezone.utc)
    business_year_start = get_business_year_start(stamp)
    statement = (
        insert(RequestCodeSequence)
        .values(prefix=prefix, business_year_start=business_year_start, last_value=1)
        .on_conflict_do_update(
            index_elements=[RequestCodeSequence.prefix, RequestCodeSequence.business_year_start],
            set_={"last_value": RequestCodeSequence.last_value + 1},
        )
        .returning(RequestCodeSequence.last_value)
    )
    sequence = db.execute(statement).scalar_one()
    return f"{prefix}-{business_year_start % 100:02d}-{sequence:03d}"

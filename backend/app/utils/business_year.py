"""
Navneet SAMP ERP Business Year & Season Year System.
Business Year operates strictly on an October 1 – September 30 cycle (Oct–Sep).
"""
from datetime import date, datetime, timezone
import re
from typing import List, Optional


def get_business_year_start(dt: Optional[datetime | date] = None) -> int:
    """Return the start year of the business year (Oct–Sep)."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    month = dt.month
    year = dt.year
    return year if month >= 10 else year - 1


def get_current_business_year(dt: Optional[datetime | date] = None) -> str:
    """Return the business year string, e.g. '2026-2027'."""
    start_year = get_business_year_start(dt)
    return f"{start_year}-{start_year + 1}"


def get_season_year_options(dt: Optional[datetime | date] = None) -> List[str]:
    """Return 3 season year options: current business year start + next 2 years."""
    start_year = get_business_year_start(dt)
    return [str(start_year), str(start_year + 1), str(start_year + 2)]


def get_business_year_for_date_str(date_str: Optional[str]) -> str:
    """Return the business year for a given date string 'YYYY-MM-DD'."""
    if not date_str:
        return get_current_business_year()
    try:
        clean = str(date_str).strip().split("T")[0]
        parsed = datetime.strptime(clean, "%Y-%m-%d").date()
        return get_current_business_year(parsed)
    except Exception:
        return get_current_business_year()


def get_business_year_date_range(year: Optional[str]) -> Optional[tuple[date, date]]:
    """Return the inclusive start and exclusive end dates for an Oct–Sep business year."""
    match = re.fullmatch(r"(\d{4})-(\d{4})", str(year or "").strip())
    if not match:
        return None
    start_year, end_year = map(int, match.groups())
    if end_year != start_year + 1:
        return None
    return date(start_year, 10, 1), date(end_year, 10, 1)

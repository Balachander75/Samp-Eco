"""Operational workday calculations shared by workflow SLA deadlines."""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

INDIA_TZ = ZoneInfo("Asia/Kolkata")


def is_operational_workday(day: date) -> bool:
    """Weekdays and first, third, or fifth Saturdays are operational days."""
    if day.weekday() < 5:
        return True
    if day.weekday() == 5:
        saturday_occurrence = (day.day + 6) // 7
        return saturday_occurrence % 2 == 1
    return False


def india_operational_deadline(started_at: datetime, workdays: int) -> datetime:
    """Return end-of-day India time after the requested number of workdays."""
    start = started_at.replace(tzinfo=timezone.utc) if started_at.tzinfo is None else started_at
    local_day = start.astimezone(INDIA_TZ).date()
    counted = 0
    while counted < max(0, workdays):
        local_day += timedelta(days=1)
        if is_operational_workday(local_day):
            counted += 1
    return datetime.combine(local_day, time.max, tzinfo=INDIA_TZ).astimezone(timezone.utc)

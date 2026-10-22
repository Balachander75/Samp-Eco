"""Stage claim windows and team delay attribution for Costing workflows."""

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo


STAGE_TEAMS = {
    "creative": ("creative_studio", "Creative Studio"),
    "costing": ("costing", "Costing"),
    "sampling_review": ("samp", "Sampling"),
}
INDIA_TZ = ZoneInfo("Asia/Kolkata")


def _parse_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        result = value
    elif isinstance(value, str) and value.strip():
        try:
            result = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    return result.replace(tzinfo=timezone.utc) if result.tzinfo is None else result.astimezone(timezone.utc)


def parse_counter_date(value: Any) -> Optional[date]:
    if value is None or not str(value).strip():
        return None
    try:
        return date.fromisoformat(str(value).strip())
    except ValueError as exc:
        raise ValueError("Counter date must use YYYY-MM-DD format") from exc


def activate_stage(workflow: Any, stage: str, started_at: Optional[datetime] = None) -> None:
    """Start a fresh 48-hour claim window whenever a receiving team gets the task."""
    now = started_at or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    now = now.astimezone(timezone.utc)
    state: Dict[str, Any] = dict(getattr(workflow, "workflow_data", None) or {})
    state.pop("claimed_stage", None)
    state.pop("claim_due_at", None)
    state.pop("claim_overdue", None)
    state.pop("claim_late_at", None)
    state.pop("stage_started_at", None)
    state.pop("team_counter_date", None)
    state.pop("team_counter_date_reason", None)
    state.pop("team_counter_date_by", None)
    state.pop("team_counter_date_by_user_id", None)
    state.pop("team_counter_date_at", None)
    if stage in STAGE_TEAMS:
        state.update({
            "stage_started_at": now.isoformat(),
            "claim_due_at": (now + timedelta(hours=48)).isoformat(),
        })
    workflow.workflow_data = state
    workflow.claimed_by_user_id = None
    workflow.claimed_by = None
    workflow.claimed_at = None


def stage_sla(workflow: Any, request: Any, now: Optional[datetime] = None) -> Dict[str, Any]:
    stage = str(getattr(workflow, "current_stage", "") or "")
    team = STAGE_TEAMS.get(stage)
    if team is None:
        return {"stage": stage, "team": None, "claim_due_at": None, "team_counter_date": None,
                "is_claimed": False, "claim_overdue": False, "is_delayed": False, "delay_team": None}

    state: Dict[str, Any] = dict(getattr(workflow, "workflow_data", None) or {})
    started_at = _parse_datetime(state.get("stage_started_at"))
    if started_at is None:
        started_at = _parse_datetime(getattr(workflow, "updated_at", None))
    if started_at is None:
        started_at = _parse_datetime(getattr(workflow, "created_at", None))
    claim_due_at = _parse_datetime(state.get("claim_due_at"))
    if claim_due_at is None and started_at is not None:
        claim_due_at = started_at + timedelta(hours=48)
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    current = current.astimezone(timezone.utc)
    claimed_by_user_id = getattr(workflow, "claimed_by_user_id", None)
    is_claimed = claimed_by_user_id is not None
    claim_overdue = bool(
        state.get("claim_overdue")
        or (not is_claimed and claim_due_at and current >= claim_due_at)
    )

    counter_date = parse_counter_date(state.get("team_counter_date"))
    request_data = dict(getattr(workflow, "request_data", None) or {})
    required_date = parse_counter_date(request_data.get("required_date"))
    creative_due_at = _parse_datetime(getattr(workflow, "creative_due_at", None))
    if counter_date:
        target_date: Optional[str] = counter_date.isoformat()
        target_date_passed = current.astimezone(INDIA_TZ).date() > counter_date
    elif stage == "creative" and creative_due_at:
        target_date = creative_due_at.isoformat()
        target_date_passed = current >= creative_due_at
    else:
        target_date = required_date.isoformat() if required_date else None
        target_date_passed = bool(required_date and current.astimezone(INDIA_TZ).date() > required_date)
    is_delayed = bool(target_date_passed and (is_claimed or claim_overdue))
    return {
        "stage": stage,
        "team": team[1],
        "team_role": team[0],
        "stage_started_at": started_at.isoformat() if started_at else None,
        "claim_due_at": claim_due_at.isoformat() if claim_due_at else None,
        "team_counter_date": counter_date.isoformat() if counter_date else None,
        "team_counter_date_reason": state.get("team_counter_date_reason"),
        "target_date": target_date,
        "is_claimed": is_claimed,
        "claim_overdue": claim_overdue,
        "is_delayed": is_delayed,
        "delay_team": team[1] if is_delayed else None,
    }


def record_stage_delay(workflow: Any, request: Any, now: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
    """Persist a team delay when a stage finishes after its claim and target dates."""
    status = stage_sla(workflow, request, now)
    if not status.get("is_delayed"):
        return None
    state: Dict[str, Any] = dict(getattr(workflow, "workflow_data", None) or {})
    history = list(state.get("delay_history") or [])
    started_at = status.get("stage_started_at")
    if any(item.get("stage_started_at") == started_at for item in history if isinstance(item, dict)):
        return None
    recorded_at = now or datetime.now(timezone.utc)
    if recorded_at.tzinfo is None:
        recorded_at = recorded_at.replace(tzinfo=timezone.utc)
    event = {
        "stage": status["stage"],
        "team": status["team"],
        "stage_started_at": started_at,
        "claim_due_at": status.get("claim_due_at"),
        "target_date": status.get("target_date"),
        "recorded_at": recorded_at.astimezone(timezone.utc).isoformat(),
    }
    history.append(event)
    state["delay_history"] = history[-200:]
    workflow.workflow_data = state
    return event


def delay_counts(workflow: Any, request: Any, now: Optional[datetime] = None) -> Dict[str, int]:
    state: Dict[str, Any] = dict(getattr(workflow, "workflow_data", None) or {})
    counts = {"Creative Studio": 0, "Costing": 0, "Sampling": 0}
    for event in state.get("delay_history") or []:
        if isinstance(event, dict) and event.get("team") in counts:
            counts[event["team"]] += 1
    active = stage_sla(workflow, request, now)
    if active.get("is_delayed") and active.get("team") in counts:
        counts[active["team"]] += 1
    return counts

"""Role helpers for SMPS workflows and plant permissions."""
import re
from typing import Iterable
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import func
from app.auth.security import get_current_user

_TEAM_TERMS = {
    "marketing": ("marketing",),
    "samp": ("samp", "sampling"),
    "plant": ("plant",),
    "creative_studio": ("creative", "studio"),
    "costing": ("costing",),
}

def _normalized(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").casefold()).strip()

def is_admin(user) -> bool:
    return _normalized(getattr(user, "role", "")) in {"admin", "administrator"}

def is_team_head(user) -> bool:
    return bool(getattr(user, "is_team_head", False)) and not is_admin(user)

def require_workflow_write_access(
    request: Request,
    current_user=Depends(get_current_user),
):
    if request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"} and is_team_head(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Team heads have read-only access to operational workflows",
        )
    return current_user

def user_has_team(user, team: str) -> bool:
    terms = _TEAM_TERMS.get(team, ())
    primary_team = getattr(user, "team", None)
    normalized_values = (_normalized(primary_team),) if primary_team else ()
    return any(term in value for term in terms for value in normalized_values)

def require_admin(user=Depends(get_current_user)):
    if not is_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access is required")
    return user

def require_team(user, team: str):
    if is_admin(user) or user_has_team(user, team):
        return user
    label = {"samp": "SAMP Team", "creative_studio": "Creative/Studio"}.get(team, team.title())
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{label} access is required")

def require_any_team(user, teams: Iterable[str]):
    if is_admin(user) or any(user_has_team(user, team) for team in teams):
        return user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="SMPS team access is required")

def require_smps_member(user=Depends(get_current_user)):
    return require_any_team(user, ("marketing", "samp", "plant", "creative_studio"))

def assigned_plant_values(user, db) -> set[str]:
    from app.models.master import Plant

    labels = set()
    plant_code = str(getattr(user, "plant_code", None) or "").strip()
    if plant_code:
        plant = (
            db.query(Plant)
            .filter(
                (func.lower(Plant.code) == plant_code.lower())
                | (func.lower(Plant.name) == plant_code.lower())
            )
            .first()
        )
        if plant:
            labels.update((plant.code, plant.name))
        else:
            labels.add(plant_code)
    else:
        plant = db.query(Plant).filter(func.lower(Plant.code) == "1505").first()
        if plant:
            labels.update((plant.code, plant.name))
        else:
            labels.add("1505")
    return labels

def assigned_plant_labels(user, db) -> set[str]:
    return {_normalized(value) for value in assigned_plant_values(user, db)}

def can_access_plant(user, plant_value: object, db) -> bool:
    if is_admin(user) or not user_has_team(user, "plant"):
        return True
    target = _normalized(plant_value)
    return bool(target and target in assigned_plant_labels(user, db))

def require_plant_access(user, plant_value: object, db):
    if not can_access_plant(user, plant_value, db):
        raise HTTPException(status_code=404, detail="Record not found")

def filter_plant_values(user, values, db):
    values = list(values)
    if is_admin(user) or not user_has_team(user, "plant"):
        return values
    assigned = assigned_plant_labels(user, db)
    return [value for value in values if _normalized(value) in assigned]


def filter_plant_records(user, records, db):
    """Limit plant-team users to downstream records assigned to their plant."""
    if is_admin(user) or not user_has_team(user, "plant"):
        return records
    assigned = assigned_plant_labels(user, db)
    return [
        record for record in records
        if _normalized(record.get("target_plant", record.get("targetPlant"))) in assigned
    ]

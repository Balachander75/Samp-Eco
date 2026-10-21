"""Scope-specific request closure actions and their audit records."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.permissions import is_admin, is_team_head, require_any_team, user_has_team
from app.auth.security import get_current_user
from app.database import get_db
from app.models.feasibility import FeasibilityRequest
from app.models.request_closure import RequestClosure
from app.models.request_workflows import CostingWorkflow, MockupWorkflow
from app.models.sample_request import CreateSampleRequest, DesignRequest

router = APIRouter(prefix="/api/v1/request-closures", tags=["Request Closures"])

SUPPORTED_TYPES = {"design", "mockup", "sample", "costing", "feasibility"}
TYPE_TEAMS = {
    "design": ("marketing", "creative_studio"),
    "mockup": ("marketing", "creative_studio", "samp"),
    "sample": ("marketing", "samp", "plant"),
    "costing": ("marketing", "creative_studio", "costing", "samp"),
    "feasibility": ("marketing", "samp"),
}


def _closure_error(status_code: int = 404) -> HTTPException:
    return HTTPException(status_code=status_code, detail="Request was not found")


def _load_target(
    db: Session,
    request_type: str,
    request_id: int,
    *,
    for_update: bool = False,
) -> Tuple[Any, Optional[str]]:
    if request_type not in SUPPORTED_TYPES:
        raise HTTPException(status_code=422, detail="Unsupported request type")

    if request_type == "design":
        query = db.query(DesignRequest).filter(DesignRequest.id == request_id)
        target = query.with_for_update().first() if for_update else query.first()
        if target is None:
            raise _closure_error()
        return target, target.request_code

    if request_type == "feasibility":
        query = db.query(FeasibilityRequest).filter(FeasibilityRequest.id == request_id)
        target = query.with_for_update().first() if for_update else query.first()
        if target is None:
            raise _closure_error()
        return target, target.request_code

    query = db.query(CreateSampleRequest).filter(CreateSampleRequest.id == request_id)
    target = query.with_for_update().first() if for_update else query.first()
    if target is None:
        raise _closure_error()

    request_types = set(target.request_types or []) if isinstance(target.request_types, list) else set()
    request_codes = target.request_codes if isinstance(target.request_codes, dict) else {}
    scope_audit = getattr(target, "request_type_audit", None)
    has_scope = request_type in request_types or bool(request_codes.get(request_type))
    has_scope = has_scope or bool(getattr(scope_audit, request_type, False))

    if request_type == "sample":
        has_explicit_scopes = bool(request_types or request_codes or scope_audit is not None)
        has_scope = has_scope or (not has_explicit_scopes and bool(target.sr_number))
        request_code = target.sr_number or request_codes.get("sample") or target.material_code
    elif request_type == "mockup":
        state = target.mockup_workflow_state if isinstance(target.mockup_workflow_state, dict) else {}
        workflow_query = db.query(MockupWorkflow).filter(MockupWorkflow.sample_request_id == request_id)
        workflow = workflow_query.first()
        has_scope = has_scope or str(target.mockup_required or "").strip().casefold() in {"yes", "true", "y"}
        has_scope = has_scope or bool(state) or workflow is not None
        request_code = request_codes.get("mockup") or (workflow.request_code if workflow else None)
    else:
        workflow_query = db.query(CostingWorkflow).filter(CostingWorkflow.sample_request_id == request_id)
        workflow = workflow_query.first()
        has_scope = has_scope or bool(target.qty_design_costing or target.costing_required_date) or workflow is not None
        request_code = request_codes.get("costing") or (workflow.request_code if workflow else None)

    if not has_scope:
        raise _closure_error()
    return target, request_code


def _require_closure_access(request_type: str, target: Any, user: Any) -> None:
    require_any_team(user, TYPE_TEAMS[request_type])
    if user_has_team(user, "marketing") and not is_admin(user) and not is_team_head(user):
        creator_id = getattr(target, "created_by_user_id", None)
        if creator_id != user.id:
            raise _closure_error()


def _serialize_closure(closure: Optional[RequestClosure]) -> Optional[Dict[str, Any]]:
    if closure is None:
        return None
    return {
        "id": closure.id,
        "request_type": closure.request_type,
        "request_id": closure.request_id,
        "request_code": closure.request_code,
        "closed_by_user_id": closure.closed_by_user_id,
        "closed_by": closure.closed_by,
        "closed_by_team": closure.closed_by_team,
        "reason": closure.reason,
        "closed_at": closure.closed_at.isoformat() if closure.closed_at else None,
    }


def _has_closure(db: Session, request_type: str, request_id: int) -> bool:
    return db.query(RequestClosure.id).filter(
        RequestClosure.request_type == request_type,
        RequestClosure.request_id == request_id,
    ).first() is not None


def _lock_request_row(db: Session, request_type: str, request_id: int) -> None:
    model = {
        "design": DesignRequest,
        "feasibility": FeasibilityRequest,
    }.get(request_type, CreateSampleRequest)
    db.query(model.id).filter(model.id == request_id).with_for_update().first()


def reject_closed_workflow_write(
    request: Request,
    db: Session = Depends(get_db),
) -> None:
    """Keep a recorded closure terminal for subsequent workflow write endpoints."""
    if request.method.upper() not in {"POST", "PUT", "PATCH", "DELETE"}:
        return

    parts = request.url.path.strip("/").split("/")
    if len(parts) < 4 or parts[:2] != ["api", "v1"]:
        return

    if parts[2] == "workflows" and len(parts) >= 5:
        request_type, raw_id = parts[3], parts[4]
        if request_type in SUPPORTED_TYPES and raw_id.isdigit():
            request_id = int(raw_id)
            _lock_request_row(db, request_type, request_id)
            if _has_closure(db, request_type, request_id):
                raise HTTPException(status_code=409, detail="This request has been closed and can no longer be changed")
        return

    if parts[2] == "feasibility-requests" and len(parts) >= 4 and parts[3].isdigit():
        request_id = int(parts[3])
        _lock_request_row(db, "feasibility", request_id)
        if _has_closure(db, "feasibility", request_id):
            raise HTTPException(status_code=409, detail="This request has been closed and can no longer be changed")
        return

    if parts[2] == "design-requests" and len(parts) >= 4 and parts[3].isdigit():
        request_id = int(parts[3])
        _lock_request_row(db, "design", request_id)
        if _has_closure(db, "design", request_id):
            raise HTTPException(status_code=409, detail="This request has been closed and can no longer be changed")
        return

    if parts[2] != "sample-requests" or len(parts) < 4 or not parts[3].isdigit():
        return

    sample_id = int(parts[3])
    action = parts[4] if len(parts) > 4 else ""
    _lock_request_row(db, "sample", sample_id)
    if action in {"mockup", "studio-output"}:
        closed = _has_closure(db, "mockup", sample_id)
    elif action in {"sampling", "release-to-plant", "sampling-feedback"}:
        closed = _has_closure(db, "sample", sample_id)
    elif action == "design-brief":
        design_ids = [row[0] for row in db.query(DesignRequest.id).filter(DesignRequest.sample_request_id == sample_id).all()]
        for design_id in design_ids:
            _lock_request_row(db, "design", design_id)
        closed = any(_has_closure(db, "design", design_id) for design_id in design_ids)
    else:
        # Parent level edits and releases affect the remaining scopes as a whole.
        closed = db.query(RequestClosure.id).filter(
            RequestClosure.request_type.in_(("mockup", "sample", "costing")),
            RequestClosure.request_id == sample_id,
        ).first() is not None
    if closed:
        raise HTTPException(status_code=409, detail="This request has been closed and can no longer be changed")


@router.get("/{request_type}/{request_id}")
def get_request_closure(
    request_type: str,
    request_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    target, _ = _load_target(db, request_type, request_id)
    _require_closure_access(request_type, target, current_user)
    closure = db.query(RequestClosure).filter(
        RequestClosure.request_type == request_type,
        RequestClosure.request_id == request_id,
    ).first()
    return {"closure": _serialize_closure(closure)}


@router.post("", status_code=status.HTTP_201_CREATED)
def close_request(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    request_type = str(payload.get("request_type") or "").strip().lower()
    try:
        request_id = int(payload.get("request_id"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="A valid request id is required")
    if request_id < 1:
        raise HTTPException(status_code=422, detail="A valid request id is required")

    reason_value = payload.get("reason")
    if reason_value is not None and not isinstance(reason_value, str):
        raise HTTPException(status_code=422, detail="Closure reason must be text")
    reason = (reason_value or "").strip()
    if len(reason) > 1000:
        raise HTTPException(status_code=422, detail="Closure reason must be 1000 characters or less")

    target, request_code = _load_target(db, request_type, request_id, for_update=True)
    _require_closure_access(request_type, target, current_user)
    if user_has_team(current_user, "marketing") and not reason:
        raise HTTPException(status_code=422, detail="A closure reason is required for Marketing")

    existing = db.query(RequestClosure).filter(
        RequestClosure.request_type == request_type,
        RequestClosure.request_id == request_id,
    ).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="This request is already closed")

    closure = RequestClosure(
        request_type=request_type,
        request_id=request_id,
        request_code=request_code,
        closed_by_user_id=current_user.id,
        closed_by=getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "SMPS User",
        closed_by_team=getattr(current_user, "team", None),
        reason=reason or None,
        closed_at=datetime.now(timezone.utc),
    )
    db.add(closure)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This request is already closed")
    db.refresh(closure)
    return {"closure": _serialize_closure(closure)}

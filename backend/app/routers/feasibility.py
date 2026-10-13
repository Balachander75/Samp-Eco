"""API endpoints for persisted feasibility-check requests, technical verdicts, and audit logging."""

from io import BytesIO
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.auth.permissions import is_admin, is_team_head, require_admin, require_any_team, require_team, user_has_team
from app.auth.security import get_current_user
from app.database import get_db
from app.models.feasibility import FeasibilityActivityLog
from app.schemas.feasibility import (
    FeasibilityActivityLogOut,
    FeasibilityMarketingDecisionPayload,
    FeasibilityCounterDateProposalPayload,
    FeasibilityCounterDateDecisionPayload,
    FeasibilityNoteCreate,
    FeasibilityRequestCreate,
    FeasibilityRequestOut,
    FeasibilitySampVerdictPayload,
)
from app.services.feasibility_service import FeasibilityService

router = APIRouter(prefix="/api/v1/feasibility-requests", tags=["Feasibility Requests"])


def get_feasibility_service(db: Session = Depends(get_db)) -> FeasibilityService:
    return FeasibilityService(db, api_prefix=router.prefix)


def require_department(current_user, department: str):
    if department == "samp":
        return require_team(current_user, "samp")
    return require_team(current_user, "marketing")


def _require_request_visibility(request: Dict[str, Any], current_user) -> None:
    if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user) and request.get("created_by_user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Feasibility request was not found")
    if user_has_team(current_user, "samp") and not is_admin(current_user) and not is_team_head(current_user) and request.get("taken_by_samp_user_id") not in (None, current_user.id):
        raise HTTPException(status_code=404, detail="Feasibility request was not found")


@router.get("", response_model=List[FeasibilityRequestOut], summary="List feasibility requests")
def list_feasibility_requests(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    year: Optional[str] = Query(default=None),
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp"))
    created_by_user_id = (
        current_user.id
        if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user)
        else None
    )
    visible_samp_user_id = (
        current_user.id
        if user_has_team(current_user, "samp") and not is_admin(current_user) and not is_team_head(current_user)
        else None
    )
    rows = service.list_requests(
        status_filter=status_filter,
        year=year,
        created_by_user_id=created_by_user_id,
        visible_samp_user_id=visible_samp_user_id,
    )
    visible = []
    for row in rows:
        try:
            _require_request_visibility(row, current_user)
            visible.append(row)
        except HTTPException:
            continue
    return visible


@router.get("/activity-logs", response_model=List[FeasibilityActivityLogOut], summary="Search preserved Feasibility history (Admin)")
def search_feasibility_activity_logs(
    request_code: str = Query(..., min_length=1, max_length=32),
    limit: int = Query(200, ge=1, le=1000),
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_admin(current_user)
    rows = (
        service.db.query(FeasibilityActivityLog)
        .filter(FeasibilityActivityLog.request_code == request_code.strip().upper())
        .order_by(FeasibilityActivityLog.created_at.desc(), FeasibilityActivityLog.id.desc())
        .limit(limit)
        .all()
    )
    return [service.serialize_activity(row) for row in rows]


@router.get("/{request_id}", response_model=FeasibilityRequestOut, summary="Get single feasibility request")
def get_feasibility_request(
    request_id: int,
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp"))
    request = service.get_by_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Feasibility request was not found")
    _require_request_visibility(request, current_user)
    return request


@router.get(
    "/{request_id}/activity-logs",
    response_model=List[FeasibilityActivityLogOut],
    summary="List audit activities for a feasibility request",
)
def list_feasibility_activity_logs(
    request_id: int,
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp"))
    request = service.get_by_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Feasibility request was not found")
    _require_request_visibility(request, current_user)
    return request.get("activities", [])


@router.get("/{request_id}/images/{image_id}", summary="Read a feasibility reference image")
def get_feasibility_image(
    request_id: int,
    image_id: int,
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp"))
    request = service.get_by_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Feasibility request was not found")
    _require_request_visibility(request, current_user)
    image = service.repo.get_image_record(request_id, image_id)
    if not image or not image.image_data:
        raise HTTPException(status_code=404, detail="Reference image was not found")
    return StreamingResponse(
        BytesIO(image.image_data),
        media_type=image.content_type,
        headers={"Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"},
    )


@router.post(
    "",
    response_model=FeasibilityRequestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a feasibility request",
)
def create_feasibility_request(
    payload: FeasibilityRequestCreate,
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_department(current_user, "marketing")
    return service.create(payload, current_user=current_user)


@router.put(
    "/{request_id}/samp-verdict",
    response_model=FeasibilityRequestOut,
    summary="SAMP Team Technical Sign-off / Verdict",
)
def record_samp_verdict(
    request_id: int,
    payload: FeasibilitySampVerdictPayload,
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_department(current_user, "samp")
    return service.record_samp_verdict(request_id, payload, current_user=current_user)


@router.post("/{request_id}/counter-date", response_model=FeasibilityRequestOut, summary="SAMP proposes a revised required date")
def propose_feasibility_counter_date(
    request_id: int,
    payload: FeasibilityCounterDateProposalPayload,
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_department(current_user, "samp")
    return service.propose_counter_date(request_id, payload, current_user=current_user)


@router.post("/{request_id}/counter-date-decision", response_model=FeasibilityRequestOut, summary="Marketing accepts or rejects a SAMP counter-date")
def decide_feasibility_counter_date(
    request_id: int,
    payload: FeasibilityCounterDateDecisionPayload,
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_department(current_user, "marketing")
    request = service.get_by_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Feasibility request was not found")
    _require_request_visibility(request, current_user)
    return service.decide_counter_date(request_id, payload, current_user=current_user)


@router.post(
    "/{request_id}/marketing-decision",
    response_model=FeasibilityRequestOut,
    summary="Marketing Final Decision (Accept or Reject)",
)
def record_marketing_decision(
    request_id: int,
    payload: FeasibilityMarketingDecisionPayload,
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_department(current_user, "marketing")
    request = service.get_by_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Feasibility request was not found")
    _require_request_visibility(request, current_user)
    return service.record_marketing_decision(request_id, payload, current_user=current_user)


@router.post(
    "/{request_id}/claim",
    response_model=FeasibilityRequestOut,
    summary="SAMP Team Member Claims/Takes Feasibility Task",
)
def claim_feasibility_task(
    request_id: int,
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_department(current_user, "samp")
    return service.claim_task(request_id, current_user=current_user)


@router.post(
    "/{request_id}/convert-to-sampling",
    response_model=Dict[str, Any],
    summary="Convert Accepted Feasibility Request into Commercial Sample Request",
)
def convert_feasibility_to_sampling(
    request_id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_department(current_user, "marketing")
    request = service.get_by_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Feasibility request was not found")
    _require_request_visibility(request, current_user)
    request_types = body.get("request_types", body.get("requestTypes")) if isinstance(body, dict) else None
    return service.convert_to_sampling(request_id, current_user=current_user, request_types=request_types)


@router.post(
    "/{request_id}/notes",
    response_model=FeasibilityRequestOut,
    summary="Add a communication note / comment to the feasibility chatter",
)
def add_feasibility_note(
    request_id: int,
    payload: FeasibilityNoteCreate,
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp"))
    request = service.get_by_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Feasibility request was not found")
    _require_request_visibility(request, current_user)
    return service.add_note(request_id, payload.note, current_user=current_user)


@router.post(
    "/{request_id}/viewed",
    summary="Record when a desk operator views a feasibility request",
)
def record_feasibility_viewed(
    request_id: int,
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp"))
    request = service.get_by_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Feasibility request was not found")
    _require_request_visibility(request, current_user)
    recorded = service.record_viewed(request_id, current_user=current_user)
    return {"success": True, "recorded": recorded}


@router.put(
    "/{request_id}",
    response_model=FeasibilityRequestOut,
    summary="Update feasibility review workflow fields",
)
def update_feasibility_request(
    request_id: int,
    payload: Optional[Dict[str, Any]] = Body(default=None),
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp"))
    request = service.get_by_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Feasibility request was not found")
    _require_request_visibility(request, current_user)
    raise HTTPException(
        status_code=409,
        detail="Direct workflow edits are disabled. Use the SAMP verdict or Marketing decision endpoint so the change is audited.",
    )


@router.delete(
    "/{request_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete feasibility request from database (testing / cleanup)",
)
def delete_feasibility_request(
    request_id: int,
    service: FeasibilityService = Depends(get_feasibility_service),
    current_user=Depends(get_current_user),
):
    require_admin(current_user)
    request = service.repo.get_for_update(request_id)
    if request:
        if request.converted_sample_request_id:
            from app.models.sample_request import CreateSampleRequest
            linked_sample = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == request.converted_sample_request_id).first()
            if linked_sample:
                service.db.delete(linked_sample)
            request.converted_sample_request_id = None
            request.converted_sr_number = None
        service.repo.add_activity_log(
            feasibility_request_id=request.id,
            actor_id=getattr(current_user, "id", None),
            actor_name=getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Admin",
            actor_department="Admin",
            action="DELETED",
            payload={
                "request_code": request.request_code,
                "customer_id": request.customer_id,
                "feasibility_type": request.feasibility_type,
                "status": request.status,
            },
            commit=False,
        )
        service.db.flush()
        deleted = service.delete(request_id)
    else:
        deleted = False
    if not deleted:
        raise HTTPException(status_code=404, detail="Feasibility request was not found")
    return None

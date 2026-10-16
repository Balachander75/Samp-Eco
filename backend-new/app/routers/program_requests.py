"""API endpoints for Seasonal Program Planning and Material Specification Matrix."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.permissions import assigned_plant_labels, is_admin, is_team_head, require_admin, require_any_team, require_plant_access, require_smps_member, require_team, user_has_team
from app.auth.security import get_current_user
from app.database import get_db
from app.schemas.program_request import (
    ProgramBatchSampRemarksUpdate,
    ProgramActivityPinSubmit,
    ProgramActivityReplySubmit,
    ProgramMaterialCreate,
    ProgramNoteCreate,
    ProgramOutputSubmit,
    ProgramClaimSubmit,
    ProgramRequestCreate,
    ProgramRequestOut,
    ProgramRequestUpdate,
    ProgramSeenSubmit,
    SingleSampRemarkUpdate,
)
from app.services.program_request_service import ProgramRequestService

router = APIRouter(
    prefix="/api/v1/program-requests",
    tags=["Program Requests"],
    dependencies=[Depends(require_smps_member)],
)


def get_program_service(db: Session = Depends(get_db)) -> ProgramRequestService:
    return ProgramRequestService(db)


def _require_marketing_request_owner(request_id: int, service: ProgramRequestService, current_user) -> None:
    if not user_has_team(current_user, "marketing") or is_admin(current_user) or is_team_head(current_user):
        return
    item = service.get_by_id(request_id)
    if not item or item.get("created_by_user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Program planning request was not found")


def _require_program_request_visibility(request_id: int, service: ProgramRequestService, current_user) -> dict:
    item = service.get_by_id(request_id)
    if not item:
        raise HTTPException(status_code=404, detail="Program planning request was not found")
    if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user) and item.get("created_by_user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Program planning request was not found")
    if user_has_team(current_user, "samp") and not is_admin(current_user) and not is_team_head(current_user) and item.get("sampling_claimed_by_user_id") not in (None, current_user.id):
        raise HTTPException(status_code=404, detail="Program planning request was not found")
    if user_has_team(current_user, "plant") and not is_admin(current_user) and not is_team_head(current_user) and item.get("plant_claimed_by_user_id") not in (None, current_user.id):
        raise HTTPException(status_code=404, detail="Program planning request was not found")
    require_plant_access(current_user, item.get("target_plant"), service.db)
    return item


@router.get("", response_model=List[ProgramRequestOut], summary="List all seasonal program requests")
def list_program_requests(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    year: Optional[str] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=5000, ge=1, le=5000),
    before_id: Optional[int] = Query(default=None, ge=1),
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Retrieve all program requests with their material specification matrix rows and audit logs."""
    plant_labels = (
        assigned_plant_labels(current_user, service.db)
        if user_has_team(current_user, "plant") and not is_admin(current_user)
        else None
    )
    rows = service.list_all(
        year=year, status_filter=status_filter, plant_labels=plant_labels,
        created_by_user_id=(current_user.id if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user) else None),
        visible_samp_user_id=(current_user.id if user_has_team(current_user, "samp") and not is_admin(current_user) and not is_team_head(current_user) else None),
        visible_plant_user_id=(current_user.id if user_has_team(current_user, "plant") and not is_admin(current_user) and not is_team_head(current_user) else None),
        offset=offset,
        limit=limit,
        before_id=before_id,
    )
    return rows


@router.get("/{request_id}", response_model=ProgramRequestOut, summary="Get program request by ID")
def get_program_request(
    request_id: int,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Fetch single program planning request with full matrix rows and audit logs."""
    return _require_program_request_visibility(request_id, service, current_user)


@router.post(
    "",
    response_model=ProgramRequestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new program planning request with material matrix",
)
def create_program_request(
    payload: ProgramRequestCreate,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Creates a new program planning request with material matrix."""
    require_team(current_user, "marketing")
    if not is_admin(current_user) and any(material.samp_remark for material in payload.materials or []):
        raise HTTPException(status_code=403, detail="SAMP remarks are owned by the SAMP Team")
    return service.create(payload, current_user=current_user)


@router.put("/{request_id}", response_model=ProgramRequestOut, summary="Update program request metadata")
def update_program_request(
    request_id: int,
    payload: ProgramRequestUpdate,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Update high-level program request fields (e.g. status, customer, plant)."""
    require_team(current_user, "marketing")
    _require_marketing_request_owner(request_id, service, current_user)
    if any(
        getattr(payload, field) is not None
        for field in ("sampling_verdict", "sampling_remark", "plant_verdict", "plant_remark")
    ):
        raise HTTPException(status_code=403, detail="Use the SAMP or Plant review endpoint for team-owned review fields")
    item = service.update(request_id, payload, current_user=current_user)
    if not item:
        raise HTTPException(status_code=404, detail="Program planning request was not found")
    return item


@router.patch("/{request_id}/status", response_model=ProgramRequestOut, summary="Update program request status")
def update_program_request_status(
    request_id: int,
    payload: ProgramRequestUpdate,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Compatibility route: workflow status can no longer be manually overridden."""
    require_team(current_user, "marketing")
    _require_marketing_request_owner(request_id, service, current_user)
    raise HTTPException(status_code=409, detail="Program plan status cannot be edited manually")


@router.post(
    "/{request_id}/notes",
    response_model=ProgramRequestOut,
    summary="Add a communication note / comment to the program planning chatter",
)
def add_program_note(
    request_id: int,
    payload: ProgramNoteCreate,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Add a persistent note/comment to the program planning chatter and audit activity log."""
    require_any_team(current_user, ("marketing", "samp", "plant"))
    _require_program_request_visibility(request_id, service, current_user)
    return service.add_note(request_id, payload.note, current_user=current_user)


@router.put(
    "/{request_id}/samp-remarks",
    response_model=ProgramRequestOut,
    summary="Batch update SAMP team remarks on material specification matrix rows",
)
def update_batch_samp_remarks(
    request_id: int,
    payload: ProgramBatchSampRemarksUpdate,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Batch update SAMP remarks on multiple material specification matrix rows."""
    require_team(current_user, "samp")
    item = service.update_batch_samp_remarks(request_id, payload, current_user=current_user)
    if not item:
        raise HTTPException(status_code=404, detail="Program planning request was not found")
    return item


@router.patch(
    "/{request_id}/materials/{material_id}/samp-remark",
    response_model=ProgramRequestOut,
    summary="Update SAMP team remark on a single material specification row",
)
def update_single_material_samp_remark(
    request_id: int,
    material_id: int,
    payload: SingleSampRemarkUpdate,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Update SAMP team remark on an individual material row."""
    require_team(current_user, "samp")
    item = service.update_single_samp_remark(request_id, material_id, payload, current_user=current_user)
    if not item:
        raise HTTPException(status_code=404, detail="Program request or material row was not found")
    return item


@router.post(
    "/{request_id}/materials",
    response_model=ProgramRequestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a material row to an existing program planning request",
)
def add_program_material(
    request_id: int,
    payload: ProgramMaterialCreate,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Adds a new material specification row."""
    require_team(current_user, "marketing")
    _require_marketing_request_owner(request_id, service, current_user)
    if not is_admin(current_user) and payload.samp_remark:
        raise HTTPException(status_code=403, detail="SAMP remarks are owned by the SAMP Team")
    item = service.add_material(request_id, payload, current_user=current_user)
    if not item:
        raise HTTPException(status_code=404, detail="Program planning request was not found")
    return item


@router.delete(
    "/{request_id}/materials/{material_id}",
    response_model=ProgramRequestOut,
    summary="Delete a material row from an existing program planning request",
)
def delete_program_material(
    request_id: int,
    material_id: int,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Removes a material specification row."""
    require_admin(current_user)
    item = service.delete_material(request_id, material_id, current_user=current_user)
    if not item:
        raise HTTPException(status_code=404, detail="Program request or material row was not found")
    return item


@router.post("/{request_id}/outputs", response_model=ProgramRequestOut)
def submit_program_output(
    request_id: int,
    payload: ProgramOutputSubmit,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Save a SAMP or Plant note about the annual Marketing plan."""
    department = payload.department.strip().casefold()
    if department == "sampling":
        require_team(current_user, "samp")
    else:
        require_team(current_user, "plant")
        existing = service.get_by_id(request_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Program planning request was not found")
        require_plant_access(current_user, existing.get("target_plant"), service.db)
    return service.submit_output(request_id, department, payload.remark, current_user=current_user)


@router.post("/{request_id}/activities/{activity_id}/pin", response_model=ProgramRequestOut)
def pin_program_output(
    request_id: int,
    activity_id: int,
    payload: ProgramActivityPinSubmit,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    _require_marketing_request_owner(request_id, service, current_user)
    return service.pin_output(request_id, activity_id, payload.pinned, current_user=current_user)


@router.post("/{request_id}/activities/{activity_id}/reply", response_model=ProgramRequestOut)
def reply_to_program_output(
    request_id: int,
    activity_id: int,
    payload: ProgramActivityReplySubmit,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    _require_marketing_request_owner(request_id, service, current_user)
    return service.reply_to_output(request_id, activity_id, payload.remark, current_user=current_user)


@router.post(
    "/{request_id}/claim",
    response_model=ProgramRequestOut,
    summary="Claim a Program Planning review task (Sampling or Plant)",
)
def claim_program_task(
    request_id: int,
    payload: ProgramClaimSubmit,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Claim the review task for Sampling Team or Plant Team before responding."""
    department = payload.department.strip().casefold()
    if department in {"sampling", "samp", "samp team"}:
        require_team(current_user, "samp")
        dept = "sampling"
    elif department == "plant":
        require_team(current_user, "plant")
        existing = service.get_by_id(request_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Program planning request was not found")
        require_plant_access(current_user, existing.get("target_plant"), service.db)
        dept = "plant"
    else:
        raise HTTPException(status_code=422, detail="Department must be sampling or plant")

    _require_program_request_visibility(request_id, service, current_user)
    return service.claim_task(request_id, dept, current_user=current_user)


@router.post(
    "/{request_id}/seen",
    response_model=ProgramRequestOut,
    summary="Record that Sampling Team or Plant Team has seen/opened this program request",
)
def mark_program_seen(
    request_id: int,
    payload: ProgramSeenSubmit,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Update seen status timestamp and viewer."""
    department = payload.department.strip().casefold()
    if department in {"sampling", "samp", "samp team"}:
        require_team(current_user, "samp")
    elif department == "plant":
        require_team(current_user, "plant")
        existing = service.get_by_id(request_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Program planning request was not found")
        require_plant_access(current_user, existing.get("target_plant"), service.db)
    else:
        raise HTTPException(status_code=422, detail="Department must be SAMP Team or Plant")
    _require_program_request_visibility(request_id, service, current_user)
    item = service.mark_seen(request_id, payload, current_user=current_user)
    if not item:
        raise HTTPException(status_code=404, detail="Program planning request was not found")
    return item


@router.delete(
    "/{request_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a program planning request",
)
def delete_program_request(
    request_id: int,
    service: ProgramRequestService = Depends(get_program_service),
    current_user=Depends(get_current_user),
):
    """Permanently delete a seasonal program request and re-sequence remaining requests."""
    require_admin(current_user)
    deleted = service.delete(request_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Program planning request was not found")
    return None


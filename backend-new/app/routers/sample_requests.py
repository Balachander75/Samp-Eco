"""
API router for Sample Requests and Creative Design Requests in backend-new.
Handles marketing intake, staging batch persistence, design brief lifecycle,
artwork submissions, and marketing reviews.
"""
import re
from datetime import date, datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import case, func, literal_column, or_, and_

from app.database import get_db
from app.auth.security import get_current_user
from app.auth.permissions import (
    is_admin,
    is_team_head,
    require_admin,
    require_any_team,
    require_team,
    user_has_team,
    filter_plant_records,
    require_plant_access,
)
from app.models.sample_request import (
    CreateSampleRequest,
    DesignRequest,
    ProductCharacteristic,
    ProductDetail,
    SampleRequestType,
)
from app.models.request_workflows import (
    CostingWorkflow,
    CostingWorkflowLog,
    MockupWorkflow,
    MockupWorkflowLog,
)
from app.models.request_closure import RequestClosure
from app.repositories.sample_request_repo import MISSING_TAXONOMY_FILTER
from app.services.sample_request_service import SampleRequestService
from app.services.design_request_service import DesignRequestService
from app.utils.operational_workdays import india_operational_deadline

router = APIRouter(tags=["Sample Requests & Design Workflows"])


def _normalize_binding(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").casefold())



def get_sample_request_service(db: Session = Depends(get_db)) -> SampleRequestService:
    return SampleRequestService(db)


def get_design_request_service(db: Session = Depends(get_db)) -> DesignRequestService:
    return DesignRequestService(db)


def _require_marketing_request_owner(record: Any, current_user: Any, detail: str = "Sample request not found") -> None:
    if not user_has_team(current_user, "marketing") or is_admin(current_user) or is_team_head(current_user):
        return
    creator_id = record.get("created_by_user_id") if isinstance(record, dict) else getattr(record, "created_by_user_id", None)
    if creator_id != current_user.id:
        raise HTTPException(status_code=404, detail=detail)


def _require_parent_workflows_open(db: Session, sample_request_ids: List[int]) -> None:
    ids = [int(value) for value in sample_request_ids if int(value) > 0]
    if not ids:
        return
    closed_id = db.query(RequestClosure.request_id).filter(
        RequestClosure.request_type.in_(("mockup", "sample", "costing")),
        RequestClosure.request_id.in_(ids),
    ).first()
    if closed_id:
        raise HTTPException(status_code=409, detail="This request has been closed and can no longer be changed")


def _marketing_actor(user: Any) -> str:
    return getattr(user, "name", None) or getattr(user, "userid", None) or "Marketing Specialist"


def _actor_team_label(user: Any) -> str:
    if user_has_team(user, "marketing"):
        return "Marketing"
    if user_has_team(user, "creative_studio"):
        return "Creative Studio"
    if user_has_team(user, "samp"):
        return "Sampling"
    if user_has_team(user, "costing"):
        return "Costing"
    if user_has_team(user, "plant"):
        return "Plant"
    return "Operations"


def _linked_sample_for_design(
    sample_service: SampleRequestService,
    design_request: DesignRequest,
    *,
    for_update: bool = False,
) -> Optional[CreateSampleRequest]:
    if design_request.sample_request_id:
        linked = sample_service.repo.get_for_update(
            design_request.sample_request_id,
            include_product_details=False,
        ) if for_update else sample_service.repo.get_by_id(design_request.sample_request_id)
        if linked:
            return linked
    linked = sample_service.repo.get_by_scope_code(
        "design", design_request.request_code, for_update=for_update
    ) if design_request.request_code else None
    if linked:
        return linked
    return sample_service.repo.get_by_sr_number(design_request.sr_number) if design_request.sr_number else None


def _record_workflow_event(db, *, kind: str, record: CreateSampleRequest, user: Any,
                           action: str, from_stage: Optional[str], to_stage: str,
                           from_status: Optional[str], to_status: Optional[str],
                           details: Optional[Dict[str, Any]] = None) -> None:
    """Persist workflow state and its audit event in the same transaction as the request change."""
    if kind == "mockup":
        workflow_model, log_model = MockupWorkflow, MockupWorkflowLog
        workflow = db.query(workflow_model).filter(
            workflow_model.sample_request_id == record.id
        ).with_for_update().first()
        if workflow is None:
            request_code = (record.request_codes or {}).get("mockup")
            if not request_code:
                request_code = SampleRequestService(db)._reserve_scope_code(record, "mockup")
            workflow = workflow_model(
                sample_request_id=record.id,
                request_code=request_code,
                sr_number=record.sr_number,
                status=from_status or record.status,
                current_stage=from_stage or to_stage,
                workflow_data={},
                created_by_user_id=record.created_by_user_id,
            )
            db.add(workflow)
            db.flush()
            db.add(log_model(
                workflow_id=workflow.id,
                sample_request_id=record.id,
                sr_number=record.sr_number,
                actor_user_id=getattr(user, "id", None),
                actor_name=str(getattr(user, "name", None) or getattr(user, "userid", None) or "User")[:255],
                actor_team=_actor_team_label(user),
                action="WORKFLOW_STARTED",
                to_stage=from_stage or to_stage,
                to_status=from_status or record.status,
                details={"request_types": record.request_types or []},
            ))
        workflow.workflow_data = dict(record.mockup_workflow_state or {})
        if not workflow.request_code:
            workflow.request_code = SampleRequestService(db)._reserve_scope_code(record, "mockup")
    else:
        workflow_model, log_model = CostingWorkflow, CostingWorkflowLog
        workflow = db.query(workflow_model).filter(
            workflow_model.sample_request_id == record.id
        ).with_for_update().first()
        if workflow is None:
            request_code = (record.request_codes or {}).get("costing")
            if not request_code:
                request_code = SampleRequestService(db)._reserve_scope_code(record, "costing")
            workflow = workflow_model(
                sample_request_id=record.id,
                request_code=request_code,
                sr_number=record.sr_number,
                status=from_status or record.status,
                current_stage=from_stage or to_stage,
                request_data={
                    "customer": record.customer,
                    "brand_name": record.brand_name,
                    "material_code": record.material_code,
                    "quantity": record.qty_design_costing,
                    "unit_pc_pack": record.unit_pc_pack,
                    "qty_per_pack": record.qty_per_pack,
                    "required_date": record.costing_required_date,
                    "costing_creative_input_needed": bool(record.costing_creative_input_needed),
                    "costing_creative_input_remark": record.costing_creative_input_remark,
                    "product_description": record.product_description,
                },
                costing_output_path=record.costing_output_path,
                created_by_user_id=record.created_by_user_id,
            )
            db.add(workflow)
            db.flush()
            db.add(log_model(
                workflow_id=workflow.id,
                sample_request_id=record.id,
                sr_number=record.sr_number,
                actor_user_id=getattr(user, "id", None),
                actor_name=str(getattr(user, "name", None) or getattr(user, "userid", None) or "User")[:255],
                actor_team=_actor_team_label(user),
                action="WORKFLOW_STARTED",
                to_stage=from_stage or to_stage,
                to_status=from_status or record.status,
                details=workflow.request_data,
            ))
        if not workflow.request_code:
            workflow.request_code = SampleRequestService(db)._reserve_scope_code(record, "costing")
        else:
            workflow.request_data = {
                **(workflow.request_data or {}),
                "customer": record.customer,
                "brand_name": record.brand_name,
                "material_code": record.material_code,
                "quantity": record.qty_design_costing,
                "unit_pc_pack": record.unit_pc_pack,
                "qty_per_pack": record.qty_per_pack,
                "required_date": record.costing_required_date,
                "costing_creative_input_needed": bool(record.costing_creative_input_needed),
                "costing_creative_input_remark": record.costing_creative_input_remark,
                "product_description": record.product_description,
            }

    if kind == "costing":
        if to_stage == "creative":
            workflow.creative_due_at = (
                india_operational_deadline(datetime.now(timezone.utc), 2)
                if record.costing_creative_input_needed else None
            )
        elif to_stage == "costing" and not record.costing_creative_input_needed:
            workflow.creative_due_at = None

    workflow.sr_number = record.sr_number
    workflow.current_stage = to_stage
    workflow.status = to_status or record.status
    workflow.updated_at = datetime.now(timezone.utc)
    if to_stage == "done":
        workflow.closed_at = datetime.now(timezone.utc)
    elif from_stage == "done":
        workflow.closed_at = None
    db.add(log_model(
        workflow_id=workflow.id,
        sample_request_id=record.id,
        sr_number=record.sr_number,
        actor_user_id=getattr(user, "id", None),
        actor_name=str(getattr(user, "name", None) or getattr(user, "userid", None) or "User")[:255],
        actor_team=_actor_team_label(user),
        action=action[:64],
        from_stage=from_stage,
        to_stage=to_stage,
        from_status=from_status,
        to_status=to_status or record.status,
        details=details or {},
    ))


def _initialize_scoped_workflows(db, record: CreateSampleRequest, user: Any) -> None:
    """Create dedicated rows at Marketing intake so draft and direct requests have full history."""
    request_types = set(record.request_types or [])
    is_draft = str(record.status or "").strip().casefold().startswith("draft")
    if "sample" in request_types:
        state = dict(record.mockup_workflow_state or {})
        sampling_routing = dict(state.get("samplingRouting") or {})
        sampling_routing.setdefault("stage", "marketing")
        sampling_routing.setdefault("creativeChangesRequired", False)
        sampling_routing.setdefault("creativePendingCharacteristicKeys", [])
        if is_draft:
            sampling_routing["stage"] = "marketing"
        state["samplingRouting"] = sampling_routing
        record.mockup_workflow_state = state
    if "mockup" in request_types and not db.query(MockupWorkflow.id).filter(
        MockupWorkflow.sample_request_id == record.id
    ).first():
        state = dict(record.mockup_workflow_state or {})
        design_needed = _parse_mockup_design_needed(state.get("designNeeded"))
        if design_needed is None:
            design_needed = True

        if is_draft:
            initial_stage = "marketing"
            mockup_action = "MARKETING_SAVED_DRAFT"
        elif design_needed:
            initial_stage = "creative"
            mockup_action = "MARKETING_SUBMITTED_TO_CREATIVE"
            if not record.status or record.status in {"Brief Intake", "Draft (Pre-SMT)"}:
                record.status = "Creative"
        else:
            initial_stage = "studio"
            mockup_action = "MARKETING_SUBMITTED_TO_STUDIO"
            state["creativeBypassed"] = True
            state["creativeShutterstockNo"] = state.get("marketingShutterstockNo") or ""
            state["creativeRemark"] = state.get("marketingRemark") or ""
            if not record.status or record.status in {"Brief Intake", "Draft (Pre-SMT)"}:
                record.status = "Studio"

        state["stage"] = initial_stage
        record.mockup_workflow_state = state
        _record_workflow_event(
            db, kind="mockup", record=record, user=user,
            action=mockup_action,
            from_stage="marketing", to_stage=initial_stage,
            from_status=None, to_status=record.status,
            details={"request_types": sorted(request_types), "design_needed": design_needed},
        )
    if "costing" in request_types and not db.query(CostingWorkflow.id).filter(
        CostingWorkflow.sample_request_id == record.id
    ).first():
        costing_stage = "marketing" if is_draft else "creative" if record.costing_creative_input_needed else "costing"
        costing_action = (
            "MARKETING_SAVED_DRAFT" if is_draft else
            "MARKETING_SUBMITTED_TO_CREATIVE" if record.costing_creative_input_needed else
            "MARKETING_SUBMITTED_TO_COSTING"
        )
        costing_status = (
            (record.status or "Draft (Pre-SMT)") if is_draft else
            ("Creative Review" if record.costing_creative_input_needed else "Costing Work")
        )
        _record_workflow_event(
            db, kind="costing", record=record, user=user,
            action=costing_action,
            from_stage="marketing", to_stage=costing_stage,
            from_status=None, to_status=costing_status,
            details={
                "request_types": sorted(request_types),
                "quantity": record.qty_design_costing,
                "unit": record.unit_pc_pack,
                "qty_per_pack": record.qty_per_pack,
                "required_date": record.costing_required_date,
                "costing_creative_input_needed": bool(record.costing_creative_input_needed),
                "costing_creative_input_remark": record.costing_creative_input_remark,
            },
        )


def _validate_staged_handoff_requirements(record: CreateSampleRequest) -> None:
    """Keep required Mockup and Costing intake fields enforced at the API boundary."""
    request_types = set(record.request_types or [])
    mockup_state = record.mockup_workflow_state if isinstance(record.mockup_workflow_state, dict) else {}

    if "costing" in request_types:
        quantity = str(record.qty_design_costing or "").strip()
        if not quantity.isdigit() or int(quantity) < 1:
            raise HTTPException(status_code=422, detail=f"Enter a whole-number Costing quantity for {record.product_description or record.sr_number}.")
        if str(record.unit_pc_pack or "").casefold() not in {"pc", "pack"}:
            raise HTTPException(status_code=422, detail=f"Choose PC or Pack as the Costing unit for {record.product_description or record.sr_number}.")
        if not str(record.costing_required_date or "").strip():
            raise HTTPException(status_code=422, detail=f"Costing required date is mandatory for {record.product_description or record.sr_number}.")

    if ("sample" in request_types or "costing" in request_types) and str(record.unit_pc_pack or "").casefold() == "pack":
        pieces_per_pack = str(record.qty_per_pack or "").strip()
        if not pieces_per_pack.isdigit() or int(pieces_per_pack) < 1:
            raise HTTPException(status_code=422, detail=f"Enter pieces per pack for {record.product_description or record.sr_number}.")

    if "mockup" in request_types:
        product_name = record.product_description or record.sr_number
        if not str(mockup_state.get("requiredDate") or "").strip():
            raise HTTPException(status_code=422, detail=f"Mockup required date is mandatory for {product_name}.")
        mockup_quantity = str(mockup_state.get("qtyForMockup") or "").strip()
        if not mockup_quantity.isdigit() or int(mockup_quantity) < 1:
            raise HTTPException(status_code=422, detail=f"Enter a whole-number Mockup quantity for {product_name}.")
        design_needed = _parse_mockup_design_needed(mockup_state.get("designNeeded"))
        if not isinstance(design_needed, bool):
            raise HTTPException(status_code=422, detail=f"Choose whether a new design is needed for {product_name}.")
        if not design_needed and not str(mockup_state.get("marketingShutterstockNo") or "").strip() and not str(mockup_state.get("marketingRemark") or "").strip():
            raise HTTPException(status_code=422, detail=f"Enter a Shutterstock number or remark when no new design is needed for {product_name}.")


def _parse_mockup_design_needed(value: Any) -> Optional[bool]:
    """Normalize the Marketing Yes/No choice saved in Mockup workflow state."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().casefold()
        if normalized in {"yes", "true", "1"}:
            return True
        if normalized in {"no", "false", "0"}:
            return False
    return None


# ---------------------------------------------------------------------------
# Sample Requests Endpoints (/api/v1/sample-requests)
# ---------------------------------------------------------------------------

@router.get("/api/v1/sample-requests", response_model=List[Dict[str, Any]], summary="List sample requests")
def list_sample_requests(
    year: Optional[str] = Query(default=None),
    customer: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    draft_only: bool = Query(default=False),
    request_type: Optional[str] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=5000, ge=1, le=5000),
    before_id: Optional[int] = Query(default=None, ge=1),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp", "plant", "creative_studio", "costing"))
    created_by_filter = None
    if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user):
        created_by_filter = current_user.id

    return service.list_requests(
        year=year,
        customer=customer,
        status=status,
        draft_only=draft_only,
        created_by_user_id=created_by_filter,
        request_type=request_type,
        skip=offset,
        limit=limit,
        before_id=before_id,
    )


@router.get("/api/v1/sample-requests/marketing-sampling", response_model=List[Dict[str, Any]], summary="List marketing sampling requests")
def list_marketing_sampling_requests(
    year: Optional[str] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=5000, ge=1, le=5000),
    before_id: Optional[int] = Query(default=None, ge=1),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp", "plant", "creative_studio"))
    created_by_filter = None
    if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user):
        created_by_filter = current_user.id

    return service.list_requests(
        year=year,
        created_by_user_id=created_by_filter,
        skip=offset,
        limit=limit,
        before_id=before_id,
    )


@router.get("/api/v1/sample-requests/drafts", response_model=List[Dict[str, Any]], summary="List draft sample requests")
def list_draft_sample_requests(
    year: Optional[str] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=5000, ge=1, le=5000),
    before_id: Optional[int] = Query(default=None, ge=1),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp", "plant", "creative_studio"))
    created_by_filter = None
    if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user):
        created_by_filter = current_user.id

    return service.list_requests(
        year=year,
        draft_only=True,
        created_by_user_id=created_by_filter,
        skip=offset,
        limit=limit,
        before_id=before_id,
    )


@router.get("/api/v1/sample-requests/search-material", summary="Search products by material code (alias)")
@router.get("/api/v1/sample-requests/search-materials", summary="Search products by material code")
def search_materials_get(
    query: Optional[str] = None,
    code: Optional[str] = None,
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    search_term = code or query or ""
    require_team(current_user, "marketing")
    return service.search_materials(search_term)


@router.get("/api/v1/sample-requests/plant-queue", response_model=List[Dict[str, Any]], summary="List sample requests released to Plant")
def list_plant_sampling_queue(
    year: Optional[str] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=500, ge=1, le=2000),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "plant")
    records = service.list_requests(
        year=year,
        status="Released to Plant",
        request_type="sample",
        skip=offset,
        limit=limit,
    )
    return filter_plant_records(current_user, records, service.db)


@router.get("/api/v1/sample-requests/{id}", summary="Get sample request by ID")
def get_sample_request(
    id: str,
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp", "plant", "creative_studio", "costing"))
    num_id = int(id) if id.isdigit() else None
    if num_id:
        record = service.get_by_id(num_id)
    else:
        req = service.repo.get_by_sr_number(id)
        record = service.get_by_id(req.id) if req else None

    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")
    _require_marketing_request_owner(record, current_user)
    return record


@router.post("/api/v1/sample-requests", status_code=status.HTTP_201_CREATED, summary="Create a single sample request")
def create_sample_request(
    payload: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    desc = str(payload.get("product_description") or payload.get("productDescription") or "").strip()
    if not desc:
        raise HTTPException(status_code=422, detail="Product description is required to create a sample request.")

    payload["created_by"] = _marketing_actor(current_user)
    payload["created_by_user_id"] = current_user.id
    payload["actor_user_id"] = current_user.id
    payload["actor_name"] = _marketing_actor(current_user)
    payload.pop("linked_request_codes", None)
    if not payload.get("target_plant"):
        payload["target_plant"] = service.get_default_plant()

    try:
        created = service.create(payload, commit=False)
        created_model = service.db.query(CreateSampleRequest).filter(
            CreateSampleRequest.id == created.get("id")
        ).first()
        if created_model:
            _initialize_scoped_workflows(service.db, created_model, current_user)
            created = service.serialize(created_model)

        # Keep the request, initial workflow rows, and optional Design row in
        # the same transaction so a failed workflow setup cannot strand intake.
        if "design" in (created.get("request_types") or []):
            design_service.sync_sample_request({**payload, **created}, commit=False)
        service.db.commit()
    except Exception:
        service.db.rollback()
        raise

    return {"success": True, "message": "Sample request created successfully", "data": created, **created}


@router.post("/api/v1/sample-requests/batch", status_code=status.HTTP_201_CREATED, summary="Batch create multiple sample requests")
def create_sample_requests_batch(
    body: Any = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    if isinstance(body, list):
        normalized_items = [item for item in body if isinstance(item, dict)]
    elif isinstance(body, dict):
        items = body.get("requests") or body.get("items", [])
        shared_fields = {k: v for k, v in body.items() if k not in {"requests", "items"}}
        normalized_items = [{**shared_fields, **item} for item in items if isinstance(item, dict)]
    else:
        raise HTTPException(status_code=422, detail="Payload must be a list or object with items array")

    if not normalized_items:
        raise HTTPException(status_code=422, detail="At least one product item is required in the batch.")

    for item in normalized_items:
        desc = str(item.get("product_description") or item.get("productDescription") or "").strip()
        if not desc:
            raise HTTPException(status_code=422, detail="Product description is required for every item in the batch.")
        item.pop("linked_request_codes", None)
        item["created_by"] = _marketing_actor(current_user)
        item["created_by_user_id"] = current_user.id
        item["actor_user_id"] = current_user.id
        item["actor_name"] = _marketing_actor(current_user)
        if not item.get("target_plant"):
            item["target_plant"] = service.get_default_plant()

    try:
        created_results = service.batch_create(normalized_items, commit=False)
        created_models = []
        for index, item in enumerate(created_results):
            model = service.db.query(CreateSampleRequest).filter(
                CreateSampleRequest.id == item.get("id")
            ).first()
            if model:
                _initialize_scoped_workflows(service.db, model, current_user)
                created_results[index] = service.serialize(model)
                created_models.append((index, model))

        # Design synchronization participates in this same batch transaction.
        for index, model in created_models:
            item = created_results[index]
            if "design" in (item.get("request_types") or []):
                raw_input = normalized_items[index] if index < len(normalized_items) else {}
                design_service.sync_sample_request({**raw_input, **item}, commit=False)
        service.db.commit()
    except Exception:
        service.db.rollback()
        raise

    return {
        "success": True,
        "count": len(created_results),
        "results": created_results,
    }


@router.put("/api/v1/sample-requests/{id}", summary="Update sample request")
@router.patch("/api/v1/sample-requests/{id}", summary="Patch sample request")
def update_sample_request(
    id: int,
    payload: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp", "plant", "creative_studio"))
    if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user):
        existing = service.get_by_id(id)
        if not existing:
            raise HTTPException(status_code=404, detail="Sample request not found")
        _require_marketing_request_owner(existing, current_user)
    payload["actor_user_id"] = current_user.id
    payload["actor_name"] = _marketing_actor(current_user)
    payload["actor_department"] = _actor_team_label(current_user)

    try:
        updated = service.update(id, payload, commit=False)
        if not updated:
            raise HTTPException(status_code=404, detail="Sample request not found")

        # Keep the sample record and its scoped Design workflow in one transaction.
        if "design" in (updated.get("request_types") or []):
            design_service.sync_sample_request(updated, commit=False)
        service.db.commit()
    except Exception:
        service.db.rollback()
        raise

    return {"success": True, "data": updated}


@router.delete("/api/v1/sample-requests/{id}", summary="Delete a draft sample request")
def delete_sample_request(
    id: int,
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    if is_team_head(current_user):
        raise HTTPException(status_code=403, detail="Team heads have read-only access to operational workflows")
    existing = service.get_by_id(id)
    if not existing:
        raise HTTPException(status_code=404, detail="Sample request not found")
    if not is_admin(current_user):
        _require_marketing_request_owner(existing, current_user)
    status_lower = str(existing.get("status") or "").lower()
    if not ("draft" in status_lower or "smt" in status_lower):
        raise HTTPException(status_code=400, detail="Only draft sample requests can be deleted.")

    try:
        if "design" in (existing.get("request_types") or []):
            design_service.sync_sample_request(existing, is_delete=True, commit=False)
        service.delete(id)
    except Exception:
        service.db.rollback()
        raise

    return {"success": True, "message": "Draft sample request deleted successfully"}



def _evaluate_is_resample(
    record: CreateSampleRequest,
    service: SampleRequestService,
    state: dict,
    routing: dict,
) -> bool:
    """Bulletproof determination if a sample request is a Resample to be released directly to Plant.

    Rules:
    1. If creation_mode is 'new', it is NEVER a resample (must go to Sampling Review PMT).
    2. If state or routing explicitly says isResample:
       Return True (as long as creation_mode != 'new').
    3. Auto-detection fallback for catalog/existing products:
       - creation_mode is not 'new'
       - creative_changes_required is False
       - not a design variant (no variantNumber)
       - has an existing product source:
         a) source_sample_request_id or source_sample_code is present and not temporary, OR
         b) creation_mode in ("material_code", "binding", "resample"), OR
         c) material_code is a valid catalog code (not starting with TMP- or NEW- or DSG-)
    """
    creation_mode = str(record.creation_mode or "").strip().lower()
    if creation_mode == "new":
        return False

    explicit_resample = bool(
        state.get("isResample")
        or state.get("is_resample")
        or routing.get("isResample")
        or routing.get("is_resample")
        or creation_mode == "resample"
    )
    if explicit_resample:
        return True

    creative_changes_required = bool(routing.get("creativeChangesRequired") or state.get("creativeChangesRequired"))
    is_variant = bool(state.get("variantNumber") or routing.get("isDesignVariant"))
    if creative_changes_required or is_variant:
        return False

    mat_code = str(record.material_code or "").strip().upper()
    src_code = str(record.source_sample_code or "").strip().upper()
    has_valid_mat = bool(mat_code and not mat_code.startswith(("TMP-", "NEW-", "DSG-")))
    has_valid_src = bool(src_code and not src_code.startswith(("TMP-", "NEW-", "DSG-")))
    has_source_id = bool(getattr(record, "source_sample_request_id", None) or state.get("sourceSampleRequestId") or routing.get("sourceSampleRequestId"))
    is_catalog_mode = creation_mode in {"material_code", "binding"}

    if has_source_id or has_valid_src or (has_valid_mat and is_catalog_mode):
        return True

    if has_valid_mat:
        existing = service.repo.search_materials(record.material_code, limit=1)
        if existing and existing[0].id != record.id:
            return True

    return False


@router.post("/api/v1/sample-requests/release-batch", summary="Release multiple sample requests from draft")
def release_batch_sample_requests(
    body: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    ids = body.get("ids") or []
    new_status = body.get("status") or "Creative"
    if not ids or not isinstance(ids, list):
        raise HTTPException(status_code=422, detail="ids array is required")

    int_ids = [int(i) for i in ids if str(i).isdigit()]
    records = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id.in_(int_ids)).with_for_update().all()
    _require_parent_workflows_open(service.db, int_ids)
    for record in records:
        _require_marketing_request_owner(record, current_user)
    if not str(new_status).strip().casefold().startswith("draft"):
        for record in records:
            _validate_staged_handoff_requirements(record)

    # A Mockup with no new design goes straight to Studio. Keep the shared
    # request status in sync for standalone Mockup requests; mixed-scope
    # requests retain their shared status while each workflow tracks its own stage.
    status_groups: Dict[str, List[int]] = {}
    status_by_id: Dict[int, str] = {}
    for record in records:
        target_status = new_status
        request_types = set(record.request_types or [])
        state = dict(record.mockup_workflow_state or {})
        routing = dict(state.get("samplingRouting") or {})
        if "sample" in request_types:
            current_stage = str(routing.get("stage") or "").strip().casefold()
            already_released = current_stage in {"creative", "sampling_review", "plant"}
            if not already_released:
                needs_creative = bool(routing.get("creativeChangesRequired"))
                is_resample = _evaluate_is_resample(record, service, state, routing)
                if is_resample:
                    routing["isResample"] = True
                    state["isResample"] = True
                    routing["stage"] = "plant"
                    now = datetime.now(timezone.utc).isoformat()
                    state.update({"plantReleasedAt": now, "plantReleasedBy": _marketing_actor(current_user), "plantReleaseTarget": record.target_plant or "Khaniwade"})
                    events = list(state.get("events") or [])
                    events.append({"id": f"event-{uuid4().hex}", "action": "RESAMPLE_SENT_DIRECTLY_TO_PLANT", "title": "Unchanged resample sent directly to Plant", "actorName": _marketing_actor(current_user), "actorDepartment": "Marketing", "timestamp": now})
                    state["events"] = events[-100:]
                elif needs_creative:
                    routing["stage"] = "creative"
                    routing["creativeDueAt"] = india_operational_deadline(datetime.now(timezone.utc), 1).isoformat()
                    routing["creativeDelayed"] = False
                else:
                    routing["stage"] = "sampling_review"
                    now = datetime.now(timezone.utc).isoformat()
                    events = list(state.get("events") or [])
                    events.append({"id": f"event-{uuid4().hex}", "action": "SUBMITTED_TO_SAMPLING_REVIEW", "title": "Submitted to Sampling Team for technical review", "actorName": _marketing_actor(current_user), "actorDepartment": "Marketing", "timestamp": now})
                    state["events"] = events[-100:]
                state["samplingRouting"] = routing
                state["stage"] = routing["stage"]
                record.mockup_workflow_state = state

        sample_needs_creative = "sample" in request_types and bool(routing.get("creativeChangesRequired"))
        mockup_needs_creative = "mockup" in request_types and (_parse_mockup_design_needed(state.get("designNeeded")) is not False)
        costing_needs_creative = "costing" in request_types and bool(record.costing_creative_input_needed)

        if sample_needs_creative or mockup_needs_creative or costing_needs_creative:
            target_status = "Creative"
        elif "mockup" in request_types:
            target_status = "Studio"
        elif "sample" in request_types:
            is_resample = _evaluate_is_resample(record, service, state, routing)
            target_status = "Released to Plant" if is_resample else "Sampling Review (PMT)"
        elif "costing" in request_types:
            target_status = "Costing"
        else:
            target_status = new_status
        status_by_id[record.id] = target_status
        status_groups.setdefault(target_status, []).append(record.id)

    count = sum(service.batch_update_status(group_ids, status) for status, group_ids in status_groups.items())

    # Release any linked design requests
    for req_id in int_ids:
        rec = service.get_by_id(req_id)
        if rec:
            req_types = rec.get("request_types") or []
            model = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == req_id).first()
            existing_mockup_workflow = service.db.query(MockupWorkflow).filter(
                MockupWorkflow.sample_request_id == req_id
            ).first() if model and "mockup" in req_types else None
            if model:
                model.status = status_by_id.get(req_id, model.status)
                rec["status"] = model.status
            if model and "mockup" in req_types and (
                existing_mockup_workflow is None or existing_mockup_workflow.current_stage == "marketing"
            ):
                previous = str(existing_mockup_workflow.status if existing_mockup_workflow else "Draft (Pre-SMT)")
                state = dict(model.mockup_workflow_state or {})
                design_needed = _parse_mockup_design_needed(state.get("designNeeded"))
                target_stage = "studio" if design_needed is False else "creative"
                if design_needed is False:
                    state["creativeBypassed"] = True
                    state["creativeShutterstockNo"] = state.get("marketingShutterstockNo") or ""
                    state["creativeRemark"] = state.get("marketingRemark") or ""
                else:
                    state.pop("creativeBypassed", None)
                state["stage"] = target_stage
                model.mockup_workflow_state = state
                mockup_status = "Studio" if target_stage == "studio" else "Creative"
                _record_workflow_event(
                    service.db, kind="mockup", record=model, user=current_user,
                    action="MARKETING_SUBMITTED_TO_STUDIO" if target_stage == "studio" else "MARKETING_SUBMITTED_TO_CREATIVE",
                    from_stage=existing_mockup_workflow.current_stage if existing_mockup_workflow else "marketing",
                    to_stage=target_stage, from_status=previous, to_status=mockup_status,
                    details={"request_types": req_types, "design_needed": design_needed},
                )
            existing_costing_workflow = service.db.query(CostingWorkflow).filter(
                CostingWorkflow.sample_request_id == req_id
            ).first() if model and "costing" in req_types else None
            if model and "costing" in req_types and (
                existing_costing_workflow is None or existing_costing_workflow.current_stage == "marketing"
            ):
                previous = str(existing_costing_workflow.status if existing_costing_workflow else "Draft (Pre-SMT)")
                needs_creative = model.costing_creative_input_needed is True
                costing_stage = "creative" if needs_creative else "costing"
                costing_status = "Creative Review" if needs_creative else "Costing Work"
                _record_workflow_event(
                    service.db, kind="costing", record=model, user=current_user,
                    action="MARKETING_SUBMITTED_TO_CREATIVE" if needs_creative else "MARKETING_SUBMITTED_TO_COSTING",
                    from_stage=existing_costing_workflow.current_stage if existing_costing_workflow else "marketing",
                    to_stage=costing_stage, from_status=previous, to_status=costing_status,
                    details={
                        "request_types": req_types,
                        "costing_creative_input_needed": needs_creative,
                        "costing_creative_input_remark": model.costing_creative_input_remark,
                        "required_date": model.costing_required_date,
                    },
                )
            if "design" in req_types:
                design_service.sync_sample_request({**rec, "status": rec.get("status") or new_status})
    service.db.commit()

    return {"success": True, "released_count": count, "status": new_status, "statuses": status_by_id}


@router.post("/api/v1/sample-requests/{id}/release", summary="Release single sample request from draft")
def release_single_sample_request(
    id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    new_status = body.get("status") or "Creative"
    existing_record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == id).first()
    if existing_record:
        _require_marketing_request_owner(existing_record, current_user)
    if existing_record and not str(new_status).strip().casefold().startswith("draft"):
        _validate_staged_handoff_requirements(existing_record)
    req_types = existing_record.request_types or [] if existing_record else []
    existing_mockup_workflow = service.db.query(MockupWorkflow).filter(
        MockupWorkflow.sample_request_id == id
    ).first() if existing_record and "mockup" in req_types else None
    actual_status = new_status
    mockup_state = dict(existing_record.mockup_workflow_state or {}) if existing_record else {}
    routing = dict(mockup_state.get("samplingRouting") or {})
    if existing_record and "sample" in req_types:
        needs_creative = bool(routing.get("creativeChangesRequired"))
        is_resample = _evaluate_is_resample(existing_record, service, mockup_state, routing)
        if is_resample:
            routing["isResample"] = True
            mockup_state["isResample"] = True
            routing["stage"] = "plant"
            now = datetime.now(timezone.utc).isoformat()
            mockup_state.update({"plantReleasedAt": now, "plantReleasedBy": _marketing_actor(current_user), "plantReleaseTarget": existing_record.target_plant or "Khaniwade"})
            events = list(mockup_state.get("events") or [])
            events.append({"id": f"event-{uuid4().hex}", "action": "RESAMPLE_SENT_DIRECTLY_TO_PLANT", "title": "Unchanged resample sent directly to Plant", "actorName": _marketing_actor(current_user), "actorDepartment": "Marketing", "timestamp": now})
            mockup_state["events"] = events[-100:]
        elif needs_creative:
            routing["stage"] = "creative"
            routing["creativeDueAt"] = india_operational_deadline(datetime.now(timezone.utc), 1).isoformat()
            routing["creativeDelayed"] = False
        else:
            routing["stage"] = "sampling_review"
            now = datetime.now(timezone.utc).isoformat()
            events = list(mockup_state.get("events") or [])
            events.append({"id": f"event-{uuid4().hex}", "action": "SUBMITTED_TO_SAMPLING_REVIEW", "title": "Submitted to Sampling Team for technical review", "actorName": _marketing_actor(current_user), "actorDepartment": "Marketing", "timestamp": now})
            mockup_state["events"] = events[-100:]
        mockup_state["samplingRouting"] = routing
        mockup_state["stage"] = routing["stage"]
        existing_record.mockup_workflow_state = mockup_state

    sample_needs_creative = "sample" in req_types and bool(routing.get("creativeChangesRequired"))
    mockup_needs_creative = "mockup" in req_types and (_parse_mockup_design_needed(mockup_state.get("designNeeded")) is not False)
    costing_needs_creative = "costing" in req_types and bool(existing_record.costing_creative_input_needed)

    if sample_needs_creative or mockup_needs_creative or costing_needs_creative:
        actual_status = "Creative"
    elif "mockup" in req_types:
        actual_status = "Studio"
    elif "sample" in req_types:
        is_resample = _evaluate_is_resample(existing_record, service, mockup_state, routing)
        actual_status = "Released to Plant" if is_resample else "Sampling Review (PMT)"
    elif "costing" in req_types:
        actual_status = "Costing"
    else:
        actual_status = new_status

    updated = service.update(id, {"status": actual_status})
    if not updated:
        raise HTTPException(status_code=404, detail="Sample request not found")

    req_types = updated.get("request_types") or []
    if "mockup" in req_types:
        model = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == id).first()
        if model and (existing_mockup_workflow is None or existing_mockup_workflow.current_stage == "marketing"):
            previous = str(existing_mockup_workflow.status if existing_mockup_workflow else "Draft (Pre-SMT)")
            state = dict(model.mockup_workflow_state or {})
            design_needed = _parse_mockup_design_needed(state.get("designNeeded"))
            target_stage = "studio" if design_needed is False else "creative"
            if design_needed is False:
                state["creativeBypassed"] = True
                state["creativeShutterstockNo"] = state.get("marketingShutterstockNo") or ""
                state["creativeRemark"] = state.get("marketingRemark") or ""
            else:
                state.pop("creativeBypassed", None)
            state["stage"] = target_stage
            model.mockup_workflow_state = state
            mockup_status = "Studio" if target_stage == "studio" else "Creative"
            _record_workflow_event(
                service.db, kind="mockup", record=model, user=current_user,
                action="MARKETING_SUBMITTED_TO_STUDIO" if target_stage == "studio" else "MARKETING_SUBMITTED_TO_CREATIVE",
                from_stage=existing_mockup_workflow.current_stage if existing_mockup_workflow else "marketing",
                to_stage=target_stage, from_status=previous, to_status=mockup_status,
                details={"request_types": req_types, "design_needed": design_needed},
            )
    if "costing" in req_types:
        model = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == id).first()
        existing_costing_workflow = service.db.query(CostingWorkflow).filter(
            CostingWorkflow.sample_request_id == id
        ).first() if model else None
        if model and (existing_costing_workflow is None or existing_costing_workflow.current_stage == "marketing"):
            previous = str(existing_costing_workflow.status if existing_costing_workflow else "Draft (Pre-SMT)")
            needs_creative = model.costing_creative_input_needed is True
            costing_stage = "creative" if needs_creative else "costing"
            costing_status = "Creative Review" if needs_creative else "Costing Work"
            _record_workflow_event(
                service.db, kind="costing", record=model, user=current_user,
                action="MARKETING_SUBMITTED_TO_CREATIVE" if needs_creative else "MARKETING_SUBMITTED_TO_COSTING",
                from_stage=existing_costing_workflow.current_stage if existing_costing_workflow else "marketing",
                to_stage=costing_stage, from_status=previous, to_status=costing_status,
                details={
                    "request_types": req_types,
                    "costing_creative_input_needed": needs_creative,
                    "costing_creative_input_remark": model.costing_creative_input_remark,
                    "required_date": model.costing_required_date,
                },
            )
    service.db.commit()
    if "design" in req_types:
        design_service.sync_sample_request({**updated, "status": new_status})

    return {"success": True, "data": updated}


@router.delete("/api/v1/sample-requests/{id}", summary="Delete a draft sample request")
def delete_sample_request(
    id: int,
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    if is_team_head(current_user):
        raise HTTPException(status_code=403, detail="Team heads have read-only access to operational workflows")
    existing = service.get_by_id(id)
    if not existing:
        raise HTTPException(status_code=404, detail="Sample request not found")
    if not is_admin(current_user):
        _require_marketing_request_owner(existing, current_user)
    status_lower = str(existing.get("status") or "").lower()
    if not ("draft" in status_lower or "smt" in status_lower):
        raise HTTPException(status_code=400, detail="Only draft sample requests can be deleted.")

    try:
        if "design" in (existing.get("request_types") or []):
            design_service.sync_sample_request(existing, is_delete=True, commit=False)
        service.delete(id)
    except Exception:
        service.db.rollback()
        raise

    return {"success": True, "message": "Draft sample request deleted successfully"}



@router.post("/api/v1/sample-requests/batch-status", summary="Batch update status")
def batch_update_status(
    body: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    ids = body.get("sample_request_ids") or body.get("ids") or []
    new_status = body.get("status")
    if not ids or not new_status:
        raise HTTPException(status_code=422, detail="Missing required parameters")

    parsed_ids = [int(i) for i in ids if str(i).isdigit()]
    if len(parsed_ids) != len(ids):
        raise HTTPException(status_code=422, detail="One or more sample request IDs are invalid.")
    numeric_ids = list(dict.fromkeys(parsed_ids))
    db = service.repo.db
    records = (
        db.query(CreateSampleRequest)
        .filter(CreateSampleRequest.id.in_(numeric_ids))
        .with_for_update()
        .all()
    )
    if len(records) != len(numeric_ids):
        db.rollback()
        raise HTTPException(status_code=404, detail="One or more sample requests were not found.")
    _require_parent_workflows_open(db, numeric_ids)
    for record in records:
        _require_marketing_request_owner(record, current_user)

    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Marketing")
    now = datetime.now(timezone.utc)
    released_statuses: Dict[str, str] = {}
    for record in records:
        previous_status = record.status
        requested_status = str(new_status).strip()
        request_types = set(record.request_types or [])
        workflow = db.query(MockupWorkflow).filter(
            MockupWorkflow.sample_request_id == record.id
        ).first() if "mockup" in request_types else None
        was_draft = str(previous_status or "").strip().casefold().startswith("draft")
        is_releasing = not requested_status.casefold().startswith("draft")
        target_status = requested_status

        if request_types == {"sample"} and is_releasing:
            state = dict(record.mockup_workflow_state or {})
            sampling_routing = dict(state.get("samplingRouting") or {})
            creative_changes_required = bool(sampling_routing.get("creativeChangesRequired"))
            is_resample = _evaluate_is_resample(record, service, state, sampling_routing)
            if is_resample:
                sampling_routing["isResample"] = True
                state["isResample"] = True
                target_status = "Released to Plant"
                sampling_routing["stage"] = "plant"
                released_at = datetime.now(timezone.utc).isoformat()
                state.update({"plantReleasedAt": released_at, "plantReleasedBy": actor, "plantReleaseTarget": record.target_plant or "Khaniwade"})
                events = list(state.get("events") or [])
                events.append({"id": f"event-{uuid4().hex}", "action": "RESAMPLE_SENT_DIRECTLY_TO_PLANT", "title": "Unchanged resample sent directly to Plant", "actorName": actor, "actorDepartment": "Marketing", "timestamp": released_at})
                state["events"] = events[-100:]
            elif creative_changes_required:
                target_status = "Creative"
                sampling_routing["stage"] = "creative"
                sampling_routing["creativeDueAt"] = india_operational_deadline(datetime.now(timezone.utc), 1).isoformat()
                sampling_routing["creativeDelayed"] = False
            else:
                target_status = "Sampling Review (PMT)"
                sampling_routing["stage"] = "sampling_review"
                released_at = datetime.now(timezone.utc).isoformat()
                events = list(state.get("events") or [])
                events.append({"id": f"event-{uuid4().hex}", "action": "SUBMITTED_TO_SAMPLING_REVIEW", "title": "Submitted to Sampling Team for technical review", "actorName": actor, "actorDepartment": "Marketing", "timestamp": released_at})
                state["events"] = events[-100:]
            state["samplingRouting"] = sampling_routing
            state["stage"] = sampling_routing["stage"]
            record.mockup_workflow_state = state

        if (
            "mockup" in request_types
            and was_draft
            and is_releasing
            and (workflow is None or workflow.current_stage == "marketing")
        ):
            _validate_staged_handoff_requirements(record)
            state = dict(record.mockup_workflow_state or {})
            design_needed = _parse_mockup_design_needed(state.get("designNeeded"))
            target_stage = "studio" if design_needed is False else "creative"
            if design_needed is False:
                state["creativeBypassed"] = True
                state["creativeShutterstockNo"] = state.get("marketingShutterstockNo") or ""
                state["creativeRemark"] = state.get("marketingRemark") or ""
                if len(request_types) == 1:
                    target_status = "Studio"
            else:
                state.pop("creativeBypassed", None)
                if len(request_types) == 1:
                    target_status = "Creative"
            state["stage"] = target_stage
            record.mockup_workflow_state = state
            _record_workflow_event(
                db, kind="mockup", record=record, user=current_user,
                action="MARKETING_SUBMITTED_TO_STUDIO" if target_stage == "studio" else "MARKETING_SUBMITTED_TO_CREATIVE",
                from_stage=workflow.current_stage if workflow else "marketing",
                to_stage=target_stage,
                from_status=workflow.status if workflow else previous_status,
                to_status=target_status,
                details={"request_types": sorted(request_types), "design_needed": design_needed},
            )

        if "costing" in request_types and was_draft and is_releasing:
            costing_workflow = db.query(CostingWorkflow).filter(
                CostingWorkflow.sample_request_id == record.id
            ).with_for_update().first()
            if costing_workflow is None or costing_workflow.current_stage == "marketing":
                _validate_staged_handoff_requirements(record)
                needs_creative = record.costing_creative_input_needed is True
                target_stage = "creative" if needs_creative else "costing"
                workflow_status = "Creative Review" if needs_creative else "Costing Work"
                if len(request_types) == 1:
                    target_status = "Creative" if needs_creative else "Costing"
                _record_workflow_event(
                    db,
                    kind="costing",
                    record=record,
                    user=current_user,
                    action="MARKETING_SUBMITTED_TO_CREATIVE" if needs_creative else "MARKETING_SUBMITTED_TO_COSTING",
                    from_stage=costing_workflow.current_stage if costing_workflow else "marketing",
                    to_stage=target_stage,
                    from_status=costing_workflow.status if costing_workflow else previous_status,
                    to_status=workflow_status,
                    details={
                        "request_types": sorted(request_types),
                        "costing_creative_input_needed": needs_creative,
                        "costing_creative_input_remark": record.costing_creative_input_remark,
                        "required_date": record.costing_required_date,
                    },
                )

        record.status = target_status
        record.updated_at = now
        released_statuses[str(record.id)] = target_status
        if previous_status != record.status:
            service.add_activity_log(
                record,
                action="STATUS_CHANGED",
                actor_id=current_user.id,
                actor_name=actor,
                actor_department=_actor_team_label(current_user),
                from_status=previous_status,
                to_status=record.status,
                payload={"source": "batch_update_status"},
            )
    db.commit()

    for record in records:
        updated_request = service.serialize(record)
        req_types = updated_request.get("request_types") or []
        if "design" in req_types:
            design_service.sync_sample_request(updated_request)

    return {"success": True, "updated_count": len(records), "statuses": released_statuses}


# ---------------------------------------------------------------------------
# Catalog Search & Taxonomy Filters
# ---------------------------------------------------------------------------
@router.get("/api/v1/product-characteristics/binding-hierarchy", summary="Get binding hierarchy")
def get_binding_hierarchy(
    category: Optional[str] = None,
    sub_category: Optional[str] = None,
    third_category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    binding_characteristics = (
        db.query(ProductCharacteristic)
        .filter(
            ProductCharacteristic.is_active.is_(True),
            func.upper(ProductCharacteristic.class_name) == "NB_BINDING",
        )
        .order_by(ProductCharacteristic.sequence)
        .all()
    )
    b1_char = next(
        (item for item in binding_characteristics if _normalize_binding(item.characteristic_name) == "bindingtype1"),
        None,
    )
    b2_char = next(
        (item for item in binding_characteristics if _normalize_binding(item.characteristic_name) == "bindingtype2"),
        None,
    )
    master_b1_options = b1_char.options if b1_char and b1_char.options else []
    master_b2_options = b2_char.options if b2_char and b2_char.options else []

    def normalized_taxonomy_sql(column):
        return func.regexp_replace(
            func.lower(func.coalesce(column, literal_column("''"))),
            literal_column("'[^a-z0-9]+'"),
            literal_column("''"),
            literal_column("'g'"),
        )

    def normalized_taxonomy_value(value: str) -> str:
        return _normalize_binding(value)

    def apply_taxonomy_filter(query, column, value):
        if not value or not value.strip():
            return query
        if value == MISSING_TAXONOMY_FILTER:
            return query.filter(or_(column.is_(None), func.trim(func.coalesce(column, "")) == ""))
        return query.filter(normalized_taxonomy_sql(column) == normalized_taxonomy_value(value))

    normalized_class = normalized_taxonomy_sql(ProductDetail.class_name)
    normalized_name = normalized_taxonomy_sql(ProductDetail.characteristic_name)
    clean_value = func.nullif(func.trim(func.coalesce(ProductDetail.value, literal_column("''"))), "")
    binding_values = (
        db.query(
            ProductDetail.sample_request_id.label("request_id"),
            normalized_name.label("characteristic"),
            clean_value.label("value"),
        )
        .filter(normalized_class == "nbbinding")
        .filter(normalized_name.in_(("bindingtype1", "binding1", "bindingtype2", "binding2")))
        .filter(clean_value.isnot(None))
        .filter(func.upper(clean_value).notin_(("NA", "N/A", "NAN", "NULL", "NONE", "-", "—")))
        .subquery()
    )
    binding_by_product = (
        db.query(
            binding_values.c.request_id,
            func.max(case((binding_values.c.characteristic.in_(("bindingtype1", "binding1")), binding_values.c.value))).label("binding1"),
            func.max(case((binding_values.c.characteristic.in_(("bindingtype2", "binding2")), binding_values.c.value))).label("binding2"),
        )
        .group_by(binding_values.c.request_id)
        .subquery()
    )
    product_pairs_query = (
        db.query(binding_by_product.c.binding1, binding_by_product.c.binding2)
        .join(CreateSampleRequest, CreateSampleRequest.id == binding_by_product.c.request_id)
        .filter(or_(binding_by_product.c.binding1.isnot(None), binding_by_product.c.binding2.isnot(None)))
    )
    product_pairs_query = apply_taxonomy_filter(product_pairs_query, CreateSampleRequest.product_category, category)
    product_pairs_query = apply_taxonomy_filter(product_pairs_query, CreateSampleRequest.product_sub_category, sub_category)
    product_pairs_query = apply_taxonomy_filter(product_pairs_query, CreateSampleRequest.product_third_category, third_category)
    product_pairs = product_pairs_query.distinct().all()

    master_b1_options = master_b1_options if isinstance(master_b1_options, list) else []
    master_b2_options = master_b2_options if isinstance(master_b2_options, list) else []
    product_b1_options = [binding1 for binding1, _ in product_pairs if binding1]
    product_b2_options = [binding2 for _, binding2 in product_pairs if binding2]

    def is_valid_binding_option(value: Any) -> bool:
        normalized = _normalize_binding(value)
        return bool(normalized) and normalized not in {"na", "nan", "null", "none"}

    def merge_binding_options(values: List[Any], preferred_labels: List[Any] = ()) -> List[str]:
        options_by_normalized_value: Dict[str, str] = {}
        for value in values:
            label = str(value or "").strip()
            normalized = _normalize_binding(label)
            if is_valid_binding_option(label):
                options_by_normalized_value.setdefault(normalized, label)
        for value in preferred_labels:
            label = str(value or "").strip()
            normalized = _normalize_binding(label)
            if is_valid_binding_option(label):
                options_by_normalized_value[normalized] = label
        return sorted(options_by_normalized_value.values(), key=lambda label: (label.casefold(), label))

    has_taxonomy_filter = any(value and value.strip() for value in (category, sub_category, third_category))
    b1_cleaned = merge_binding_options(product_b1_options, [] if has_taxonomy_filter else master_b1_options)
    b2_cleaned = merge_binding_options(product_b2_options, [] if has_taxonomy_filter else master_b2_options)

    hierarchy: Dict[str, List[str]] = {}
    for binding1 in b1_cleaned:
        matching_binding2 = [
            binding2
            for pair_binding1, binding2 in product_pairs
            if pair_binding1
            and binding2
            and _normalize_binding(pair_binding1) == _normalize_binding(binding1)
        ]
        hierarchy[binding1] = merge_binding_options(matching_binding2)

    return {
        "binding1_options": b1_cleaned,
        "binding2_options": b2_cleaned,
        "hierarchy": hierarchy,
    }


@router.get("/api/v1/product-characteristics/filter-by-binding", summary="Search saved products by binding")
def search_products_by_binding(
    b1: Optional[str] = None,
    b2: Optional[str] = None,
    category: Optional[str] = None,
    sub_category: Optional[str] = None,
    third_category: Optional[str] = None,
    limit: int = Query(default=5000, ge=1, le=5000),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    if not any(value and value.strip() for value in (b1, b2, category, sub_category, third_category)):
        return []
    rows = service.search_products_by_binding(
        binding1=b1,
        binding2=b2,
        category=category,
        sub_category=sub_category,
        third_category=third_category,
        limit=limit,
    )
    return rows


@router.get("/api/v1/product-characteristics/catalog-filter-counts", summary="Count products for catalog filters")
def get_catalog_filter_counts(
    category: Optional[str] = None,
    sub_category: Optional[str] = None,
    third_category: Optional[str] = None,
    b1: Optional[str] = None,
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    return service.catalog_filter_counts(
        category=category,
        sub_category=sub_category,
        third_category=third_category,
        binding1=b1,
    )


# ---------------------------------------------------------------------------
# Product Characteristics Endpoints (/api/v1/product-characteristics)
# ---------------------------------------------------------------------------

@router.get("/api/v1/product-characteristics", summary="List all active product characteristics")
def list_product_characteristics(
    class_name: Optional[str] = Query(default=None),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp", "plant", "creative_studio", "costing"))
    return service.get_all_characteristics(class_name=class_name)


@router.get("/api/v1/product-characteristics/classes", summary="List product characteristic classes")
def list_characteristic_classes(
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp", "plant", "creative_studio", "costing"))
    return service.get_characteristic_classes()


@router.get("/api/v1/product-characteristics/details/{sample_request_id}", summary="Get product details for a sample request")
def get_product_details(
    sample_request_id: int,
    exclude_na: bool = False,
    catalog_lookup: bool = False,
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp", "plant", "creative_studio", "costing"))
    sample = service.get_by_id(sample_request_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample request not found")
    _require_marketing_request_owner(sample, current_user)
    details = service.get_product_details(sample_request_id)
    if catalog_lookup:
        classes = sorted({str(item.get("class_name") or "").strip() for item in details if item.get("class_name")})
        if classes:
            characteristics = service.db.query(ProductCharacteristic).filter(
                func.upper(ProductCharacteristic.class_name).in_([name.upper() for name in classes]),
                ProductCharacteristic.is_active.is_(True),
            ).order_by(ProductCharacteristic.class_name, ProductCharacteristic.sequence).all()
            saved_by_key = {
                (str(item.get("class_name") or "").casefold(), str(item.get("characteristic_name") or "").casefold()): item
                for item in details
            }
            merged = []
            seen = set()
            for index, characteristic in enumerate(characteristics):
                key = (characteristic.class_name.casefold(), characteristic.characteristic_name.casefold())
                saved = saved_by_key.get(key)
                seen.add(key)
                merged.append({
                    "id": saved.get("id") if saved else -1 - index,
                    "sample_request_id": sample_request_id,
                    "sampleRequestId": sample_request_id,
                    "class_name": characteristic.class_name,
                    "className": characteristic.class_name,
                    "characteristic_name": characteristic.characteristic_name,
                    "characteristicName": characteristic.characteristic_name,
                    "value": saved.get("value") if saved else "NA",
                    "uom": (saved.get("uom") if saved else None) or characteristic.uom,
                })
            merged.extend(item for item in details if (
                str(item.get("class_name") or "").casefold(),
                str(item.get("characteristic_name") or "").casefold(),
            ) not in seen)
            details = merged
    if exclude_na:
        empty_values = {"", "na", "n/a", "nan", "null", "none", "-", "—"}
        details = [d for d in details if str(d.get("value") or "").strip().lower() not in empty_values]
    return details


@router.post("/api/v1/product-characteristics/details", summary="Save product details for a sample request")
def save_product_details(
    sample_request_id: Optional[int] = Query(default=None),
    body: Any = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "creative_studio"))
    sr_id = (
        sample_request_id
        or (body.get("sample_request_id") if isinstance(body, dict) else None)
        or (body.get("sampleRequestId") if isinstance(body, dict) else None)
    )
    if isinstance(body, list):
        details = body
    elif isinstance(body, dict):
        details = body.get("details") or []
    else:
        details = []

    if not sr_id or not isinstance(details, list):
        raise HTTPException(status_code=422, detail="Missing sample_request_id or details list")

    sample = service.get_by_id(int(sr_id))
    if not sample:
        raise HTTPException(status_code=404, detail="Sample request not found")
    _require_marketing_request_owner(sample, current_user)

    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == int(sr_id)).with_for_update().first()
    _require_parent_workflows_open(service.db, [int(sr_id)])
    sample_state = dict(record.mockup_workflow_state or {}) if record else {}
    sampling_routing = dict(sample_state.get("samplingRouting") or {})
    if (record and set(record.request_types or []) == {"sample"}
            and sampling_routing.get("creativeChangesRequired")
            and sample_state.get("stage") == "creative"):
        require_team(current_user, "creative_studio")
        _require_mockup_stage_claim(sample_state, current_user, "creative")
        normalize = lambda value: "".join(ch for ch in str(value or "").casefold() if ch.isalnum())
        allowed = {(normalize(item.get("className")), normalize(item.get("characteristicName")))
                   for item in sampling_routing.get("creativePendingCharacteristicKeys", []) if isinstance(item, dict)}
        current = {(normalize(item.class_name), normalize(item.characteristic_name)): str(item.value or "")
                   for item in service.db.query(ProductDetail).filter(ProductDetail.sample_request_id == record.id).all()}
        incoming = {(normalize(item.get("className") or item.get("class_name")),
                     normalize(item.get("characteristicName") or item.get("characteristic_name"))): str(item.get("value") or "")
                    for item in details if isinstance(item, dict)}
        changed = {key for key in current.keys() | incoming.keys() if current.get(key, "") != incoming.get(key, "")}
        if changed - allowed:
            raise HTTPException(status_code=403, detail="Creative may update only the Creative-owned characteristics on this sample variant.")

    success = service.save_product_details(int(sr_id), details)
    if not success:
        raise HTTPException(status_code=404, detail="Sample request not found")
    return {"success": True, "message": "Product details updated successfully"}


@router.post("/api/v1/product-characteristics", summary="Create product characteristic")
def create_product_characteristic(
    payload: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    return service.create_characteristic(payload)


@router.patch("/api/v1/product-characteristics/{id}", summary="Update product characteristic")
def update_product_characteristic(
    id: int,
    payload: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    updated = service.update_characteristic(id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Characteristic not found")
    return updated


@router.post("/api/v1/product-characteristics/{id}/options", summary="Add characteristic option")
def add_characteristic_option(
    id: int,
    payload: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    opt = payload.get("option", "")
    updated = service.add_characteristic_option(id, opt)
    if not updated:
        raise HTTPException(status_code=404, detail="Characteristic not found")
    return updated


# ---------------------------------------------------------------------------
# Mockup & Creative Review Endpoints (/api/v1/sample-requests/{id}/mockup)
# ---------------------------------------------------------------------------

def _clear_mockup_stage_claim(state: Dict[str, Any]) -> None:
    for key in ("claimedBy", "claimedByUserId", "claimedAt", "claimedStage"):
        state.pop(key, None)


def _require_mockup_stage_claim(state: Dict[str, Any], user: Any, expected_stage: str) -> None:
    """Require the current user to claim the exact Mockup stage before acting."""
    if is_admin(user):
        return
    claimed_stage = str(state.get("claimedStage") or "")
    claimed_by_id = state.get("claimedByUserId")
    if claimed_stage != expected_stage or claimed_by_id is None:
        raise HTTPException(status_code=409, detail="Claim this task before continuing")
    if str(claimed_by_id) != str(getattr(user, "id", None)):
        claimed_by = str(state.get("claimedBy") or "another teammate")
        raise HTTPException(status_code=409, detail=f"This task is claimed by {claimed_by}")


def _require_design_request_claim(state: Dict[str, Any], user: Any) -> None:
    claimed_by_id = state.get("claimedByUserId")
    if claimed_by_id is None:
        raise HTTPException(status_code=409, detail="Claim this design task before continuing")
    if str(claimed_by_id) != str(getattr(user, "id", None)):
        raise HTTPException(
            status_code=409,
            detail=f"This design task is claimed by {state.get('claimedBy') or 'another teammate'}",
        )


def _is_design_creative_stage(item: DesignRequest) -> bool:
    status_value = str(item.status or "").strip().casefold()
    decision = str(item.marketing_decision or "").casefold()
    if decision in {"awaiting_marketing_review", "accepted"}:
        return False
    return (
        status_value.startswith("creative")
        or "remaining requested" in status_value
        or decision == "remaining_requested"
    )


def _design_claim_deadline(item: DesignRequest, state: Dict[str, Any]) -> Optional[datetime]:
    released_at = state.get("releasedAt") or state.get("released_at")
    base_time: Optional[datetime] = None
    if released_at:
        try:
            base_time = datetime.fromisoformat(str(released_at).replace("Z", "+00:00"))
        except ValueError:
            base_time = None
    if base_time is None:
        base_time = item.created_at
    if base_time is None:
        return None
    if base_time.tzinfo is None:
        base_time = base_time.replace(tzinfo=timezone.utc)
    return base_time + timedelta(hours=48)


def _require_design_claim_window(item: DesignRequest, state: Dict[str, Any]) -> None:
    deadline = _design_claim_deadline(item, state)
    if deadline is None:
        raise HTTPException(status_code=409, detail="The release time is unavailable. Ask Marketing to refresh the request.")
    if datetime.now(timezone.utc) >= deadline:
        raise HTTPException(
            status_code=409,
            detail="The 48-hour claim and counter-date window has expired. Ask Marketing to review the deadline.",
        )


@router.post("/api/v1/sample-requests/{sample_id}/mockup/claim", summary="Claim the current Mockup workflow task")
def claim_mockup_request(
    sample_id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user = Depends(get_current_user),
):
    require_any_team(current_user, ("creative_studio", "samp", "plant"))
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")

    state = dict(record.mockup_workflow_state or {})
    stage = state.get("stage")
    if not stage:
        stage = "plant" if "sample" in (record.request_types or []) and "released to plant" in str(record.status or "").casefold() else "creative"
        state["stage"] = stage
    stage_teams = {
        "creative": "creative_studio",
        "creative_approval": "creative_studio",
        "studio": "creative_studio",
        "sampling_review": "samp",
        "plant": "plant",
    }
    required_team = stage_teams.get(stage)
    if required_team is None:
        raise HTTPException(status_code=409, detail="This Mockup workflow has no claimable task at its current stage")
    require_team(current_user, required_team)
    if required_team == "plant":
        require_plant_access(current_user, record.target_plant, service.db)
    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Creative Studio").strip()[:100]
    claimed_by = str(state.get("claimedBy") or "").strip()
    claimed_by_id = state.get("claimedByUserId")

    if claimed_by and claimed_by_id and claimed_by_id != current_user.id and not is_admin(current_user):
        raise HTTPException(status_code=409, detail=f"This task is already claimed by {claimed_by}")
    if claimed_by_id is not None and str(claimed_by_id) == str(current_user.id) and state.get("claimedStage") == stage:
        return service.serialize(record)

    now = datetime.now(timezone.utc).isoformat()
    state.update({
        "claimedBy": actor,
        "claimedByUserId": current_user.id,
        "claimedAt": now,
        "claimedStage": stage,
    })
    events = list(state.get("events") or [])
    events.append({
        "id": f"event-{uuid4().hex}",
        "action": "MOCKUP_TASK_CLAIMED",
        "title": f"Task claimed in {stage.title()}",
        "actorName": actor,
        "actorDepartment": _actor_team_label(current_user),
        "timestamp": now,
    })
    state["events"] = events[-100:]
    record.mockup_workflow_state = state
    record.updated_at = datetime.now(timezone.utc)
    service.add_activity_log(
        record,
        action="TASK_CLAIMED",
        actor_id=current_user.id,
        actor_name=actor,
        actor_department=_actor_team_label(current_user),
        from_status=record.status,
        to_status=record.status,
        payload={"stage": stage},
    )
    _record_workflow_event(
        service.db, kind="mockup", record=record, user=current_user,
        action="TASK_CLAIMED", from_stage=stage, to_stage=stage,
        from_status=record.status, to_status=record.status,
        details={"claimed_by": actor, "claimed_by_user_id": current_user.id},
    )
    service.db.commit()
    service.db.refresh(record)

    # Sync linked design request if exists
    design_code = (record.request_codes or {}).get("design")
    if design_code or record.sr_number:
        linked_design = design_service.get_by_request_code(design_code) if design_code else None
        if not linked_design and record.sr_number:
            linked_design = design_service.get_by_sr_number(record.sr_number)
        if linked_design:
            def mutate_design(item: DesignRequest):
                dstate = dict(item.workflow_state or {})
                dstate.update({"claimedBy": actor, "claimedByUserId": current_user.id, "claimedAt": now})
                item.workflow_state = dstate
            design_service.mutate(linked_design["id"], mutate_design, actor_user_id=current_user.id)

    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/mockup/send-to-studio", summary="Release from Creative to Studio, Sampling or Costing")
def send_mockup_request_to_studio(
    sample_id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")

    state = dict(record.mockup_workflow_state or {})
    previous_stage = str(state.get("stage") or "creative")
    request_types = set(record.request_types or [])
    sampling_routing = dict(state.get("samplingRouting") or {})
    is_sampling_creative_handoff = (
        request_types == {"sample"}
        and bool(sampling_routing.get("creativeChangesRequired"))
        and previous_stage == "creative"
    )
    if "mockup" in request_types:
        _require_mockup_stage_claim(state, current_user, "creative")
        if previous_stage != "creative":
            raise HTTPException(status_code=409, detail="This request is not awaiting Creative handoff")
    elif is_sampling_creative_handoff:
        _require_mockup_stage_claim(state, current_user, "creative")
        pending_keys = sampling_routing.get("creativePendingCharacteristicKeys") or []
        if pending_keys:
            normalize = lambda value: "".join(ch for ch in str(value or "").casefold() if ch.isalnum())
            pending = {(normalize(key.get("className")), normalize(key.get("characteristicName")))
                       for key in pending_keys if isinstance(key, dict)}
            configured = {
                (normalize(detail.class_name), normalize(detail.characteristic_name))
                for detail in service.db.query(ProductDetail).filter(ProductDetail.sample_request_id == record.id).all()
                if str(detail.value or "").strip()
            }
            missing = pending - configured
            if missing:
                raise HTTPException(status_code=422, detail="Complete all Creative-owned characteristics before sending this variant to Studio.")
    previous_status = record.status
    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Creative Studio").strip()[:100]

    # Creative Input Needed choice (default True if not specified)
    input_needed = body.get("creative_input_needed")
    if input_needed is None:
        input_needed = body.get("creativeInputNeeded", True)
    if input_needed is None:
        input_needed = True
    input_needed = _parse_mockup_design_needed(input_needed)
    if input_needed is None:
        raise HTTPException(status_code=422, detail="Creative input choice must be true or false")

    creative_shutterstock = str(body.get("creative_shutterstock_no") or body.get("creativeShutterstockNo") or "").strip()
    creative_remark = str(body.get("creative_remark") or body.get("creativeRemark") or "").strip()

    if input_needed and not is_sampling_creative_handoff:
        # Either Shutterstock No or Remark is mandatory when input is needed
        if not creative_shutterstock and not creative_remark:
            raise HTTPException(
                status_code=422,
                detail="Either a Shutterstock number or a remark is mandatory when Creative input is needed."
            )
    if is_sampling_creative_handoff and (not creative_shutterstock or not creative_remark):
        raise HTTPException(status_code=422, detail="Add both the Creative Shutterstock number and a remark before sending this variant to Studio.")

    req_types = list(record.request_types or [])
    now = datetime.now(timezone.utc).isoformat()

    # Determine next workflow destination
    if "mockup" in req_types:
        next_status = "Studio"
        next_stage = "studio"
        action = "MOCKUP_SENT_TO_STUDIO"
        title = "Creative sent the mockup brief to Studio"
    elif is_sampling_creative_handoff:
        next_status = "Studio"
        next_stage = "studio"
        action = "CREATIVE_RELEASED_SAMPLING_VARIANT_TO_STUDIO"
        title = "Creative completed variant specifications and sent it to Studio"
        sampling_routing.update({
            "stage": "studio",
            "creativeCompletedAt": now,
            "creativeCompletedBy": actor,
        })
        state["samplingRouting"] = sampling_routing
    elif "sample" in req_types:
        next_status = "Sampling Review (PMT)"
        next_stage = "sampling"
        action = "CREATIVE_RELEASED_TO_SAMPLING"
        title = "Creative released specifications to Sampling (PMT)"
    elif "costing" in req_types:
        next_status = "Costing Review"
        next_stage = "costing"
        action = "CREATIVE_RELEASED_TO_COSTING"
        title = "Creative released specifications to Costing"
    else:
        next_status = "Studio"
        next_stage = "studio"
        action = "CREATIVE_RELEASED"
        title = "Creative completed review and released request"

    events = list(state.get("events") or [])
    events.append({
        "id": f"event-{uuid4().hex}",
        "action": action,
        "title": title,
        "actorName": actor,
        "actorDepartment": "Creative Studio",
        "timestamp": now,
        "shutterstockNo": creative_shutterstock or None,
        "remark": creative_remark or None,
    })
    state.update({
        "stage": next_stage,
        "creativeInputNeeded": input_needed,
        "creativeShutterstockNo": creative_shutterstock,
        "creativeRemark": creative_remark,
        "sentToStudioAt": now,
        "sentToStudioBy": actor,
        "events": events[-100:],
    })
    _clear_mockup_stage_claim(state)

    record.status = next_status
    record.mockup_workflow_state = state
    record.updated_at = datetime.now(timezone.utc)

    service.add_activity_log(
        record,
        action=action,
        actor_id=current_user.id,
        actor_name=actor,
        actor_department="Creative Studio",
        from_status=previous_status,
        to_status=record.status,
        payload={
            "creative_input_needed": input_needed,
            "creative_shutterstock_no": creative_shutterstock,
            "creative_remark": creative_remark,
        },
    )
    if "mockup" in req_types:
        _record_workflow_event(
            service.db, kind="mockup", record=record, user=current_user,
            action=action, from_stage=previous_stage, to_stage=next_stage,
            from_status=previous_status, to_status=record.status,
            details={
                "creative_input_needed": input_needed,
                "creative_shutterstock_no": creative_shutterstock,
                "creative_remark": creative_remark,
            },
        )
    if "costing" in req_types:
        _record_workflow_event(
            service.db, kind="costing", record=record, user=current_user,
            action="CREATIVE_RELEASED_TO_COSTING", from_stage="creative", to_stage="costing",
            from_status=previous_status, to_status="Costing Review",
            details={"creative_input_needed": input_needed,
                     "creative_shutterstock_no": creative_shutterstock,
                     "creative_remark": creative_remark},
        )
        service.db.query(CostingWorkflow).filter(CostingWorkflow.sample_request_id == record.id).update(
            {CostingWorkflow.status: "Costing Review"}, synchronize_session=False
        )
    if "design" in req_types:
        design_service.sync_sample_request(
            {**service.serialize(record), "status": next_status},
            commit=False,
        )
    service.db.commit()
    service.db.refresh(record)

    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/mockup/marketing-decision", summary="Marketing accepts or returns mockup")
@router.post("/api/v1/sample-requests/{sample_id}/mockup/marketing-acceptance", summary="Marketing accepts or returns mockup (alias)")
def decide_mockup_marketing_acceptance(
    sample_id: int,
    body: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "marketing")
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")
    state = dict(record.mockup_workflow_state or {})
    previous_stage = str(state.get("stage") or "awaiting_marketing_acceptance")
    previous_status = record.status
    decision = str(body.get("decision") or "").strip().lower()
    remark = str(body.get("remark") or "").strip()
    is_direction_stage = previous_stage == "awaiting_marketing_direction"
    if is_direction_stage:
        if decision != "request_new_mockup":
            raise HTTPException(status_code=422, detail="Request a new mockup here, or close it from the request header")
    else:
        if previous_stage != "awaiting_marketing_acceptance":
            raise HTTPException(status_code=409, detail="This mockup is not awaiting Marketing acceptance")
        if decision not in {"accept", "request_revision"}:
            raise HTTPException(status_code=422, detail="Decision must be accept or request_revision")
        if decision == "request_revision" and not remark:
            raise HTTPException(status_code=422, detail="A revision note is required when returning the mockup")
    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Marketing")
    if "mockup" not in (record.request_types or []) and str(record.mockup_required or "").strip().casefold() != "yes":
        raise HTTPException(status_code=409, detail="This request has no Mockup scope")
    now = datetime.now(timezone.utc).isoformat()
    has_sampling = "sample" in (record.request_types or [])

    if decision == "accept":
        next_stage = "done"
        next_status = "Sampling Review (PMT)" if has_sampling else "Approved / Closed"
        workflow_status = "Approved / Closed"
        action = "MARKETING_ACCEPTED_MOCKUP"
        title = "Marketing accepted mockup; continuing to Sampling" if has_sampling else "Marketing accepted mockup; deliverable closed"
    elif decision == "request_revision":
        next_stage, next_status = "studio", "Studio Revision Requested"
        workflow_status = next_status
        action, title = "MARKETING_REQUESTED_STUDIO_REVISION", "Marketing requested a Studio revision"
    elif decision == "request_new_mockup":
        next_stage, next_status = "studio", "Studio"
        workflow_status = next_status
        action, title = "MARKETING_REQUESTED_NEW_MOCKUP", "Marketing requested a new mockup from Studio"
    state.update({"stage": next_stage, "marketingDecision": decision, "marketingDecisionAt": now})
    if decision == "accept":
        state["marketingAcceptedAt"] = now
        state.pop("marketingRevisionRemark", None)
        if has_sampling:
            routing = dict(state.get("samplingRouting") or {})
            routing.update({"stage": "sampling_review", "mockupAcceptedAt": now})
            state["samplingRouting"] = routing
        record.status = next_status
    elif decision == "request_revision":
        state["marketingRevisionRemark"] = remark
        state["studioRevisionRequestedAt"] = now
        record.status = next_status
    elif decision == "request_new_mockup":
        previous_outputs = list(state.get("mockupRevisionHistory") or [])
        if state.get("mockupUrl"):
            previous_outputs.append({
                "url": state.get("mockupUrl"),
                "submittedAt": state.get("submittedAt"),
                "submittedBy": state.get("submittedBy"),
                "archivedAt": now,
            })
        state["mockupRevisionHistory"] = previous_outputs[-20:]
        state["mockupRevisionNumber"] = int(state.get("mockupRevisionNumber") or 1) + 1
        state["mockupUrl"] = ""
        state.pop("submittedAt", None)
        state.pop("submittedBy", None)
        state["marketingRevisionRemark"] = remark or "Marketing requested a new mockup"
        state.pop("studioRevisionRejectRemark", None)
        record.status = next_status
    events = list(state.get("events") or [])
    events.append({
        "id": f"event-{uuid4().hex}",
        "action": action,
        "title": title,
        "actorName": actor,
        "actorDepartment": "Marketing",
        "timestamp": now,
        "remark": remark or None,
    })
    state["events"] = events[-100:]
    _clear_mockup_stage_claim(state)
    record.mockup_workflow_state = state
    record.updated_at = datetime.now(timezone.utc)
    _record_workflow_event(
        service.db, kind="mockup", record=record, user=current_user,
        action=action, from_stage=previous_stage, to_stage=next_stage,
        from_status=previous_status, to_status=workflow_status,
        details={"decision": decision, "remark": remark, "sample_scope_continues": has_sampling},
    )
    workflow = service.db.query(MockupWorkflow).filter(
        MockupWorkflow.sample_request_id == record.id
    ).with_for_update().first()
    if workflow:
        workflow.marketing_decision = decision
        workflow.marketing_decided_at = datetime.fromisoformat(now)
    service.db.commit()
    service.db.refresh(record)
    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/mockup/submit", summary="Submit Studio mockup link")
@router.post("/api/v1/sample-requests/{sample_id}/mockup/submit-studio", summary="Submit Studio mockup link (alias)")
@router.post("/api/v1/sample-requests/{sample_id}/studio-output", summary="Studio submits output link or file path")
def submit_studio_mockup(
    sample_id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")
    state = dict(record.mockup_workflow_state or {})
    previous_stage = str(state.get("stage") or "studio")
    previous_status = record.status
    _require_mockup_stage_claim(state, current_user, "studio")
    if previous_stage != "studio":
        raise HTTPException(status_code=409, detail="This request is not in Studio's Mockup queue")
    mockup_url = str(body.get("mockup_url") or body.get("mockupUrl") or "").strip()
    if not mockup_url:
        raise HTTPException(status_code=422, detail="Enter a valid mockup link or file path")

    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Studio Prepress").strip()[:100]
    now = datetime.now(timezone.utc).isoformat()
    is_sampling_variant = (
        set(record.request_types or []) == {"sample"}
        and bool((state.get("samplingRouting") or {}).get("creativeChangesRequired"))
    )
    if is_sampling_variant:
        next_stage = "creative_approval"
        next_status = "Creative Artwork Review"
    elif state.get("samplingReviewDecision") == "return":
        next_stage = "sampling_review"
        next_status = "Sampling Review (PMT)"
    else:
        next_stage = "awaiting_marketing_acceptance"
        next_status = "Awaiting Marketing Acceptance (Mockup)"
    state.update({
        "stage": next_stage,
        "mockupUrl": mockup_url,
        "submittedAt": now,
        "submittedBy": actor,
        "studioSubmittedAt": now,
        "studioSubmittedBy": actor,
    })
    if is_sampling_variant:
        routing = dict(state.get("samplingRouting") or {})
        routing.update({"stage": "creative_approval", "studioCompletedAt": now, "studioCompletedBy": actor})
        state["samplingRouting"] = routing
    elif next_stage == "sampling_review":
        state.pop("samplingReviewDecision", None)
        state.pop("samplingReviewRemark", None)
        state["samplingResubmittedAt"] = now
    _clear_mockup_stage_claim(state)
    record.status = next_status
    record.mockup_workflow_state = state
    record.updated_at = datetime.now(timezone.utc)
    _record_workflow_event(
        service.db, kind="mockup", record=record, user=current_user,
        action="STUDIO_RELEASED_MOCKUP_TO_REVIEW", from_stage=previous_stage, to_stage=next_stage,
        from_status=previous_status, to_status=record.status,
        details={"mockup_url": mockup_url},
    )
    service.db.commit()
    service.db.refresh(record)
    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/sampling/creative-artwork-decision", summary="Creative accepts or returns sample artwork")
def decide_sampling_creative_artwork(
    sample_id: int,
    body: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")
    state = dict(record.mockup_workflow_state or {})
    if set(record.request_types or []) != {"sample"} or not (state.get("samplingRouting") or {}).get("creativeChangesRequired"):
        raise HTTPException(status_code=409, detail="This request is not in the sample artwork approval flow")
    if state.get("stage") != "creative_approval":
        raise HTTPException(status_code=409, detail="This sample is not awaiting Creative artwork approval")
    _require_mockup_stage_claim(state, current_user, "creative_approval")
    decision = str(body.get("decision") or "").strip().lower()
    remark = str(body.get("remark") or "").strip()
    if decision not in {"accept", "request_revision"}:
        raise HTTPException(status_code=422, detail="Decision must be accept or request_revision")
    if decision == "request_revision" and not remark:
        raise HTTPException(status_code=422, detail="A revision note is required when returning artwork to Studio")
    previous_status = record.status
    now = datetime.now(timezone.utc).isoformat()
    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Creative Studio").strip()[:100]
    next_stage = "sampling_review" if decision == "accept" else "studio"
    next_status = "Sampling Review (PMT)" if decision == "accept" else "Studio Revision Requested (Sampling)"
    routing = dict(state.get("samplingRouting") or {})
    routing.update({"stage": next_stage, "creativeArtworkDecision": decision, "creativeArtworkDecisionAt": now})
    if decision == "request_revision":
        routing["studioRevisionRemark"] = remark
        routing["studioRevisionRequestedAt"] = now
    else:
        routing.pop("studioRevisionRemark", None)
    state["samplingRouting"] = routing
    state.update({"stage": next_stage, "creativeApprovalDecision": decision, "creativeApprovalActualAt": now})
    _clear_mockup_stage_claim(state)
    events = list(state.get("events") or [])
    events.append({
        "id": f"event-{uuid4().hex}",
        "action": "CREATIVE_ACCEPTED_SAMPLE_ARTWORK" if decision == "accept" else "CREATIVE_RETURNED_SAMPLE_ARTWORK",
        "title": "Creative approved artwork for Sampling" if decision == "accept" else "Creative returned artwork to Studio for revision",
        "actorName": actor,
        "actorDepartment": "Creative Studio",
        "timestamp": now,
        "remark": remark or None,
    })
    state["events"] = events[-100:]
    record.status = next_status
    record.mockup_workflow_state = state
    record.updated_at = datetime.now(timezone.utc)
    service.add_activity_log(record, action="CREATIVE_SAMPLE_ARTWORK_DECISION", actor_id=current_user.id,
        actor_name=actor, actor_department="Creative Studio", from_status=previous_status,
        to_status=next_status, payload={"decision": decision, "remark": remark})
    _record_workflow_event(service.db, kind="mockup", record=record, user=current_user,
        action="CREATIVE_SAMPLE_ARTWORK_DECISION", from_stage="creative_approval", to_stage=next_stage,
        from_status=previous_status, to_status=next_status, details={"decision": decision, "remark": remark})
    service.db.commit()
    service.db.refresh(record)
    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/release-to-plant", summary="Sampling releases an approved sample to Plant")
def release_sample_to_plant(
    sample_id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "samp")
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")
    state = dict(record.mockup_workflow_state or {})
    routing = dict(state.get("samplingRouting") or {})
    if "sample" not in (record.request_types or []):
        raise HTTPException(status_code=409, detail="Only a sample request can be released to Plant by Sampling")
    current_stage = str(state.get("stage") or "").strip()
    legacy_sampling_statuses = {"sampling review (pmt)", "sampling review", "sampling"}
    is_legacy_sampling_queue = not current_stage and str(record.status or "").strip().casefold() in legacy_sampling_statuses
    if current_stage != "sampling_review" and not is_legacy_sampling_queue:
        raise HTTPException(status_code=409, detail="This sample is not awaiting Sampling release")
    if state.get("claimedStage") == "sampling_review" and state.get("claimedByUserId") is not None:
        if str(state.get("claimedByUserId")) != str(getattr(current_user, "id", None)):
            raise HTTPException(status_code=409, detail=f"This task is claimed by {state.get('claimedBy') or 'another teammate'}")
    previous_status = record.status
    now = datetime.now(timezone.utc).isoformat()
    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Sampling").strip()[:100]
    target_plant = service.get_default_plant()
    if not target_plant:
        raise HTTPException(status_code=409, detail="The active Khaniwade plant is not configured")
    remark = str(body.get("sampling_remark") or body.get("samplingRemark") or "").strip()
    record.target_plant = target_plant
    state.update({"stage": "plant", "plantReleasedAt": now, "plantReleasedBy": actor, "plantReleaseTarget": target_plant})
    routing.update({"stage": "plant", "samplingReleasedAt": now, "samplingReleasedBy": actor})
    state["samplingRouting"] = routing
    _clear_mockup_stage_claim(state)
    events = list(state.get("events") or [])
    events.append({"id": f"event-{uuid4().hex}", "action": "SAMPLING_RELEASED_VARIANT_TO_PLANT",
        "title": f"Sampling released sample to {target_plant} Plant", "actorName": actor,
        "actorDepartment": "Sampling", "timestamp": now, "remark": remark or None})
    state["events"] = events[-100:]
    record.status = "Released to Plant"
    record.mockup_workflow_state = state
    record.updated_at = datetime.now(timezone.utc)
    service.add_activity_log(record, action="SAMPLING_RELEASED_VARIANT_TO_PLANT", actor_id=current_user.id,
        actor_name=actor, actor_department="Sampling", from_status=previous_status,
        to_status=record.status, payload={"target_plant": target_plant, "sampling_remark": remark})
    _record_workflow_event(service.db, kind="mockup", record=record, user=current_user,
        action="SAMPLING_RELEASED_VARIANT_TO_PLANT", from_stage="sampling_review", to_stage="plant",
        from_status=previous_status, to_status=record.status, details={"target_plant": target_plant, "sampling_remark": remark})
    service.db.commit()
    service.db.refresh(record)
    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/sampling-feedback", summary="Save Sampling operational remarks")
def save_sampling_feedback(
    sample_id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "samp")
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")
    state = dict(record.mockup_workflow_state or {})
    if state.get("claimedStage") == "sampling_review" and state.get("claimedByUserId") is not None:
        if str(state.get("claimedByUserId")) != str(getattr(current_user, "id", None)):
            raise HTTPException(status_code=409, detail=f"This task is claimed by {state.get('claimedBy') or 'another teammate'}")
    feedback = str(body.get("feedback") or body.get("sampling_remark") or "").strip()
    if not feedback:
        raise HTTPException(status_code=422, detail="Enter Sampling remarks before saving")
    now = datetime.now(timezone.utc).isoformat()
    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Sampling").strip()[:100]
    state.update({"samplingRemark": feedback, "samplingFeedback": feedback, "samplingFeedbackAt": now, "samplingFeedbackBy": actor})
    record.mockup_workflow_state = state
    record.updated_at = datetime.now(timezone.utc)
    service.add_activity_log(record, action="SAMPLING_REMARKS_SAVED", actor_id=current_user.id, actor_name=actor,
        actor_department="Sampling", from_status=record.status, to_status=record.status, payload={"feedback": feedback})
    service.db.commit()
    service.db.refresh(record)
    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/mockup/studio-revision-decision", summary="Studio cannot complete the requested Mockup revision")
def reject_studio_mockup_revision(
    sample_id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")
    state = dict(record.mockup_workflow_state or {})
    previous_stage, previous_status = str(state.get("stage") or ""), record.status
    active_revision_remark = state.get("marketingRevisionRemark") or state.get("samplingReviewRemark")
    if previous_stage != "studio" or not active_revision_remark:
        raise HTTPException(status_code=409, detail="This request has no active revision for Studio")
    _require_mockup_stage_claim(state, current_user, "studio")
    remark = str(body.get("remark") or "").strip()
    if not remark:
        raise HTTPException(status_code=422, detail="Explain why Studio cannot complete this revision")
    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Studio Prepress").strip()[:100]
    now = datetime.now(timezone.utc).isoformat()
    state.update({
        "stage": "awaiting_marketing_direction",
        "studioRevisionRejectRemark": remark,
        "studioRevisionRejectedAt": now,
        "studioRevisionRejectedBy": actor,
    })
    _clear_mockup_stage_claim(state)
    record.status = "Awaiting Marketing Direction (Mockup)"
    record.mockup_workflow_state = state
    record.updated_at = datetime.now(timezone.utc)
    events = list(state.get("events") or [])
    events.append({
        "id": f"event-{uuid4().hex}",
        "action": "STUDIO_CANNOT_COMPLETE_MOCKUP_REVISION",
        "title": "Studio cannot complete the requested revision",
        "actorName": actor,
        "actorDepartment": "Studio Prepress",
        "timestamp": now,
        "remark": remark,
    })
    state["events"] = events[-100:]
    record.mockup_workflow_state = state
    _record_workflow_event(
        service.db, kind="mockup", record=record, user=current_user,
        action="STUDIO_CANNOT_COMPLETE_MOCKUP_REVISION", from_stage=previous_stage,
        to_stage="awaiting_marketing_direction", from_status=previous_status,
        to_status=record.status, details={"remark": remark},
    )
    service.db.commit()
    service.db.refresh(record)
    return service.serialize(record)


# ---------------------------------------------------------------------------
# Design Requests Endpoints (/api/v1/design-requests)
# ---------------------------------------------------------------------------


@router.get("/api/v1/design-requests", response_model=List[Dict[str, Any]], summary="List creative design requests")
def list_design_requests(
    year: Optional[str] = Query(default=None),
    draft_only: bool = Query(default=False),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=5000, ge=1, le=5000),
    service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "creative_studio", "samp", "plant"))
    created_by_filter = None
    status_filter = None
    if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user):
        created_by_filter = current_user.id
    if user_has_team(current_user, "creative_studio") and not is_admin(current_user):
        status_filter = ["creative", "creative remaining requested", "creative studio", "target date counter proposed"]

    return service.list_all(
        year=year,
        draft_only=draft_only,
        created_by_user_id=created_by_filter,
        status_in=status_filter,
        offset=offset,
        limit=limit,
    )


@router.get("/api/v1/design-requests/{id}", summary="Get design request details")
def get_design_request(
    id: int,
    service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "creative_studio", "samp", "plant"))
    record = service.get_by_id(id)
    if not record:
        raise HTTPException(status_code=404, detail="Design request not found")
    _require_marketing_request_owner(record, current_user, "Design request not found")
    if user_has_team(current_user, "creative_studio") and not is_admin(current_user):
        visible_statuses = {"creative", "creative remaining requested", "creative studio", "target date counter proposed"}
        if str(record.get("status") or "").strip().casefold() not in visible_statuses:
            raise HTTPException(status_code=404, detail="Design request not found")
    return record


@router.post("/api/v1/design-requests", status_code=status.HTTP_201_CREATED, summary="Create a design request directly")
def create_design_request(
    payload: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    description = str(payload.get("product_description") or "").strip()
    customer = str(payload.get("customer_name") or "").strip()
    try:
        number_of_designs = int(payload.get("number_of_designs") or 0)
    except (TypeError, ValueError):
        number_of_designs = 0
    if not customer or not description:
        raise HTTPException(status_code=422, detail="Customer and product description are required")
    if not 1 <= number_of_designs <= 100:
        raise HTTPException(status_code=422, detail="Request between 1 and 100 designs")
    required_date = str(payload.get("design_required_date") or "").strip() or None
    if required_date:
        try:
            date.fromisoformat(required_date)
        except ValueError:
            raise HTTPException(status_code=422, detail="Design required date must use YYYY-MM-DD format")

    actor = _marketing_actor(current_user)
    created_date = datetime.now(timezone.utc).date().isoformat()
    sample_payload = {
        "customer": customer,
        "program_name": str(payload.get("program_name") or "").strip(),
        "program_year": str(payload.get("program_year") or "").strip(),
        "date_request_created": created_date,
        "created_by": actor,
        "created_by_user_id": current_user.id,
        "actor_user_id": current_user.id,
        "actor_name": actor,
        "actor_department": "Marketing",
        "request_types": ["design"],
        "status": "Draft (Pre-SMT)",
        "product_description": description,
        "number_of_designs": number_of_designs,
        "product_artwork_nos": str(number_of_designs),
        "designs_customer_creative": str(number_of_designs),
        "sample_required_date": required_date,
        "target_artwork_date_creative": required_date,
        "trend": str(payload.get("trend") or "").strip(),
        "target_audience": str(payload.get("target_audience") or "").strip(),
        "design_remarks": str(payload.get("design_remarks") or "").strip(),
        "reference_image": str(payload.get("reference_image") or "").strip(),
        "product_image_path": str(payload.get("reference_image") or "").strip(),
        "reference_images": payload.get("reference_images") if isinstance(payload.get("reference_images"), list) else [],
        "reference_links": payload.get("reference_links") if isinstance(payload.get("reference_links"), list) else [],
    }
    try:
        created_sample = sample_service.create(sample_payload, commit=False)
        sample_record = sample_service.repo.get_for_update(int(created_sample["id"]))
        if not sample_record:
            raise HTTPException(status_code=500, detail="Design request intake could not be linked")
        _initialize_scoped_workflows(sample_service.repo.db, sample_record, current_user)
        created_sample = sample_service.serialize(sample_record)
        service.sync_sample_request({**sample_payload, **created_sample}, commit=False)
        design_code = (created_sample.get("request_codes") or {}).get("design")
        created = service.get_by_request_code(design_code)
        if not created:
            raise HTTPException(status_code=500, detail="Design workflow could not be created")
        sample_service.repo.db.commit()
    except Exception:
        sample_service.repo.db.rollback()
        raise
    return {"success": True, "data": created, **created}


@router.patch("/api/v1/design-requests/{id}", summary="Update a Marketing Design draft")
def update_design_request(
    id: int,
    payload: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    if is_team_head(current_user):
        raise HTTPException(status_code=403, detail="Team heads have read-only access to operational workflows")
    item = (
        sample_service.repo.db.query(DesignRequest)
        .filter(DesignRequest.id == id)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Design request not found")
    if not str(item.status or "").casefold().startswith("draft"):
        raise HTTPException(status_code=409, detail="Only Marketing drafts can be edited")
    if not is_admin(current_user) and item.created_by_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Design request not found")

    try:
        count = int(payload.get("number_of_designs", item.number_of_designs))
    except (TypeError, ValueError):
        count = 0
    if not 1 <= count <= 100:
        raise HTTPException(status_code=422, detail="Request between 1 and 100 designs")
    required_date = payload.get("design_required_date", item.design_required_date)
    if required_date:
        try:
            date.fromisoformat(str(required_date).split("T")[0])
        except ValueError:
            raise HTTPException(status_code=422, detail="Design required date must use YYYY-MM-DD format")

    sample_record = _linked_sample_for_design(sample_service, item, for_update=True)
    if not sample_record:
        sample_record = _create_linked_sample_for_draft(item, sample_service, current_user)
    actor = _marketing_actor(current_user)
    updates = {
        "product_description": str(payload.get("product_description", item.product_description) or "").strip(),
        "product_artwork_nos": str(count),
        "designs_customer_creative": str(count),
        "target_artwork_date_creative": required_date or None,
        "sample_required_date": required_date or None,
        "reference_image": payload.get("reference_image", item.reference_image) or "",
        "product_image_path": payload.get("reference_image", item.reference_image) or "",
        "reference_images": payload.get("reference_images", item.reference_images or []),
        "reference_links": payload.get("reference_links", item.reference_links or []),
        "custom_details": [
            {"class_name": "Design", "characteristic_name": "TREND", "value": payload.get("trend", item.trend) or ""},
            {"class_name": "Design", "characteristic_name": "TARGET_AUDIENCE", "value": payload.get("target_audience", item.target_audience) or ""},
            {"class_name": "Design", "characteristic_name": "DESIGN_REMARKS", "value": payload.get("design_remarks", item.design_remarks) or ""},
        ],
        "actor_user_id": current_user.id,
        "actor_name": actor,
        "actor_department": "Marketing",
    }
    try:
        updated_sample = sample_service.update(sample_record.id, updates, commit=False)
        if not updated_sample:
            raise HTTPException(status_code=404, detail="Design request intake not found")
        service.sync_sample_request({**updated_sample, **updates}, commit=False)
        sample_service.repo.db.commit()
    except Exception:
        sample_service.repo.db.rollback()
        raise
    saved = service.get_by_id(id)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.delete("/api/v1/design-requests/{id}", summary="Delete a draft design request")
def delete_design_request(
    id: int,
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    if is_team_head(current_user):
        raise HTTPException(status_code=403, detail="Team heads have read-only access to operational workflows")
    item = (
        sample_service.repo.db.query(DesignRequest)
        .filter(DesignRequest.id == id)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Design request not found")
    if not str(item.status or "").casefold().startswith("draft"):
        raise HTTPException(status_code=409, detail="Only Marketing drafts can be deleted")
    if not is_admin(current_user) and item.created_by_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Design request not found")

    # If linked to a sample request, delete that sample draft if it exists and is draft
    if item.sample_request_id:
        linked_sample = sample_service.get_by_id(item.sample_request_id)
        if linked_sample and str(linked_sample.get("status") or "").casefold().startswith("draft"):
            sample_service.delete(item.sample_request_id)

    service.delete(id)
    return {"success": True, "message": "Draft design request deleted successfully"}



@router.post("/api/v1/design-requests/{id}/claim", summary="Claim a Creative design request")
def claim_design_request(
    id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    if not is_admin(current_user) and user_has_team(current_user, "marketing"):
        raise HTTPException(status_code=403, detail="Marketing team members cannot claim Creative Studio tasks.")
    require_team(current_user, "creative_studio")
    if is_team_head(current_user):
        raise HTTPException(status_code=403, detail="Team heads have read-only access to operational workflows")
    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Creative Designer").strip()[:100]

    def mutate(item: DesignRequest):
        if not _is_design_creative_stage(item):
            raise HTTPException(status_code=409, detail="This design request is not waiting for Creative work")
        state = dict(item.workflow_state or {})
        current_claim = str(state.get("claimedBy") or "")
        current_claim_id = state.get("claimedByUserId")
        if current_claim_id is not None and str(current_claim_id) != str(current_user.id):
            raise HTTPException(status_code=409, detail=f"This task is already claimed by {current_claim}")
        if current_claim_id is None:
            _require_design_claim_window(item, state)
            now = datetime.now(timezone.utc).isoformat()
            state.update({"claimedBy": actor, "claimedByUserId": current_user.id, "claimedAt": now})
            events = list(state.get("events") or [])
            events.insert(
                0,
                {
                    "id": f"event-{uuid4().hex}",
                    "actorName": actor,
                    "actorDepartment": "Creative Studio",
                    "action": "TASK_CLAIMED",
                    "title": "Task claimed by Creative",
                    "body": f"{actor} claimed ownership of this design request.",
                    "timestamp": now,
                    "isNote": False,
                    "badge": {"text": "Claimed", "variant": "purple"},
                },
            )
            state["events"] = events[:500]
            item.workflow_state = state

    saved = service.mutate(id, mutate, actor_user_id=current_user.id)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.delete("/api/v1/design-requests/{id}/claim", summary="Release claim")
def release_design_request_claim(
    id: int,
    service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    if not is_admin(current_user):
        raise HTTPException(
            status_code=403,
            detail="Once claimed, a task cannot be self-released. Please contact an administrator to reassign."
        )
    require_team(current_user, "creative_studio")
    if is_team_head(current_user):
        raise HTTPException(status_code=403, detail="Team heads have read-only access to operational workflows")
    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Creative Designer").strip()[:100]

    def mutate(item: DesignRequest):
        if not _is_design_creative_stage(item):
            raise HTTPException(status_code=409, detail="This design request is no longer in Creative work")
        state = dict(item.workflow_state or {})
        claim_id = state.get("claimedByUserId")
        if claim_id is None and not state.get("claimedBy"):
            raise HTTPException(status_code=409, detail="This design request is not claimed")
        previous_owner = str(state.get("claimedBy") or "the assigned designer")
        for key in ("claimedBy", "claimedByUserId", "claimedAt"):
            state.pop(key, None)
        events = list(state.get("events") or [])
        events.insert(
            0,
            {
                "id": f"event-{uuid4().hex}",
                "actorName": actor,
                "actorDepartment": "Creative Studio" if not is_admin(current_user) else "Administration",
                "action": "TASK_CLAIM_RELEASED",
                "title": "Creative claim released",
                "body": f"{actor} released the claim held by {previous_owner}. The request is available for another designer.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "isNote": False,
                "badge": {"text": "Claim Released", "variant": "amber"},
            },
        )
        state["events"] = events[:500]
        item.workflow_state = state

    saved = service.mutate(id, mutate, actor_user_id=current_user.id)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.post("/api/v1/design-requests/{id}/counter-date-proposal", summary="Propose a revised design target date")
def propose_design_counter_date(
    id: int,
    body: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    if is_team_head(current_user):
        raise HTTPException(status_code=403, detail="Team heads have read-only access to operational workflows")
    proposed_date = str(body.get("proposed_date") or "").strip()
    reason = str(body.get("reason") or "").strip()[:500]
    if not proposed_date or not reason:
        raise HTTPException(status_code=422, detail="Proposed date and reason are required")
    try:
        datetime.strptime(proposed_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail="Proposed date must use YYYY-MM-DD format")

    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Creative Designer"

    def mutate(item: DesignRequest):
        state = dict(item.workflow_state or {})
        if not _is_design_creative_stage(item):
            raise HTTPException(status_code=409, detail="This design request is not waiting for Creative work")
        _require_design_request_claim(state, current_user)
        _require_design_claim_window(item, state)
        if any(state.get(key) for key in ("isCounterDateActive", "counterDateRequestedAt", "proposedTargetDate", "counterDateDecision")):
            raise HTTPException(status_code=409, detail="A counter-date proposal has already been used for this request")
        now = datetime.now(timezone.utc).isoformat()
        state.update(
            {
                "isCounterDateActive": True,
                "proposedTargetDate": proposed_date,
                "counterDateReason": reason,
                "counterDateRequestedAt": now,
                "counterDateRequestedBy": actor,
                "counterDateDecision": "pending",
            }
        )
        events = list(state.get("events") or [])
        events.insert(
            0,
            {
                "id": f"event-{uuid4().hex}",
                "actorName": str(actor),
                "actorDepartment": "Creative Studio",
                "action": "COUNTER_DATE_PROPOSED",
                "title": "Revised target date proposed",
                "body": f"Proposed {proposed_date}. {reason}",
                "timestamp": now,
                "isNote": False,
                "badge": {"text": "Counter Date", "variant": "amber"},
            },
        )
        state["events"] = events[:500]
        item.workflow_state = state

    saved = service.mutate(id, mutate, actor_user_id=current_user.id)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.post("/api/v1/design-requests/{id}/counter-date-decision", summary="Accept or reject a revised design target date")
def decide_design_counter_date(
    id: int,
    body: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    decision = body.get("decision")
    if decision not in {"accepted", "rejected"}:
        raise HTTPException(status_code=422, detail="Decision must be accepted or rejected")
    accepted = decision == "accepted"
    notes = str(body.get("notes") or ("Accepted by Marketing" if accepted else "Rejected by Marketing.")).strip()[:1000]
    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Marketing"

    def mutate(item: DesignRequest):
        state = dict(item.workflow_state or {})
        if not state.get("isCounterDateActive") or state.get("counterDateDecision") != "pending":
            raise HTTPException(status_code=409, detail="There is no pending counter-date proposal to decide")
        proposed_date = state.get("proposedTargetDate")
        if accepted and proposed_date:
            item.design_required_date = proposed_date
            linked_sample = _linked_sample_for_design(sample_service, item)
            if linked_sample:
                linked_sample.target_artwork_date_creative = proposed_date
        state.update(
            {
                "isCounterDateActive": False,
                "counterDateDecision": decision,
                "counterDateDecisionAt": datetime.now(timezone.utc).isoformat(),
                "counterDateDecisionNotes": notes,
            }
        )
        events = list(state.get("events") or [])
        events.insert(
            0,
            {
                "id": f"event-{uuid4().hex}",
                "actorName": str(actor),
                "actorDepartment": "Marketing",
                "action": f"COUNTER_DATE_{decision.upper()}",
                "title": f"Counter date {decision}",
                "body": notes,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "isNote": False,
                "badge": {
                    "text": "Date Accepted" if accepted else "Date Retained",
                    "variant": "emerald" if accepted else "rose",
                },
            },
        )
        state["events"] = events[:500]
        item.workflow_state = state

    saved = service.mutate(id, mutate, actor_user_id=current_user.id)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


def _create_linked_sample_for_design(
    item: DesignRequest,
    sample_service: SampleRequestService,
    current_user: Any,
) -> CreateSampleRequest:
    """Repair legacy standalone Design rows before they enter Sampling follow-up."""
    created_date = datetime.now(timezone.utc).date().isoformat()
    actor = _marketing_actor(current_user)
    payload = {
        "customer": item.customer_name,
        "program_name": item.program_name or "",
        "program_year": item.program_year or "",
        "date_request_created": created_date,
        "created_by": actor,
        "created_by_user_id": current_user.id,
        "actor_user_id": current_user.id,
        "actor_name": actor,
        "actor_department": "Marketing",
        "target_plant": sample_service.get_default_plant(),
        "request_types": ["design"],
        "linked_request_codes": {"design": item.request_code},
        "status": "Approved / Closed",
        "product_description": item.product_description,
        "product_artwork_nos": str(item.number_of_designs or 1),
        "designs_customer_creative": str(item.number_of_designs or 1),
        "target_artwork_date_creative": item.design_required_date,
        "product_image_path": item.reference_image or "",
        "reference_images": item.reference_images or [],
        "reference_links": item.reference_links or [],
        "custom_details": [
            {"class_name": "Design", "characteristic_name": "TREND", "value": item.trend or ""},
            {"class_name": "Design", "characteristic_name": "TARGET_AUDIENCE", "value": item.target_audience or ""},
            {"class_name": "Design", "characteristic_name": "DESIGN_REMARKS", "value": item.design_remarks or ""},
        ],
    }
    created = sample_service.create(payload, commit=False)
    record = sample_service.repo.get_for_update(int(created["id"]))
    if not record:
        raise HTTPException(status_code=500, detail="Could not create the linked intake record for Sampling")
    item.sample_request_id = record.id
    return record


def _create_linked_sample_for_draft(
    item: DesignRequest,
    sample_service: SampleRequestService,
    current_user: Any,
) -> CreateSampleRequest:
    """Repair a legacy standalone Design draft before editing its canonical intake."""
    actor = _marketing_actor(current_user)
    created_at = item.created_at or datetime.now(timezone.utc)
    payload = {
        "customer": item.customer_name,
        "program_name": item.program_name or "",
        "program_year": item.program_year or "",
        "date_request_created": created_at.date().isoformat(),
        "created_by": item.created_by or actor,
        "created_by_user_id": item.created_by_user_id or current_user.id,
        "actor_user_id": current_user.id,
        "actor_name": actor,
        "actor_department": "Marketing",
        "request_types": ["design"],
        "linked_request_codes": {"design": item.request_code},
        "status": item.status or "Draft (Pre-SMT)",
        "product_description": item.product_description or "",
        "number_of_designs": item.number_of_designs or 1,
        "product_artwork_nos": str(item.number_of_designs or 1),
        "designs_customer_creative": str(item.number_of_designs or 1),
        "sample_required_date": item.design_required_date,
        "target_artwork_date_creative": item.design_required_date,
        "trend": item.trend or "",
        "target_audience": item.target_audience or "",
        "design_remarks": item.design_remarks or "",
        "reference_image": item.reference_image or "",
        "product_image_path": item.reference_image or "",
        "reference_images": item.reference_images or [],
        "reference_links": item.reference_links or [],
    }
    created = sample_service.create(payload, commit=False)
    record = sample_service.repo.get_for_update(int(created["id"]))
    if not record:
        raise HTTPException(status_code=500, detail="Could not create the linked Design draft intake")
    _initialize_scoped_workflows(sample_service.repo.db, record, current_user)
    item.sample_request_id = record.id
    return record


@router.post("/api/v1/design-requests/{id}/notes", summary="Add a design workflow note")
def add_design_workflow_note(
    id: int,
    body: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp", "plant", "creative_studio"))
    note_text = str(body.get("body") or "").strip()
    if not note_text or len(note_text) > 2000:
        raise HTTPException(status_code=422, detail="Note text is required (max 2000 chars)")
    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "User"
    department = _actor_team_label(current_user)

    note = {
        "id": f"note-{uuid4().hex}",
        "actorName": actor,
        "actorDepartment": department,
        "action": "NOTE_POSTED",
        "title": "Internal Note",
        "body": note_text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "isNote": True,
        "badge": {"text": "Note", "variant": "neutral"},
    }

    def mutate(item: DesignRequest):
        state = dict(item.workflow_state or {})
        state["notes"] = [note, *(state.get("notes") or [])][:500]
        item.workflow_state = state

    saved = service.mutate(id, mutate, actor_user_id=current_user.id)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.post("/api/v1/design-requests/{id}/release", summary="Release a design request to Creative")
def release_design_request(
    id: int,
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Marketing"

    def mutate(item: DesignRequest):
        now = datetime.now(timezone.utc).isoformat()
        state = dict(item.workflow_state or {})
        state["releasedAt"] = state.get("releasedAt") or now
        events = list(state.get("events") or [])
        events.insert(
            0,
            {
                "id": f"event-{uuid4().hex}",
                "actorName": str(actor),
                "actorDepartment": "Marketing",
                "action": "REQUEST_RELEASED",
                "title": "Released from Marketing Draft",
                "body": "Marketing released this design request from the pre-SMT draft queue to Creative.",
                "timestamp": now,
                "isNote": False,
                "badge": {"text": "Released", "variant": "emerald"},
            },
        )
        state["events"] = events[:500]
        item.workflow_state = state
        item.status = "Creative"
        linked_sample = _linked_sample_for_design(sample_service, item)
        if linked_sample:
            linked_sample.status = "Creative"

    saved = service.mutate(id, mutate, actor_user_id=current_user.id)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.put("/api/v1/design-requests/{id}/creative-output", summary="Submit Creative design output")
def submit_creative_design_output(
    id: int,
    body: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    if is_team_head(current_user):
        raise HTTPException(status_code=403, detail="Team heads have read-only access to operational workflows")
    file_url = str(body.get("design_file_url") or "").strip()
    rows = body.get("rows")
    if not file_url:
        raise HTTPException(status_code=422, detail="Add an artwork link, path, or reference text")
    if len(file_url) > 4000:
        raise HTTPException(status_code=422, detail="Artwork link or path cannot exceed 4,000 characters")
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=422, detail="Add at least one completed design")

    raw_rows = []
    for row in rows:
        if not isinstance(row, dict):
            raise HTTPException(status_code=422, detail="Each artwork row must be an object")
        shutterstock_no = str(row.get("shutterstock_no") or row.get("shutterstockNo") or "").strip()
        remarks = str(row.get("remarks") or "").strip()[:1000]
        if not shutterstock_no and not remarks:
            raise HTTPException(status_code=422, detail="Each artwork needs a Shutterstock number or remark")
        raw_rows.append({"shutterstock_no": shutterstock_no, "remarks": remarks})

    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Creative Designer"

    def mutate(item: DesignRequest):
        if not _is_design_creative_stage(item):
            raise HTTPException(status_code=409, detail="This design request is not waiting for Creative work")
        state = dict(item.workflow_state or {})
        _require_design_request_claim(state, current_user)
        submissions = list(item.creative_submissions or [])
        delivered_before = sum(len(batch.get("rows") or []) for batch in submissions if isinstance(batch, dict))
        requested = int(item.number_of_designs or 0)
        remaining = max(0, requested - delivered_before)
        if not remaining:
            raise HTTPException(status_code=409, detail="All requested artwork has already been submitted")
        if len(raw_rows) > remaining:
            raise HTTPException(status_code=422, detail=f"Submit no more than the {remaining} remaining artwork(s)")

        normalized_rows = []
        for offset, row in enumerate(raw_rows):
            design_number = f"D{delivered_before + offset + 1}"
            marketing_desc = str(item.product_description or "").strip()
            normalized_rows.append(
                {
                    "design_number": design_number,
                    "description": f"{marketing_desc} - {design_number}",
                    **row,
                }
            )

        submissions.append(
            {
                "submitted_at": datetime.now(timezone.utc).isoformat(),
                "design_file_url": file_url,
                "rows": normalized_rows,
            }
        )
        item.creative_submissions = submissions
        delivered = delivered_before + len(normalized_rows)
        remaining_after = max(0, requested - delivered)
        item.remaining_design_count = remaining_after

        item.marketing_decision = "awaiting_marketing_review"
        item.status = "Awaiting Marketing Review"

        events = list(state.get("events") or [])
        events.insert(
            0,
            {
                "id": f"event-{uuid4().hex}",
                "actorName": str(actor),
                "actorDepartment": "Creative Studio",
                "action": "DELIVERABLE_SUBMITTED",
                "title": "Artwork submitted to Marketing",
                "body": f"{len(normalized_rows)} artwork(s) submitted for review.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "isNote": False,
                "badge": {"text": "Submitted", "variant": "teal"},
            },
        )
        state["events"] = events[:500]
        for key in ("claimedBy", "claimedByUserId", "claimedAt"):
            state.pop(key, None)
        item.workflow_state = state

        linked_sample = _linked_sample_for_design(sample_service, item)
        if linked_sample:
            linked_sample.status = item.status

    saved = service.mutate(id, mutate, actor_user_id=current_user.id)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.post("/api/v1/design-requests/{id}/marketing-decision", summary="Accept design output or request remaining designs")
def marketing_design_decision(
    id: int,
    body: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    decision = body.get("decision")
    if decision not in {"accept", "request_remaining"}:
        raise HTTPException(status_code=422, detail="Decision must be accept or request_remaining")
    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Marketing"

    def mutate(item: DesignRequest):
        status_value = str(item.status or "").casefold()
        if (
            item.marketing_decision != "awaiting_marketing_review"
            and "awaiting marketing review" not in status_value
        ):
            raise HTTPException(status_code=409, detail="This design request is not awaiting Marketing review")
        if not any(isinstance(batch, dict) and batch.get("rows") for batch in (item.creative_submissions or [])):
            raise HTTPException(status_code=409, detail="Creative has not submitted any artwork for review")
        remaining = max(0, int(item.number_of_designs or 0) - sum(
            len(batch.get("rows") or []) for batch in (item.creative_submissions or []) if isinstance(batch, dict)
        ))
        if decision == "request_remaining" and remaining == 0:
            raise HTTPException(status_code=409, detail="All requested artwork has already been submitted")
        if decision == "accept":
            item.marketing_decision = "accepted"
            item.status = "Approved / Closed"
            item.remaining_design_count = 0
            title = "Artwork approved and closed"
            body_text = "Marketing accepted the submitted artwork."
            badge = "Accepted"
            variant = "emerald"
        else:
            item.marketing_decision = "remaining_requested"
            item.status = "Creative Remaining Requested"
            item.remaining_design_count = remaining
            title = "Remaining artwork requested"
            body_text = f"Marketing returned {remaining} artwork(s) to Creative for completion."
            badge = "Revisions"
            variant = "amber"

        state = dict(item.workflow_state or {})
        events = list(state.get("events") or [])
        events.insert(
            0,
            {
                "id": f"event-{uuid4().hex}",
                "actorName": str(actor),
                "actorDepartment": "Marketing",
                "action": "MARKETING_DECISION",
                "title": title,
                "body": body_text,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "isNote": False,
                "badge": {"text": badge, "variant": variant},
            },
        )
        state["events"] = events[:500]
        for key in ("claimedBy", "claimedByUserId", "claimedAt"):
            state.pop(key, None)
        item.workflow_state = state

        linked_sample = _linked_sample_for_design(sample_service, item)
        if linked_sample:
            linked_sample.status = item.status

    saved = service.mutate(id, mutate, actor_user_id=current_user.id)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.post("/api/v1/design-requests/{id}/request-followup", summary="Add Mockup or Sampling to an accepted design request")
def request_post_design_deliverables(
    id: int,
    body: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    raw_deliverables = body.get("deliverables")
    if not isinstance(raw_deliverables, list):
        raise HTTPException(status_code=422, detail="Choose Mockup, Sampling, or both")
    deliverables = list(dict.fromkeys(str(v).strip().lower() for v in raw_deliverables if v))
    if not deliverables or any(value not in {"mockup", "sample"} for value in deliverables):
        raise HTTPException(status_code=422, detail="Choose Mockup, Sampling, or both")

    raw_design_selections = body.get("design_selections")
    if not isinstance(raw_design_selections, dict):
        raise HTTPException(status_code=422, detail="Select at least one accepted design for each follow-up")
    design_numbers_by_scope: Dict[str, List[str]] = {}
    for scope in deliverables:
        raw_numbers = raw_design_selections.get(scope)
        if not isinstance(raw_numbers, list):
            raise HTTPException(status_code=422, detail=f"Select designs for {scope}")
        design_numbers = list(dict.fromkeys(str(value).strip() for value in raw_numbers if value))
        if not design_numbers:
            raise HTTPException(status_code=422, detail=f"Select at least one design for {scope}")
        design_numbers_by_scope[scope] = design_numbers

    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Marketing")

    def mutate(item: DesignRequest):
        if item.marketing_decision != "accepted":
            raise HTTPException(status_code=409, detail="Accept the submitted artwork before requesting Mockup or Sampling")
        sample = _linked_sample_for_design(sample_service, item, for_update=True)
        if not sample and "sample" in deliverables:
            sample = _create_linked_sample_for_design(item, sample_service, current_user)

        available_designs: Dict[str, Dict[str, Any]] = {}
        for batch in item.creative_submissions or []:
            if not isinstance(batch, dict):
                continue
            for row in batch.get("rows") or []:
                if not isinstance(row, dict):
                    continue
                design_number = str(row.get("design_number") or row.get("designNumber") or "").strip()
                if design_number:
                    available_designs[design_number] = {
                        "designNumber": design_number,
                        "description": str(row.get("description") or ""),
                        "shutterstockNo": str(row.get("shutterstock_no") or row.get("shutterstockNo") or ""),
                        "remarks": str(row.get("remarks") or ""),
                        "designFileUrl": str(batch.get("design_file_url") or batch.get("designFileUrl") or ""),
                        "submittedAt": str(batch.get("submitted_at") or batch.get("submittedAt") or ""),
                    }

        selected_designs_by_scope: Dict[str, List[Dict[str, Any]]] = {}
        for scope, design_numbers in design_numbers_by_scope.items():
            unavailable = [number for number in design_numbers if number not in available_designs]
            if unavailable:
                raise HTTPException(
                    status_code=422,
                    detail=f"One or more selected {scope} designs are no longer available. Refresh and choose again.",
                )
            selected_designs_by_scope[scope] = [available_designs[number] for number in design_numbers]

        requested_at = datetime.now(timezone.utc).isoformat()
        if "sample" in deliverables:
            if not sample:
                raise HTTPException(status_code=409, detail="Could not link this Design Request to a Sample intake record")
            current_types = list(sample.request_types or [])
            if "sample" not in current_types:
                current_types.append("sample")
            sample.request_types = current_types
            type_audit = sample.request_type_audit
            if type_audit is None:
                type_audit = SampleRequestType(sample_request_id=sample.id)
                sample.request_type_audit = type_audit
            if not type_audit.sample:
                type_audit.sample = True
                type_audit.sample_selected_at = datetime.now(timezone.utc)
            if not sample.sr_number:
                sample_service._reserve_sr_number(sample)
            sample.status = "Sampling Review (PMT)"
            sample.material_code = item.request_code
            sample_state = dict(sample.mockup_workflow_state or {})
            sampling_routing = dict(sample_state.get("samplingRouting") or {})
            sampling_routing["stage"] = "sampling_review"
            sample_state["samplingRouting"] = sampling_routing
            design_followups = dict(sample_state.get("designFollowups") or {})
            design_followups["sample"] = {
                "designs": selected_designs_by_scope["sample"],
                "requestedAt": requested_at,
                "requestedBy": actor,
            }
            sample_state["designFollowups"] = design_followups
            sample.mockup_workflow_state = sample_state
            _initialize_scoped_workflows(sample_service.repo.db, sample, current_user)

        mockup_request_ids: List[int] = []
        if "mockup" in deliverables:
            selected_mockups = selected_designs_by_scope["mockup"]
            required_date_value = str(body.get("mockup_required_date") or "").strip()
            raw_request_ids = body.get("mockup_request_ids")
            if not isinstance(raw_request_ids, list):
                raise HTTPException(status_code=422, detail="Save each selected Mockup design through Product Staging before release")
            try:
                required_date_value = date.fromisoformat(required_date_value.split("T")[0]).isoformat()
            except (ValueError, TypeError):
                raise HTTPException(status_code=422, detail="Choose a valid Mockup required date")
            mockup_request_ids = list(dict.fromkeys(int(value) for value in raw_request_ids if str(value).isdigit()))
            if len(mockup_request_ids) != len(selected_mockups):
                raise HTTPException(status_code=422, detail="Each selected design needs its own saved Mockup request")
            mockup_records = sample_service.repo.db.query(CreateSampleRequest).filter(
                CreateSampleRequest.id.in_(mockup_request_ids)
            ).all()
            if len(mockup_records) != len(mockup_request_ids):
                raise HTTPException(status_code=404, detail="One or more staged Mockup requests could not be found")
            record_by_design: Dict[str, CreateSampleRequest] = {}
            for mockup_record in mockup_records:
                if mockup_record.created_by_user_id != getattr(current_user, "id", None):
                    raise HTTPException(status_code=404, detail="One or more staged Mockup requests could not be found")
                if list(mockup_record.request_types or []) != ["mockup"]:
                    raise HTTPException(status_code=422, detail="Only standalone Mockup requests can be released from this handoff")
                if str(mockup_record.creation_mode or "").strip().lower() not in {"material_code", "binding"}:
                    raise HTTPException(status_code=422, detail="Choose an existing Material Code or Binding product in Product Staging")
                source_material_code = str(mockup_record.source_sample_code or "").strip()
                # Standalone Mockup rows do not receive a material_code: that
                # field is reserved for the Sample request number/code. The
                # selected catalog product is persisted in source_sample_code.
                if not source_material_code:
                    raise HTTPException(status_code=422, detail="Each Mockup request must include its selected product Material Code")
                source_product = sample_service.repo.db.query(CreateSampleRequest).filter(
                    func.trim(CreateSampleRequest.material_code) == source_material_code,
                    CreateSampleRequest.id != mockup_record.id,
                ).first()
                if not source_product:
                    raise HTTPException(status_code=422, detail="Select a valid catalog product in Product Staging for each Mockup request")
                workflow_data = dict(mockup_record.mockup_workflow_state or {})
                followups = dict(workflow_data.get("designFollowups") or {})
                mockup_selection = dict(followups.get("mockup") or {})
                if not str(workflow_data.get("marketingShutterstockNo") or "").strip() and not str(workflow_data.get("marketingRemark") or "").strip():
                    raise HTTPException(status_code=422, detail="Each Mockup request needs a Shutterstock number or Creative remark")
                if str(workflow_data.get("requiredDate") or "").split("T")[0] != required_date_value:
                    raise HTTPException(status_code=422, detail="Staged Mockup required dates do not match")
                designs = mockup_selection.get("designs") or []
                design_number = str(designs[0].get("designNumber") or "") if len(designs) == 1 and isinstance(designs[0], dict) else ""
                if not design_number or design_number in record_by_design:
                    raise HTTPException(status_code=422, detail="Each staged request must contain one unique design number")
                record_by_design[design_number] = mockup_record
            if set(record_by_design) != {str(design["designNumber"]) for design in selected_mockups}:
                raise HTTPException(status_code=422, detail="Staged Mockup requests do not match the selected designs")

            for artwork in selected_mockups:
                mockup_record = record_by_design[str(artwork["designNumber"])]
                before_status = str(mockup_record.status or "Draft (Pre-SMT)")
                workflow_data = dict(mockup_record.mockup_workflow_state or {})
                stock_number = str(artwork.get("shutterstockNo") or "").strip()
                creative_remark = str(artwork.get("remarks") or "").strip()
                if not stock_number and not creative_remark:
                    raise HTTPException(status_code=422, detail="Each selected design needs a Shutterstock number or Creative remark")
                workflow_data["stage"] = "studio"
                workflow_data["designNeeded"] = False
                workflow_data["creativeBypassed"] = True
                workflow_data["marketingShutterstockNo"] = stock_number
                workflow_data["marketingRemark"] = creative_remark
                workflow_data["creativeShutterstockNo"] = stock_number
                workflow_data["creativeRemark"] = creative_remark
                workflow_data["designRequestId"] = item.id
                workflow_data["requiredDate"] = required_date_value
                mockup_record.mockup_workflow_state = workflow_data
                mockup_record.status = "Studio"
                workflow = sample_service.repo.db.query(MockupWorkflow).filter(
                    MockupWorkflow.sample_request_id == mockup_record.id
                ).with_for_update().first()
                if not workflow or workflow.current_stage != "studio" or before_status != "Studio":
                    _record_workflow_event(
                        sample_service.repo.db,
                        kind="mockup",
                        record=mockup_record,
                        user=current_user,
                        action="MARKETING_SUBMITTED_TO_STUDIO",
                        from_stage=workflow.current_stage if workflow else "marketing",
                        to_stage="studio",
                        from_status=before_status,
                        to_status="Studio",
                        details={"design_number": artwork["designNumber"], "design_request_id": item.id},
                    )

        state = dict(item.workflow_state or {})
        followup_requests = dict(state.get("followupRequests") or {})
        for scope in deliverables:
            followup_requests[scope] = {
                "designs": selected_designs_by_scope[scope],
                "requestedAt": requested_at,
                "requestedBy": actor,
                "status": "completed",
                **({"requestIds": mockup_request_ids} if scope == "mockup" else {}),
            }
        state["followupRequests"] = followup_requests
        events = list(state.get("events") or [])
        selection_summary = "; ".join(
            f"{scope.title()}: {', '.join(design['designNumber'] for design in selected_designs)}"
            for scope, selected_designs in selected_designs_by_scope.items()
        )
        events.insert(
            0,
            {
                "id": f"event-{uuid4().hex}",
                "actorName": actor,
                "actorDepartment": "Marketing",
                "action": "FOLLOWUP_REQUESTED",
                "title": f"Follow-up work completed: {', '.join(deliverables)}",
                "body": f"Completed {', '.join(deliverables)} for design request {item.request_code}. {selection_summary}.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "isNote": False,
                "badge": {"text": "Follow-up", "variant": "purple"},
                "designSelections": selected_designs_by_scope,
            },
        )
        state["events"] = events[:500]
        item.workflow_state = state

    saved = service.mutate(id, mutate, actor_user_id=current_user.id)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.post("/api/v1/sample-requests/{sample_id}/design-brief", summary="Submit a design-only brief to Creative")
def submit_design_brief(
    sample_id: int,
    body: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "marketing")
    sample_record = service.repo.get_by_id(sample_id)
    if not sample_record or (not is_admin(current_user) and not is_team_head(current_user) and getattr(sample_record, "created_by_user_id", None) != current_user.id):
        raise HTTPException(status_code=404, detail="Sample request not found")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    description = str(body.get("product_description") or "").strip()
    count = body.get("number_of_designs")
    if not description:
        raise HTTPException(status_code=422, detail="Product description is required")
    try:
        count = int(count)
    except (TypeError, ValueError):
        count = 0
    if not 1 <= count <= 100:
        raise HTTPException(status_code=422, detail="Request between 1 and 100 designs")
    required_date = body.get("design_required_date") or None
    if required_date:
        try:
            datetime.strptime(str(required_date), "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=422, detail="Design required date must use YYYY-MM-DD format")

    request_types = list(sample_record.request_types or [])
    if "design" not in request_types:
        request_types.append("design")
    sample_record.request_types = request_types
    design_code = service._reserve_scope_code(sample_record, "design")
    existing_design = design_service.get_by_request_code(design_code)
    if not existing_design and sample_record.sr_number:
        existing_design = design_service.get_by_sr_number(sample_record.sr_number)
    if existing_design and not str(existing_design.get("status") or "").lower().startswith("draft"):
        raise HTTPException(status_code=409, detail="This design request has already left Draft")

    sample_record.status = "Creative"
    sample_record.product_description = description
    sample_record.product_artwork_nos = count
    sample_record.target_artwork_date_creative = required_date
    service.repo.db.commit()
    service.repo.db.refresh(sample_record)

    serialized = service.serialize(sample_record)
    design_service.sync_sample_request(serialized)
    record = design_service.get_by_request_code(design_code)
    if not record and sample_record.sr_number:
        record = design_service.get_by_sr_number(sample_record.sr_number)
    if not record:
        raise HTTPException(status_code=500, detail="Design request could not be created")

    def mutate_design(item: DesignRequest):
        item.status = "Creative"
        item.number_of_designs = count
        item.trend = body.get("trend") or None
        item.target_audience = body.get("target_audience") or None
        item.product_description = description
        item.design_required_date = required_date
        item.reference_image = body.get("reference_image") or None
        item.reference_images = body.get("reference_images") or []
        item.reference_links = body.get("reference_links") or []
        item.design_remarks = body.get("design_remarks") or None
        item.marketing_decision = None
        item.remaining_design_count = count
        item.creative_submissions = []

    record = design_service.mutate(record["id"], mutate_design, actor_user_id=current_user.id)
    return {"success": True, "data": record}


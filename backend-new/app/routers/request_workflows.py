"""Dedicated Costing and Mockup workflow APIs with append-only audit history."""

import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, String
from sqlalchemy.orm import Session

from app.auth.permissions import is_team_head, require_any_team, require_team, user_has_team
from app.auth.security import get_current_user
from app.database import get_db
from app.models.request_workflows import (
    CostingWorkflow,
    CostingWorkflowLog,
    MockupWorkflow,
    MockupWorkflowLog,
)
from app.models.sample_request import CreateSampleRequest, DesignRequest, ProductCharacteristic, ProductDetail
from app.routers.sample_requests import decide_mockup_marketing_acceptance
from app.services.sample_request_service import SampleRequestService
from app.utils.business_year import get_business_year_date_range
from app.utils.operational_workdays import india_operational_deadline

router = APIRouter(tags=["Costing & Mockup Workflows"])


def _now():
    return datetime.now(timezone.utc)


def _team(user) -> str:
    for key, label in (("marketing", "Marketing"), ("creative_studio", "Creative"),
                       ("costing", "Costing"), ("samp", "Sampling")):
        if user_has_team(user, key):
            return label
    return "Administrator"


def _actor(user) -> str:
    return str(getattr(user, "name", None) or getattr(user, "userid", None) or "User")[:255]


def _require_claim(state: Dict[str, Any], user, expected_stage: str) -> None:
    if str(state.get("claimedStage") or "") != expected_stage or state.get("claimedByUserId") is None:
        raise HTTPException(status_code=409, detail="Claim this task before continuing")
    if str(state.get("claimedByUserId")) != str(getattr(user, "id", None)):
        raise HTTPException(status_code=409, detail=f"This task is claimed by {state.get('claimedBy') or 'another teammate'}")


def _clear_claim(state: Dict[str, Any]) -> None:
    for key in ("claimedBy", "claimedByUserId", "claimedAt", "claimedStage"):
        state.pop(key, None)


def _snapshot(request: CreateSampleRequest) -> Dict[str, Any]:
    return {
        "customer": request.customer,
        "brand_name": request.brand_name,
        "customer_product_code": request.customer_product_code,
        "barcode": request.barcode,
        "unit_pc_pack": request.unit_pc_pack,
        "qty_per_pack": request.qty_per_pack,
        "quantity": request.qty_design_costing,
        "required_date": request.costing_required_date,
        "costing_creative_input_needed": bool(request.costing_creative_input_needed),
        "costing_creative_input_remark": request.costing_creative_input_remark,
        "material_code": request.material_code,
        "product_description": request.product_description,
        "category": request.product_category,
        "sub_category": request.product_sub_category,
        "third_category": request.product_third_category,
        "request_types": request.request_types or [],
    }


def _validate_mockup_intake(request: CreateSampleRequest) -> None:
    state = request.mockup_workflow_state if isinstance(request.mockup_workflow_state, dict) else {}
    if not str(state.get("requiredDate") or "").strip():
        raise HTTPException(status_code=422, detail="Mockup required date is mandatory")
    quantity = str(state.get("qtyForMockup") or "").strip()
    if not quantity.isdigit() or int(quantity) < 1:
        raise HTTPException(status_code=422, detail="Mockup quantity must be a whole number greater than zero")
    design_needed = state.get("designNeeded")
    if isinstance(design_needed, str):
        normalized = design_needed.strip().casefold()
        design_needed = True if normalized in {"yes", "true", "1"} else False if normalized in {"no", "false", "0"} else None
    if not isinstance(design_needed, bool):
        raise HTTPException(status_code=422, detail="Choose whether a new design is needed")
    if design_needed and not str(state.get("marketingShutterstockNo") or "").strip() and not str(state.get("marketingRemark") or "").strip():
        raise HTTPException(status_code=422, detail="Enter a Shutterstock number or remark when design is needed")


def _normalized_spec_name(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").casefold()).upper()


def _is_creative_spec(class_name: str, characteristic_name: str) -> bool:
    class_key = _normalized_spec_name(class_name)
    field = _normalized_spec_name(characteristic_name)
    binding_fields = {
        "BINDINGCOLORSTYLE", "EDGEFINISHINGNOOFDESIGN", "EDGEFINISHINGNOOFDESIGNS",
        "EDGEFINISHINNOOFDESIGN", "EDGEFINISHINGDESIGNNOTES", "ACCESSORIESDETAIL",
        "ACCESSORIESDETAILS", "ACCESSORIEESDETAIL",
    }
    divider_fields = {
        "NOOFDESIGNPRINT", "NOOFDESIGNSPRINT", "NOOFCOLORB", "NOOFCOLORSFB",
        "NOOFCOLOURSFB", "NAMEOFCOLORB", "NAMEOFCOLORSFB", "PRINTINGFINISH",
        "PRINTFINISHING", "D2NAMEOFCOLORB", "D2PRINTINGFINISH",
    }
    if class_key.startswith("NBBINDING"):
        return field in binding_fields
    if class_key in {"NBDIVIDERSPEC", "NBDIVIDERSPECS", "NBDIVIDINGSPEC", "NBDIVIDINGSPECS"}:
        return field in divider_fields or field.removeprefix("D1").removeprefix("D2") in divider_fields
    if class_key.startswith("PACKAGINGSPEC"):
        return field in {"NOOFCOLOURSFB", "NAMEOFCOLORSFB2"}
    if class_key in {"PACKINGDETAIL", "PACKINGDETAILS", "PACKAGINGDETAIL", "PACKAGINGDETAILS"}:
        return field in {
            "NAMEOFCOLOR", "NAMEOFCOLORFB", "NAMEOFCOLORFB2", "DESIGNCOLORASSORTMENT",
            "SPECIALINSTRUCTION", "SPECIALINSTRUCTIONS", "DESIGNCOLORASSORTMENT2",
        }
    component = re.fullmatch(r"(?:NB)?COMPONENT([1-6])", class_key)
    if component:
        suffix = re.sub(rf"^C?{component.group(1)}", "", field)
        return suffix in {
            "NAMEOFCOLORSFB1", "NAMEOFCOLORFB1", "NAMEOFCOLORB1",
            "RULLINGPRINTINGDESIGNNAME1", "RULINGPRINTINGDESIGNNAME1", "RULINGPRINTDESIGNNAME1",
            "NAMEOFCOLORSFB", "NAMEOFCOLORFB", "NAMEOFCOLORB",
            "RULLINGPRINTINGDESIGNNAME2", "RULINGPRINTINGDESIGNNAME2", "RULINGPRINTDESIGNNAME2",
        }
    return False


def _validate_creative_costing_specs(db, sample_request_id: int) -> int:
    class_names = [
        row[0] for row in db.query(ProductDetail.class_name)
        .filter(ProductDetail.sample_request_id == sample_request_id)
        .distinct().all()
    ]
    if not class_names:
        return 0

    characteristics = db.query(ProductCharacteristic).filter(
        func.upper(ProductCharacteristic.class_name).in_([name.upper() for name in class_names]),
        ProductCharacteristic.is_active.is_(True),
    ).all()
    creative_fields = [item for item in characteristics if _is_creative_spec(item.class_name, item.characteristic_name)]
    if not creative_fields:
        return len(class_names)

    values = {
        (item.class_name.casefold(), item.characteristic_name.casefold()): item.value
        for item in db.query(ProductDetail).filter(ProductDetail.sample_request_id == sample_request_id).all()
    }
    missing = [
        f"{item.class_name}: {item.characteristic_name}"
        for item in creative_fields
        if str(values.get((item.class_name.casefold(), item.characteristic_name.casefold())) or "").strip().casefold()
        in {"", "na", "n/a", "nan", "null", "none", "-", "—"}
    ]
    if missing:
        sample = ", ".join(missing[:3])
        remaining = len(missing) - 3
        suffix = f" and {remaining} more" if remaining > 0 else ""
        raise HTTPException(
            status_code=422,
            detail=f"Complete the highlighted Creative specifications before sending to Costing: {sample}{suffix}",
        )
    return len(class_names)


def _write_log(db, model, workflow, request, user, action, from_stage, to_stage,
               from_status, to_status, details=None):
    db.add(model(
        workflow_id=workflow.id,
        sample_request_id=request.id,
        sr_number=request.sr_number,
        actor_user_id=getattr(user, "id", None),
        actor_name=_actor(user),
        actor_team=_team(user),
        action=action[:64],
        from_stage=from_stage,
        to_stage=to_stage,
        from_status=from_status,
        to_status=to_status,
        details=details or {},
    ))


def _get_workflow(db, model, sample_request_id: int):
    return db.query(model).filter(model.sample_request_id == sample_request_id).with_for_update().first()


def _serialize_workflow(db, workflow, request, kind: str, log_model, logs=None):
    if logs is None:
        logs = db.query(log_model).filter(log_model.workflow_id == workflow.id).order_by(log_model.id.asc()).all()
    data = {
        "workflow_type": kind,
        "workflow_id": workflow.id,
        "sample_request_id": request.id,
        "request_code": workflow.request_code or (request.request_codes or {}).get(kind) or (request.sr_number if kind == "sample" else None),
        "sr_number": request.sr_number,
        "customer": request.customer,
        "brand_name": request.brand_name,
        "material_code": request.material_code,
        "product_description": request.product_description,
        "status": workflow.status,
        "current_stage": workflow.current_stage,
        "request_types": request.request_types or [],
        "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
        "updated_at": workflow.updated_at.isoformat() if workflow.updated_at else None,
        "closed_at": workflow.closed_at.isoformat() if workflow.closed_at else None,
        "costing_creative_input_needed": bool(request.costing_creative_input_needed),
        "costing_creative_input_remark": request.costing_creative_input_remark,
        "logs": [{
            "id": log.id,
            "actor_name": log.actor_name,
            "actor_team": log.actor_team,
            "action": log.action,
            "from_stage": log.from_stage,
            "to_stage": log.to_stage,
            "from_status": log.from_status,
            "to_status": log.to_status,
            "details": log.details or {},
            "created_at": log.created_at.isoformat() if log.created_at else None,
        } for log in logs],
    }
    if kind == "mockup":
        data.update({
            "workflow_data": workflow.workflow_data or {},
            "reviewer_status": workflow.reviewer_status,
            "reviewer_notes": workflow.reviewer_notes,
            "marketing_decision": workflow.marketing_decision,
        })
    else:
        data.update({
            "request_data": workflow.request_data or _snapshot(request),
            "creative_due_at": workflow.creative_due_at.isoformat() if workflow.creative_due_at else None,
            "costing_output_path": workflow.costing_output_path,
            "costing_notes": workflow.costing_notes,
            "reviewer_status": workflow.reviewer_status,
            "reviewer_notes": workflow.reviewer_notes,
            "reviewer_name": workflow.reviewer_name,
            "reviewed_at": workflow.reviewed_at.isoformat() if workflow.reviewed_at else None,
        })
    return data


def _get_request(db, sample_request_id: int):
    request = db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_request_id).with_for_update().first()
    if not request:
        raise HTTPException(status_code=404, detail="Sample request not found")
    return request


def _create_mockup_if_missing(db, request, user, stage="creative"):
    workflow = _get_workflow(db, MockupWorkflow, request.id)
    if workflow:
        return workflow
    workflow = MockupWorkflow(
        sample_request_id=request.id,
        request_code=SampleRequestService(db)._reserve_scope_code(request, "mockup"),
        sr_number=request.sr_number,
        status=request.status or "In Progress",
        current_stage=stage,
        workflow_data=request.mockup_workflow_state if isinstance(request.mockup_workflow_state, dict) else {},
        created_by_user_id=request.created_by_user_id,
    )
    db.add(workflow)
    db.flush()
    _write_log(db, MockupWorkflowLog, workflow, request, user, "WORKFLOW_STARTED", None, stage,
               None, workflow.status, {"request_types": request.request_types or []})
    return workflow


def _create_costing_if_missing(db, request, user, stage="marketing"):
    workflow = _get_workflow(db, CostingWorkflow, request.id)
    if workflow:
        return workflow
    workflow = CostingWorkflow(
        sample_request_id=request.id,
        request_code=SampleRequestService(db)._reserve_scope_code(request, "costing"),
        sr_number=request.sr_number,
        status=request.status or "In Progress",
        current_stage=stage,
        request_data=_snapshot(request),
        costing_output_path=request.costing_output_path,
        created_by_user_id=request.created_by_user_id,
    )
    db.add(workflow)
    db.flush()
    _write_log(db, CostingWorkflowLog, workflow, request, user, "WORKFLOW_STARTED", None, stage,
               None, workflow.status, workflow.request_data)
    return workflow


def _list_workflows(db, model, log_model, kind, year, stage, limit):
    query = db.query(model, CreateSampleRequest).join(
        CreateSampleRequest, CreateSampleRequest.id == model.sample_request_id
    )
    if year and year.strip().upper() != "ALL":
        clean_year = year.strip()
        date_range = get_business_year_date_range(clean_year)
        if date_range:
            range_start, range_end = (value.isoformat() for value in date_range)
            second_year = clean_year.split("-", 1)[1]
            query = query.filter(or_(
                CreateSampleRequest.year == clean_year,
                and_(CreateSampleRequest.year == second_year,
                     CreateSampleRequest.date_request_created >= range_start,
                     CreateSampleRequest.date_request_created < range_end),
            ))
        else:
            query = query.filter(CreateSampleRequest.year == clean_year)
    if stage:
        query = query.filter(model.current_stage == stage)
    rows = query.order_by(model.updated_at.desc(), model.id.desc()).limit(limit).all()
    workflow_ids = [workflow.id for workflow, _ in rows]
    logs_by_workflow = {}
    if workflow_ids:
        recent_log_ids = db.query(
            log_model.id.label("id"),
            func.row_number().over(
                partition_by=log_model.workflow_id,
                order_by=log_model.id.desc(),
            ).label("row_num"),
        ).filter(log_model.workflow_id.in_(workflow_ids)).subquery()
        logs = db.query(log_model).join(
            recent_log_ids, recent_log_ids.c.id == log_model.id
        ).filter(recent_log_ids.c.row_num <= 100).order_by(log_model.workflow_id, log_model.id).all()
        for log in logs:
            logs_by_workflow.setdefault(log.workflow_id, []).append(log)
    return [
        _serialize_workflow(db, workflow, request, kind, log_model, logs_by_workflow.get(workflow.id, []))
        for workflow, request in rows
    ]


@router.post("/api/v1/workflows/costing/{sample_request_id}/submit", summary="Submit a staged costing request")
def submit_costing_request(sample_request_id: int, payload: Dict[str, Any] = Body(default_factory=dict),
                           db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_team(current_user, "marketing")
    request = _get_request(db, sample_request_id)
    if "costing" not in (request.request_types or []):
        raise HTTPException(status_code=422, detail="This product is not scoped for Costing")
    quantity = str(request.qty_design_costing or "").strip()
    if not quantity.isdigit() or int(quantity) < 1:
        raise HTTPException(status_code=422, detail="Costing quantity must be a whole number greater than zero")
    if str(request.unit_pc_pack or "").casefold() not in {"pc", "pack"}:
        raise HTTPException(status_code=422, detail="Costing unit must be PC or Pack")
    if not str(request.costing_required_date or "").strip():
        raise HTTPException(status_code=422, detail="Costing required date is mandatory")
    if str(request.unit_pc_pack or "").casefold() == "pack":
        pieces_per_pack = str(request.qty_per_pack or "").strip()
        if not pieces_per_pack.isdigit() or int(pieces_per_pack) < 1:
            raise HTTPException(status_code=422, detail="Pieces per pack must be a whole number greater than zero")
    if "mockup" in (request.request_types or []):
        _validate_mockup_intake(request)

    workflow = _get_workflow(db, CostingWorkflow, request.id)
    if workflow and workflow.current_stage != "marketing":
        return _serialize_workflow(db, workflow, request, "costing", CostingWorkflowLog)
    if not workflow:
        workflow = _create_costing_if_missing(db, request, current_user, "marketing")
    old_stage, old_status = workflow.current_stage, workflow.status
    needs_creative = request.costing_creative_input_needed is True
    submitted_at = _now()
    workflow.request_data = _snapshot(request)
    workflow.current_stage = "creative" if needs_creative else "costing"
    workflow.status = "Creative Review" if needs_creative else "Costing Work"
    workflow.creative_due_at = india_operational_deadline(submitted_at, 2) if needs_creative else None
    workflow.updated_at = submitted_at
    if len(request.request_types or []) == 1:
        request.status = "Creative" if needs_creative else "Costing"
    request.updated_at = submitted_at
    _write_log(db, CostingWorkflowLog, workflow, request, current_user, "MARKETING_SUBMITTED",
               old_stage, workflow.current_stage, old_status, workflow.status,
               {**workflow.request_data, "creative_due_at": workflow.creative_due_at.isoformat() if workflow.creative_due_at else None})
    db.commit()
    db.refresh(workflow)
    return _serialize_workflow(db, workflow, request, "costing", CostingWorkflowLog)


@router.post("/api/v1/workflows/costing/{sample_request_id}/release-to-costing", summary="Release a Creative-reviewed request to Costing")
def release_costing_request(sample_request_id: int, payload: Dict[str, Any] = Body(default_factory=dict),
                            db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_team(current_user, "creative_studio")
    if is_team_head(current_user):
        raise HTTPException(status_code=403, detail="Team heads have read-only access to operational workflows")
    request = _get_request(db, sample_request_id)
    if "costing" not in (request.request_types or []):
        raise HTTPException(status_code=422, detail="This product is not scoped for Costing")
    workflow = _get_workflow(db, CostingWorkflow, request.id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Costing workflow not found")
    if workflow.current_stage == "costing":
        return _serialize_workflow(db, workflow, request, "costing", CostingWorkflowLog)
    if workflow.current_stage != "creative":
        raise HTTPException(status_code=409, detail="This request is not waiting for Creative review")

    specifications = payload.get("specifications") or []
    if not isinstance(specifications, list):
        raise HTTPException(status_code=422, detail="Product specifications must be a list")
    existing = {
        (item.class_name.casefold(), item.characteristic_name.casefold()): item
        for item in db.query(ProductDetail).filter(ProductDetail.sample_request_id == request.id).all()
    }
    for item in specifications:
        if not isinstance(item, dict):
            continue
        class_name = str(item.get("class_name") or item.get("className") or "").strip()
        characteristic_name = str(item.get("characteristic_name") or item.get("characteristicName") or "").strip()
        if not class_name or not characteristic_name:
            continue
        key = (class_name.casefold(), characteristic_name.casefold())
        value = item.get("value")
        value = str(value).strip() if value is not None and str(value).strip() else None
        uom = item.get("uom")
        detail = existing.get(key)
        if detail:
            detail.value = value
            if uom is not None:
                detail.uom = str(uom)
        else:
            detail = ProductDetail(
                sample_request_id=request.id,
                class_name=class_name,
                characteristic_name=characteristic_name,
                value=value,
                uom=str(uom) if uom is not None else None,
            )
            db.add(detail)
            existing[key] = detail
    db.flush()
    class_count = _validate_creative_costing_specs(db, request.id)
    if class_count == 0:
        raise HTTPException(status_code=422, detail="Add at least one product class with specifications before sending this request to Costing")

    old_stage, old_status = workflow.current_stage, workflow.status
    workflow.request_data = _snapshot(request)
    workflow.current_stage = "costing"
    workflow.status = "Costing Work"
    workflow.updated_at = _now()
    if len(request.request_types or []) == 1:
        request.status = "Costing"
    request.updated_at = _now()
    _write_log(
        db, CostingWorkflowLog, workflow, request, current_user, "CREATIVE_RELEASED_TO_COSTING",
        old_stage, workflow.current_stage, old_status, workflow.status,
        {"specification_count": len(specifications), "product_class_count": class_count,
         "note": str(payload.get("note") or "").strip()[:2000]},
    )
    db.commit()
    db.refresh(workflow)
    return _serialize_workflow(db, workflow, request, "costing", CostingWorkflowLog)


@router.get("/api/v1/workflows/costing", summary="List costing workflow records")
def list_costing_workflows(year: Optional[str] = None, stage: Optional[str] = None,
                           limit: int = Query(500, ge=1, le=2000), db: Session = Depends(get_db),
                           current_user=Depends(get_current_user)):
    require_any_team(current_user, ("marketing", "creative_studio", "costing", "samp"))
    stage_filter = stage
    if not stage_filter and user_has_team(current_user, "costing"):
        stage_filter = "costing"
    elif not stage_filter and user_has_team(current_user, "creative_studio"):
        stage_filter = "creative"
    elif not stage_filter and user_has_team(current_user, "samp"):
        stage_filter = "sampling_review"
    return _list_workflows(db, CostingWorkflow, CostingWorkflowLog, "costing", year, stage_filter, limit)


@router.post("/api/v1/workflows/costing/{sample_request_id}/complete", summary="Submit costing output for Sampling review")
def complete_costing_work(sample_request_id: int, payload: Dict[str, Any] = Body(...),
                          db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_team(current_user, "costing")
    request = _get_request(db, sample_request_id)
    workflow = _get_workflow(db, CostingWorkflow, sample_request_id)
    if not workflow:
        raise HTTPException(status_code=409, detail="Marketing and Creative must send this request to the Costing queue first")
    if workflow.current_stage != "costing":
        raise HTTPException(status_code=409, detail="This request is not in the Costing work queue")
    if not db.query(ProductDetail.id).filter(ProductDetail.sample_request_id == request.id).first():
        raise HTTPException(status_code=422, detail="Product class specifications must be attached before completing Costing")
    output = str(payload.get("costing_output_path") or payload.get("output_path") or "").strip()
    if not output:
        raise HTTPException(status_code=422, detail="Add the costing sheet link or file path before submitting")
    note = str(payload.get("notes") or "").strip()
    old_stage, old_status = workflow.current_stage, workflow.status
    workflow.costing_output_path = output[:4000]
    workflow.costing_notes = note[:4000] or None
    workflow.current_stage = "sampling_review"
    workflow.status = "Sampling Review (Costing)"
    workflow.reviewer_status = "pending"
    workflow.reviewer_notes = None
    workflow.updated_at = _now()
    request.costing_output_path = output[:4000]
    if not ({"sample", "mockup"} & set(request.request_types or [])):
        request.status = workflow.status
    request.updated_at = _now()
    _write_log(db, CostingWorkflowLog, workflow, request, current_user, "COSTING_SUBMITTED_FOR_REVIEW",
               old_stage, workflow.current_stage, old_status, workflow.status,
               {"output_path": output[:4000], "notes": note[:4000]})
    db.commit()
    db.refresh(workflow)
    return _serialize_workflow(db, workflow, request, "costing", CostingWorkflowLog)


def _list_sample_requests_for_sampling(db, year, limit):
    query = db.query(CreateSampleRequest).filter(
        or_(
            CreateSampleRequest.status.ilike("%sampling%"),
            CreateSampleRequest.status == "SAMP",
            CreateSampleRequest.status == "Released to Plant",
        )
    )
    if year and year.strip().upper() != "ALL":
        clean_year = year.strip()
        date_range = get_business_year_date_range(clean_year)
        if date_range:
            range_start, range_end = (value.isoformat() for value in date_range)
            second_year = clean_year.split("-", 1)[1] if "-" in clean_year else clean_year
            query = query.filter(or_(
                CreateSampleRequest.year == clean_year,
                and_(CreateSampleRequest.year == second_year,
                     CreateSampleRequest.date_request_created >= range_start,
                     CreateSampleRequest.date_request_created < range_end),
            ))
        else:
            query = query.filter(CreateSampleRequest.year == clean_year)
    rows = query.order_by(CreateSampleRequest.updated_at.desc(), CreateSampleRequest.id.desc()).limit(limit).all()
    results = []
    for req in rows:
        state = dict(req.mockup_workflow_state or {})
        routing = dict(state.get("samplingRouting") or {})
        is_resample = bool(
            state.get("isResample") or state.get("is_resample")
            or routing.get("isResample") or routing.get("is_resample")
            or req.creation_mode == "resample"
        )
        is_released_to_plant = req.status == "Released to Plant"
        status = str(req.status or "").casefold()
        is_awaiting_sampling = "sampling" in status or status == "samp"
        if not is_awaiting_sampling and not (is_resample and is_released_to_plant):
            continue
        stage = "plant" if is_released_to_plant else "sampling_review"
        results.append({
            "workflow_type": "sample",
            "workflow_id": req.id,
            "sample_request_id": req.id,
            "request_code": req.sr_number,
            "sr_number": req.sr_number,
            "customer": req.customer,
            "brand_name": req.brand_name,
            "material_code": req.material_code,
            "product_description": req.product_description,
            "status": req.status,
            "current_stage": stage,
            "request_types": req.request_types or ["sample"],
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "updated_at": req.updated_at.isoformat() if req.updated_at else None,
            "closed_at": state.get("plantReleasedAt"),
            "request_data": {
                "required_date": str(req.sample_required_date) if req.sample_required_date else None,
                "quantity": req.qty_for_sampling or "1",
                "unit": req.unit_pc_pack or "PC",
                "target_plant": req.target_plant,
                "is_resample": is_resample,
            },
            "workflow_data": {
                **state,
                "isResample": is_resample,
                "claimedBy": state.get("claimedBy"),
                "plantReleaseTarget": state.get("plantReleaseTarget") or req.target_plant,
            },
            "reviewer_status": "bypassed" if is_resample and is_released_to_plant else "not_started" if req.status == "Sampling Review (PMT)" else "in_progress",
            "reviewer_notes": state.get("samplingRemark") or state.get("samplingFeedback"),
            "reviewer_name": state.get("samplingFeedbackBy") or state.get("plantReleasedBy"),
            "reviewed_at": state.get("samplingFeedbackAt") or state.get("plantReleasedAt"),
            "logs": [],
        })
    return results


def _list_design_requests_for_sampling(db, year, limit):
    query = db.query(DesignRequest)
    if year and year.strip().upper() != "ALL":
        clean_year = year.strip()
        query = query.filter(or_(
            DesignRequest.program_year == clean_year,
            DesignRequest.program_year == (clean_year.split("-", 1)[1] if "-" in clean_year else clean_year)
        ))
    rows = query.order_by(DesignRequest.updated_at.desc(), DesignRequest.id.desc()).limit(limit).all()
    results = []
    for d in rows:
        state = dict(d.workflow_state or {})
        results.append({
            "workflow_type": "design",
            "workflow_id": d.id,
            "sample_request_id": d.id,
            "request_code": d.request_code,
            "sr_number": d.sr_number,
            "customer": d.customer_name,
            "brand_name": d.program_name,
            "material_code": d.request_code,
            "product_description": d.product_description or "Creative Design Brief",
            "status": d.status,
            "current_stage": "design_review",
            "request_types": ["design"],
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
            "request_data": {
                "required_date": d.design_required_date,
                "number_of_designs": d.number_of_designs,
                "trend": d.trend,
                "target_audience": d.target_audience,
            },
            "workflow_data": state,
            "reviewer_status": "pending",
            "reviewer_notes": d.design_remarks,
            "reviewer_name": None,
            "reviewed_at": None,
            "logs": [],
        })
    return results


@router.get("/api/v1/workflows/reviews", summary="List Sampling reviews and direct Plant resamples")
def list_sampling_workflow_reviews(year: Optional[str] = None,
                                   limit: int = Query(500, ge=1, le=2000),
                                   db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_any_team(current_user, ("samp", "admin"))
    mockups = _list_workflows(db, MockupWorkflow, MockupWorkflowLog, "mockup", year, None, limit)
    costings = _list_workflows(db, CostingWorkflow, CostingWorkflowLog, "costing", year, None, limit)
    samples = _list_sample_requests_for_sampling(db, year, limit)
    designs = _list_design_requests_for_sampling(db, year, limit)
    return samples + designs + mockups + costings


@router.post("/api/v1/workflows/{workflow_type}/{sample_request_id}/review", summary="Approve or return a workflow from Sampling review")
def review_workflow(workflow_type: str, sample_request_id: int, payload: Dict[str, Any] = Body(...),
                    db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_team(current_user, "samp")
    decision = str(payload.get("decision") or "").strip().casefold()
    remark = str(payload.get("remark") or "").strip()
    if decision not in {"approve", "return", "request_revision"}:
        raise HTTPException(status_code=422, detail="Decision must be approve or return")
    returning = decision != "approve"
    if returning and not remark:
        raise HTTPException(status_code=422, detail="A reviewer note is required when returning the request")
    request = _get_request(db, sample_request_id)
    if workflow_type == "mockup":
        workflow = _get_workflow(db, MockupWorkflow, sample_request_id)
        log_model = MockupWorkflowLog
        label = "Mockup"
        if not workflow:
            raise HTTPException(status_code=404, detail="Mockup workflow not found")
        if workflow.current_stage != "sampling_review":
            raise HTTPException(status_code=409, detail="This mockup is not awaiting Sampling review")
        state = dict(request.mockup_workflow_state or {})
        _require_claim(state, current_user, "sampling_review")
        old_stage, old_status = workflow.current_stage, workflow.status
        workflow.reviewer_status = "returned" if returning else "approved"
        workflow.reviewer_notes = remark or None
        workflow.reviewer_user_id = current_user.id
        workflow.reviewer_name = _actor(current_user)
        workflow.reviewed_at = _now()
        workflow.current_stage = "studio" if returning else "awaiting_marketing_acceptance"
        workflow.status = "Studio Revision Requested" if returning else "Awaiting Marketing Mockup Acceptance"
        state.update({
            "stage": workflow.current_stage,
            "samplingReviewDecision": "return" if returning else "approve",
            "samplingReviewRemark": remark,
            "samplingReviewedAt": workflow.reviewed_at.isoformat(),
            "samplingReviewedBy": _actor(current_user),
        })
        _clear_claim(state)
        events = list(state.get("events") or [])
        events.append({
            "id": f"event-{workflow.id}-{int(workflow.reviewed_at.timestamp())}",
            "action": "SAMPLING_RETURNED_MOCKUP" if returning else "SAMPLING_APPROVED_MOCKUP",
            "title": "Sampling returned mockup to Studio" if returning else "Sampling approved mockup for Marketing",
            "actorName": _actor(current_user),
            "actorDepartment": "Sampling",
            "timestamp": workflow.reviewed_at.isoformat(),
            "remark": remark or None,
        })
        state["events"] = events[-100:]
        request.mockup_workflow_state = state
        workflow.workflow_data = state
        request.status = workflow.status
        details = {"decision": "return" if returning else "approve", "remark": remark}
    elif workflow_type == "costing":
        workflow = _get_workflow(db, CostingWorkflow, sample_request_id)
        log_model = CostingWorkflowLog
        label = "Costing"
        if not workflow:
            raise HTTPException(status_code=404, detail="Costing workflow not found")
        if workflow.current_stage != "sampling_review":
            raise HTTPException(status_code=409, detail="This costing request is not awaiting Sampling review")
        old_stage, old_status = workflow.current_stage, workflow.status
        workflow.reviewer_status = "returned" if returning else "approved"
        workflow.reviewer_notes = remark or None
        workflow.reviewer_user_id = current_user.id
        workflow.reviewer_name = _actor(current_user)
        workflow.reviewed_at = _now()
        workflow.current_stage = "costing" if returning else "done"
        workflow.status = "Costing Revision Requested" if returning else "Approved / Closed"
        if not ({"sample", "mockup"} & set(request.request_types or [])):
            request.status = workflow.status
        workflow.closed_at = None if returning else _now()
        details = {"decision": "return" if returning else "approve", "remark": remark}
    else:
        raise HTTPException(status_code=404, detail="Unknown workflow type")

    workflow.updated_at = _now()
    request.updated_at = _now()
    _write_log(db, log_model, workflow, request, current_user,
               f"SAMPLING_{'RETURNED' if returning else 'APPROVED'}_{label.upper()}",
               old_stage, workflow.current_stage, old_status, workflow.status, details)
    db.commit()
    db.refresh(workflow)
    return _serialize_workflow(db, workflow, request, workflow_type, log_model)


@router.post("/api/v1/workflows/mockup/{sample_request_id}/marketing-decision", summary="Record Marketing's final mockup decision")
def marketing_mockup_decision(sample_request_id: int, payload: Dict[str, Any] = Body(...),
                              db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # Keep the legacy URL as a compatibility alias while sharing the single
    # Marketing transition used by the Mockup request inspector.
    decide_mockup_marketing_acceptance(
        sample_id=sample_request_id,
        body=payload,
        service=SampleRequestService(db),
        current_user=current_user,
    )
    request = _get_request(db, sample_request_id)
    workflow = _get_workflow(db, MockupWorkflow, sample_request_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Mockup workflow not found")
    return _serialize_workflow(db, workflow, request, "mockup", MockupWorkflowLog)

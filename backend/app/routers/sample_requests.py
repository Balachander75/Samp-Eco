"""
Sample requests and operational flow routers.
Provides endpoints for sample requests, design requests, and cross-desk downstream tasks
(studio dielines, creative briefs, costing estimations, product characteristics).
Delegates domain persistence to SampleRequestService, DesignRequestService, and Repositories.
"""
from typing import Any, Dict, List, Optional
from datetime import date, datetime, timedelta, timezone
import re
from urllib.parse import urlsplit
from uuid import uuid4
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.permissions import (
    assigned_plant_values,
    can_access_plant,
    filter_linked_plant_records,
    filter_plant_records,
    is_admin,
    is_team_head,
    require_admin,
    require_any_team,
    require_plant_access,
    require_smps_member,
    require_team,
    user_has_team,
)
from app.auth.security import get_current_user
from app.database import get_db
from app.models.feasibility import FeasibilityRequest
from app.models.master import Plant
from app.models.sample_request import CreateSampleRequest, DesignRequest, ProductCharacteristic, ProductDetail, SampleRequestActivityLog
from app.services.sample_request_service import SampleRequestService
from app.services.design_request_service import DesignRequestService
from app.services.downstream_service import DownstreamService

router = APIRouter(
    tags=["Sample Requests & Operations"],
    dependencies=[Depends(require_smps_member)],
)


def _normalize_binding(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").casefold())


def _is_mockup_creative_characteristic(class_name: Any, characteristic_name: Any) -> bool:
    class_key = _normalize_binding(class_name).upper()
    field = _normalize_binding(characteristic_name).upper()
    if class_key == "NBBINDING":
        return field in {
            "BINDINGCOLORSTYLE",
            "EDGEFINISHINGNOOFDESIGN",
            "EDGEFINISHINNOOFDESIGN",
            "EDGEFINISHINGDESIGNNOTES",
            "ACCESSORIESDETAIL",
            "ACCESSORIEESDETAIL",
        }
    if class_key == "NBDIVIDERSPECS":
        return field in {
            "NOOFDESIGNPRINT", "NOOFCOLORB", "NAMEOFCOLORB", "PRINTINGFINISH",
            "D2NAMEOFCOLORB", "D2PRINTINGFINISH",
        }
    if class_key == "PACKINGDETAILS":
        return field in {
            "NAMEOFCOLOR", "NAMEOFCOLORFB", "NAMEOFCOLORFB2",
            "DESIGNCOLORASSORTMENT", "SPECIALINSTRUCTION", "DESIGNCOLORASSORTMENT2",
        }
    component_match = re.fullmatch(r"NBCOMPONENT([1-6])", class_key)
    if not component_match:
        return False
    component_number = component_match.group(1)
    field = re.sub(rf"^C?{component_number}", "", field)
    return field in {
        "NAMEOFCOLORSFB1",
        "NAMEOFCOLORFB1",
        "NAMEOFCOLORB1",
        "RULLINGPRINTINGDESIGNNAME1",
        "RULINGPRINTINGDESIGNNAME1",
        "NAMEOFCOLORSFB",
        "NAMEOFCOLORFB",
        "NAMEOFCOLORB",
        "RULLINGPRINTINGDESIGNNAME2",
        "RULINGPRINTINGDESIGNNAME2",
    }


def _clear_mockup_creative_characteristics(
    record: CreateSampleRequest,
    db: Session,
    pending_keys: Optional[List[Dict[str, Any]]] = None,
) -> tuple[List[Dict[str, str]], List[Dict[str, str]]]:
    empty_values = {"", "NA", "N/A", "NAN", "NULL", "NONE", "-"}
    request_classes = {_normalize_binding(detail.class_name).upper() for detail in record.product_details}
    creative_fields: Dict[tuple[str, str], Dict[str, str]] = {}
    for characteristic in db.query(ProductCharacteristic).filter(ProductCharacteristic.is_active.is_(True)).all():
        if (
            _normalize_binding(characteristic.class_name).upper() in request_classes
            and _is_mockup_creative_characteristic(characteristic.class_name, characteristic.characteristic_name)
        ):
            key = (
                _normalize_binding(characteristic.class_name).upper(),
                _normalize_binding(characteristic.characteristic_name).upper(),
            )
            creative_fields[key] = {
                "className": characteristic.class_name,
                "characteristicName": characteristic.characteristic_name,
            }
    required = []
    pending_lookup = {
        (
            _normalize_binding(item.get("className") or item.get("class_name")),
            _normalize_binding(item.get("characteristicName") or item.get("characteristic_name")),
        )
        for item in (pending_keys or [])
        if isinstance(item, dict)
    }
    for detail in record.product_details:
        if not _is_mockup_creative_characteristic(detail.class_name, detail.characteristic_name):
            continue
        key = (
            _normalize_binding(detail.class_name).upper(),
            _normalize_binding(detail.characteristic_name).upper(),
        )
        creative_fields.setdefault(key, {"className": detail.class_name, "characteristicName": detail.characteristic_name})
        value = str(detail.value or "").strip()
        if value.upper() not in empty_values or key in pending_lookup:
            required.append({"className": detail.class_name, "characteristicName": detail.characteristic_name})
        if value.upper() not in empty_values:
            detail.value = None
    for item in pending_keys or []:
        if not isinstance(item, dict):
            continue
        class_name = str(item.get("className") or item.get("class_name") or "").strip()
        characteristic_name = str(item.get("characteristicName") or item.get("characteristic_name") or "").strip()
        if not class_name or not characteristic_name or not _is_mockup_creative_characteristic(class_name, characteristic_name):
            continue
        key = (_normalize_binding(class_name), _normalize_binding(characteristic_name))
        creative_fields.setdefault(key, {"className": class_name, "characteristicName": characteristic_name})
        if not any(
            (_normalize_binding(value["className"]), _normalize_binding(value["characteristicName"])) == key
            for value in required
        ):
            required.append({"className": class_name, "characteristicName": characteristic_name})
    return [creative_fields[key] for key in sorted(creative_fields)], required


def _validate_sample_design_count(payload: Dict[str, Any]) -> None:
    request_types = payload.get("request_types", payload.get("requestTypes", [])) or []
    if "design" not in request_types:
        return
    raw_count = (
        payload.get("number_of_designs")
        or payload.get("numberOfDesigns")
        or payload.get("product_artwork_nos")
        or payload.get("designs_customer_creative")
        or 1
    )
    try:
        count = int(raw_count)
    except (TypeError, ValueError):
        count = 0
    if not 1 <= count <= 100:
        raise HTTPException(status_code=422, detail="Request between 1 and 100 artwork variants")


def _validate_marketing_draft_item(payload: Dict[str, Any]) -> None:
    """Validate the product-level minimum before a Marketing draft is persisted."""
    if not str(payload.get("customer") or "").strip():
        raise HTTPException(status_code=422, detail="Select a customer before saving the draft.")
    if not str(payload.get("product_description") or payload.get("productDescription") or "").strip():
        raise HTTPException(status_code=422, detail="Add a product description before saving the draft.")
    raw_types = payload.get("request_types", payload.get("requestTypes", [])) or []
    if isinstance(raw_types, str):
        request_types = [value.strip().lower() for value in raw_types.split(",") if value.strip()]
    elif isinstance(raw_types, list):
        request_types = [str(value).strip().lower() for value in raw_types if str(value).strip()]
    else:
        request_types = []
    draft_key = str(payload.get("client_draft_key") or "").strip()
    allowed_types = {"design", "mockup", "sample", "costing"}
    if (draft_key and not request_types) or any(value not in allowed_types for value in request_types):
        raise HTTPException(status_code=422, detail="Choose at least one valid request type: Design, Mockup, Sampling, or Costing.")
    if len(str(payload.get("customer") or "").strip()) > 150:
        raise HTTPException(status_code=422, detail="Customer name must be 150 characters or fewer.")
    if len(str(payload.get("program_name") or payload.get("programName") or "").strip()) > 150:
        raise HTTPException(status_code=422, detail="Program name must be 150 characters or fewer.")
    if len(str(payload.get("material_code") or payload.get("materialCode") or "").strip()) > 100:
        raise HTTPException(status_code=422, detail="Material code must be 100 characters or fewer.")
    payload["customer"] = str(payload.get("customer") or "").strip()
    payload["product_description"] = str(payload.get("product_description") or payload.get("productDescription") or "").strip()
    payload["request_types"] = list(dict.fromkeys(request_types))
    if draft_key:
        payload["status"] = "Draft (Pre-SMT)"
    if draft_key and len(draft_key) > 160:
        raise HTTPException(status_code=422, detail="The draft save key is invalid. Refresh the staging page and retry.")
    for field in ("sample_required_date", "target_artwork_date_creative", "target_artwork_date_studio", "costing_required_date"):
        value = payload.get(field)
        if value:
            try:
                date.fromisoformat(str(value).split("T")[0])
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail=f"{field.replace('_', ' ').capitalize()} must be a valid date.")


def _ensure_draft_key_owner(payload: Dict[str, Any], service: SampleRequestService, current_user: Any) -> None:
    draft_key = str(payload.get("client_draft_key") or "").strip()
    if not draft_key or is_admin(current_user):
        return
    existing = service.db.query(CreateSampleRequest).filter(
        CreateSampleRequest.client_draft_key == draft_key
    ).first()
    if not existing:
        return
    allowed_owners = {
        str(value).strip().casefold()
        for value in (
            getattr(current_user, "name", None),
            getattr(current_user, "userid", None),
        ) if value
    }
    same_owner = existing.created_by_user_id == current_user.id
    legacy_owner_match = existing.created_by_user_id is None and str(existing.created_by or "").strip().casefold() in allowed_owners
    if not (same_owner or legacy_owner_match):
        raise HTTPException(status_code=403, detail="This draft belongs to another Marketing user.")


def _marketing_actor(current_user: Any) -> str:
    return str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Marketing").strip()[:100]


def _require_marketing_design_owner(id: int, service: DesignRequestService, current_user: Any) -> Dict[str, Any]:
    record = service.get_by_id(id)
    if not record:
        raise HTTPException(status_code=404, detail="Design request not found")
    if not is_admin(current_user) and not is_team_head(current_user) and record.get("created_by_user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Design request not found")
    return record


def _require_marketing_sample_owner(sample: Dict[str, Any], current_user: Any) -> None:
    if (
        user_has_team(current_user, "marketing")
        and not is_admin(current_user)
        and not is_team_head(current_user)
        and sample.get("created_by_user_id") != current_user.id
    ):
        raise HTTPException(status_code=404, detail="Sample request not found")


def _filter_marketing_sample_owners(records: List[Dict[str, Any]], current_user: Any) -> List[Dict[str, Any]]:
    if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user):
        return [row for row in records if row.get("created_by_user_id") == current_user.id]
    return records


def _mockup_claimed_by_another_member(sample: Dict[str, Any], current_user: Any) -> bool:
    """Hide a mockup task after another Creative Studio member claims its current stage."""
    if is_admin(current_user) or is_team_head(current_user) or not user_has_team(current_user, "creative_studio"):
        return False
    state = sample.get("mockup_workflow_state")
    if not isinstance(state, dict):
        return False
    stage = state.get("stage")
    if stage not in {"creative", "studio", "creative_approval"} or state.get("claimedStage") != stage:
        return False
    claim_id = state.get("claimedByUserId")
    claim_name = str(state.get("claimedBy") or "").strip().casefold()
    actor_names = {
        str(value).strip().casefold()
        for value in (getattr(current_user, "name", None), getattr(current_user, "userid", None))
        if value
    }
    if claim_id is not None:
        return claim_id != current_user.id
    return bool(claim_name and claim_name not in actor_names)


def _filter_creative_mockup_claims(records: List[Dict[str, Any]], current_user: Any) -> List[Dict[str, Any]]:
    if is_admin(current_user) or is_team_head(current_user) or not user_has_team(current_user, "creative_studio"):
        return records
    return [record for record in records if not _mockup_claimed_by_another_member(record, current_user)]


def _marketing_request_plant(service: SampleRequestService) -> str:
    plant = service.db.query(Plant).filter(Plant.code == "1505", Plant.is_active.is_(True)).first()
    if not plant:
        raise HTTPException(status_code=409, detail="The Khaniwade plant (1505) is not configured in plant master data.")
    return plant.name


def _validate_new_mockup_design(payload: Dict[str, Any]) -> None:
    """A new Mockup product needs its product brief; Design is handled in the Mockup route."""
    raw_types = payload.get("request_types", payload.get("requestTypes", [])) or []
    if isinstance(raw_types, str):
        request_types = {value.strip().lower() for value in raw_types.split(",")}
    else:
        request_types = {str(value).strip().lower() for value in raw_types}
    creation_mode = str(payload.get("creation_mode", payload.get("creationMode", ""))).strip().lower()
    mockup_required = str(payload.get("mockup_required", payload.get("mockupRequired", ""))).strip().lower()
    is_mockup = "mockup" in request_types or mockup_required == "yes"
    if not is_mockup or creation_mode != "new":
        return
    description = payload.get("product_description", payload.get("productDescription"))
    if not str(description or "").strip():
        raise HTTPException(status_code=422, detail="A product description is required for a new Mockup product.")


def _mockup_route_state(payload: Dict[str, Any]) -> Dict[str, Any]:
    value = payload.get("mockup_workflow_state", payload.get("mockupWorkflowState"))
    return value if isinstance(value, dict) else {}


def _mockup_today(now: Optional[datetime] = None) -> date:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(ZoneInfo("Asia/Kolkata")).date()


def _parse_mockup_date(value: Any, field_name: str) -> date:
    raw = str(value or "").strip()
    try:
        return date.fromisoformat(raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail=f"{field_name} must be a valid date.")


def _validate_mockup_required_date(state: Dict[str, Any], now: Optional[datetime] = None) -> date:
    required_date = _parse_mockup_date(
        state.get("requiredDate", state.get("required_date")),
        "Mockup required date",
    )
    earliest = _mockup_today(now) + timedelta(days=2)
    if required_date < earliest:
        raise HTTPException(
            status_code=422,
            detail=f"Mockup required date must be at least 48 hours after release. Choose {earliest.isoformat()} or later.",
        )
    state["requiredDate"] = required_date.isoformat()
    return required_date


def _initialize_mockup_release_dates(
    state: Dict[str, Any],
    stage: str,
    now: Optional[datetime] = None,
) -> date:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    required_date = _validate_mockup_required_date(state, current)
    state["marketingRequiredDate"] = required_date.isoformat()
    state["studioSystemRequiredDate"] = required_date.isoformat()
    if _mockup_requires_design(state):
        state["creativeSystemRequiredDate"] = (required_date - timedelta(days=1)).isoformat()
    if stage == "creative":
        state["releasedToCreativeAt"] = current.astimezone(timezone.utc).isoformat()
        state["creativeDateDecisionDueAt"] = (
            current.astimezone(timezone.utc) + timedelta(hours=24)
        ).isoformat()
    elif stage == "studio":
        state["releasedToStudioAt"] = current.astimezone(timezone.utc).isoformat()
        state.setdefault("studioEarliestStartDate", _mockup_today(current).isoformat())
    return required_date


def _mockup_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def _prepare_mockup_intake_state(payload: Dict[str, Any]) -> None:
    """Accept route metadata at intake, but never let a client pre-release a task."""
    raw_types = payload.get("request_types", payload.get("requestTypes", [])) or []
    types = {str(value).strip().lower() for value in raw_types} if isinstance(raw_types, list) else {
        value.strip().lower() for value in str(raw_types).split(",") if value.strip()
    }
    is_mockup = "mockup" in types or str(payload.get("mockup_required", payload.get("mockupRequired", ""))).casefold() == "yes"
    if not is_mockup:
        return
    state = dict(_mockup_route_state(payload))
    if state.get("stage") not in (None, "marketing"):
        raise HTTPException(status_code=422, detail="A new Mockup request must start in Marketing Draft.")
    for key in (
        "releasedToCreativeAt", "releasedToStudioAt", "designAcceptedAt",
        "sentToStudioAt", "sentToStudioBy", "mockupUrl", "mockup_url",
        "submittedToMarketingAt", "submittedToMarketingBy",
        "claimedBy", "claimedByUserId", "claimedAt", "claimedStage",
        "creativeCharacteristicKeys", "creativeRequiredCharacteristicKeys", "creativeCharacteristicsClearedAt",
        "creativeShutterstockNo", "creativeRemark",
        "creativeSystemRequiredDate", "creativeDateDecisionDueAt", "creativeDateDecision",
        "creativeDateDecisionAt", "creativeDateDecisionLate", "creativeInputDate",
        "creativeConfirmedDate", "creativeProposedDate", "studioSystemRequiredDate",
        "studioEarliestStartDate", "studioSubmittedAt", "creativeApprovalDueAt",
        "creativeApprovalActualAt", "creativeApprovedAt", "marketingAcceptedAt",
        "marketingRevisionRemark", "studioRevisionRequestedAt", "studioRevisionRemark",
        "creativeRevisionRequestedAt", "creativeRevisionRemark",
    ):
        state.pop(key, None)
    state["stage"] = "marketing"
    state["events"] = []
    payload["mockup_workflow_state"] = state


def _validate_mockup_route(payload: Dict[str, Any]) -> None:
    """Validate Marketing's routing choice and the no-design handoff details."""
    raw_types = payload.get("request_types", payload.get("requestTypes", [])) or []
    if isinstance(raw_types, str):
        request_types = {value.strip().lower() for value in raw_types.split(",") if value.strip()}
    elif isinstance(raw_types, list):
        request_types = {str(value).strip().lower() for value in raw_types if str(value).strip()}
    else:
        request_types = set()
    if "mockup" not in request_types and str(payload.get("mockup_required", payload.get("mockupRequired", ""))).casefold() != "yes":
        return

    state = _mockup_route_state(payload)
    if state.get("stage") not in (
        None,
        "marketing",
        "awaiting_design_acceptance",
        "creative",
        "studio",
        "creative_approval",
        "awaiting_marketing_acceptance",
        "done",
    ):
        raise HTTPException(status_code=422, detail="Invalid Mockup workflow stage.")
    mode = str(payload.get("creation_mode", payload.get("creationMode", ""))).strip().lower()
    decision = state.get("designNeeded", state.get("design_needed"))
    if mode == "new":
        decision = True
    elif decision not in (True, False):
        raise HTTPException(status_code=422, detail="Choose whether the existing product needs a Design request.")

    # Once the request has been released, routing metadata belongs to the
    # Creative/Studio handoff and must survive ordinary Marketing updates.
    if state.get("stage") not in (None, "marketing"):
        state["designNeeded"] = decision
        payload["mockup_workflow_state"] = state
        return

    if decision:
        state["designNeeded"] = True
        state["marketingShutterstockNo"] = ""
        state["marketingRemark"] = ""
        state.pop("creativeCharacteristicKeys", None)
        state.pop("creativeRequiredCharacteristicKeys", None)
        state.pop("creativeCharacteristicsClearedAt", None)
        state.pop("creativeShutterstockNo", None)
        state.pop("creativeRemark", None)
        state.setdefault("stage", "marketing")
        state.setdefault("events", [])
        payload["mockup_workflow_state"] = state
        return

    if state.get("creativeChangesRequired") or state.get("creativePendingCharacteristicKeys"):
        shutterstock = str(state.get("marketingShutterstockNo", state.get("marketing_shutterstock_no", "")) or "").strip()
        remark = str(state.get("marketingRemark", state.get("marketing_remark", "")) or "").strip()
        if len(shutterstock) > 100 or len(remark) > 1000:
            raise HTTPException(status_code=422, detail="Shutterstock number must be 100 characters or fewer and remark 1,000 characters or fewer.")
        state["designNeeded"] = False
        state["marketingShutterstockNo"] = shutterstock
        state["marketingRemark"] = remark
        state.setdefault("stage", "marketing")
        state.setdefault("events", [])
        payload["mockup_workflow_state"] = state
        return

    shutterstock = str(state.get("marketingShutterstockNo", state.get("marketing_shutterstock_no", "")) or "").strip()
    remark = str(state.get("marketingRemark", state.get("marketing_remark", "")) or "").strip()
    if not shutterstock and not remark:
        raise HTTPException(status_code=422, detail="Add a Shutterstock number or a Marketing remark for a direct-to-Studio Mockup request.")
    if len(shutterstock) > 100 or len(remark) > 1000:
        raise HTTPException(status_code=422, detail="Shutterstock number must be 100 characters or fewer and remark 1,000 characters or fewer.")
    state["designNeeded"] = False
    state["marketingShutterstockNo"] = shutterstock
    state["marketingRemark"] = remark
    state.setdefault("stage", "marketing")
    state.setdefault("events", [])
    payload["mockup_workflow_state"] = state


def get_sample_request_service(db: Session = Depends(get_db)) -> SampleRequestService:
    return SampleRequestService(db)


def get_design_request_service(db: Session = Depends(get_db)) -> DesignRequestService:
    return DesignRequestService(db)


def get_downstream_service(db: Session = Depends(get_db)) -> DownstreamService:
    return DownstreamService(db)



# ---------------------------------------------------------------------------
# Business Years Metadata
# ---------------------------------------------------------------------------

@router.get("/api/v1/sample-requests/business-years", summary="Get available business years and summary")
@router.get("/api/sample-requests/business-years", summary="Get available business years and summary (legacy alias)")
def get_business_years(
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    plants = assigned_plant_values(current_user, service.db) if user_has_team(current_user, "plant") else None
    owner_id = current_user.id if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user) else None
    return service.get_business_years_summary(target_plants=plants, created_by_user_id=owner_id)


# ---------------------------------------------------------------------------
# Sample Requests (/api/v1/sample-requests and legacy alias /api/sample-requests)
# ---------------------------------------------------------------------------

@router.get("/api/v1/sample-requests", summary="List sample requests with filters")
@router.get("/api/sample-requests", summary="List sample requests (legacy alias)")
def list_sample_requests(
    year: Optional[str] = None,
    customer: Optional[str] = None,
    status: Optional[str] = None,
    stage: Optional[str] = None,
    draft_only: bool = False,
    created_by: Optional[str] = None,
    request_type: Optional[str] = None,
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    if request_type and request_type.strip().lower() not in {"design", "mockup", "sample", "costing"}:
        raise HTTPException(status_code=422, detail="Unsupported sample request type filter")
    effective_status = status or stage
    owner_id = current_user.id if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user) else None
    rows = service.list_requests(
        year=year,
        customer=customer,
        status=effective_status,
        draft_only=draft_only,
        created_by=created_by,
        created_by_user_id=owner_id,
        request_type=request_type,
    )
    rows = _filter_marketing_sample_owners(rows, current_user)
    rows = _filter_creative_mockup_claims(rows, current_user)
    return filter_plant_records(current_user, rows, service.db)


@router.get("/api/v1/sample-requests/search-material", summary="Search products by material code (alias)")
@router.get("/api/v1/sample-requests/search-materials", summary="Search products by material code")
def search_materials_get(
    query: Optional[str] = None,
    code: Optional[str] = None,
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    search_term = code or query or ""
    return filter_plant_records(current_user, _filter_marketing_sample_owners(service.search_materials(search_term), current_user), service.db)


@router.get("/api/v1/sample-requests/{id}", response_model=Dict[str, Any], summary="Get sample request by ID or SR Number")
@router.get("/api/sample-requests/{id}", response_model=Dict[str, Any], summary="Get sample request (legacy alias)")
def get_sample_request(
    id: str,
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    num_id = int(id) if id.isdigit() else None
    if not num_id:
        req = service.repo.get_by_sr_number(id)
        if not req:
            raise HTTPException(status_code=404, detail="Sample request not found")
        num_id = req.id

    result = service.get_by_id(num_id)
    if not result:
        raise HTTPException(status_code=404, detail="Sample request not found")
    _require_marketing_sample_owner(result, current_user)
    if _mockup_claimed_by_another_member(result, current_user):
        raise HTTPException(status_code=404, detail="Sample request not found")
    require_plant_access(current_user, result.get("target_plant"), service.db)
    return result


@router.get("/api/v1/sample-requests/{id}/activity-logs", summary="List the durable sample request history")
def list_sample_request_activity_logs(
    id: str,
    limit: int = 200,
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    num_id = int(id) if id.isdigit() else None
    if not num_id:
        request = service.repo.get_by_sr_number(id)
        num_id = request.id if request else None
    if not num_id:
        raise HTTPException(status_code=404, detail="Sample request not found")

    request = service.get_by_id(num_id)
    if not request:
        raise HTTPException(status_code=404, detail="Sample request not found")
    _require_marketing_sample_owner(request, current_user)
    if _mockup_claimed_by_another_member(request, current_user):
        raise HTTPException(status_code=404, detail="Sample request not found")
    require_plant_access(current_user, request.get("target_plant"), service.db)

    rows = (
        service.db.query(SampleRequestActivityLog)
        .filter(SampleRequestActivityLog.sample_request_id == num_id)
        .order_by(SampleRequestActivityLog.created_at.desc(), SampleRequestActivityLog.id.desc())
        .limit(min(500, max(1, limit)))
        .all()
    )
    return [_serialize_sample_activity(row) for row in rows]


@router.get("/api/v1/sample-request-activity-logs", summary="Search preserved workflow history (Admin)")
def search_sample_request_activity_logs(
    sr_number: Optional[str] = None,
    limit: int = 200,
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    require_admin(current_user)
    query = service.db.query(SampleRequestActivityLog)
    if sr_number and sr_number.strip():
        query = query.filter(SampleRequestActivityLog.request_sr_number == sr_number.strip())
    rows = query.order_by(
        SampleRequestActivityLog.created_at.desc(), SampleRequestActivityLog.id.desc()
    ).limit(min(500, max(1, limit))).all()
    return [_serialize_sample_activity(row) for row in rows]


@router.post("/api/v1/sample-requests", status_code=status.HTTP_201_CREATED, summary="Create a single sample request")
@router.post("/api/sample-requests", status_code=status.HTTP_201_CREATED, summary="Create a single sample request (legacy alias)")
def create_sample_request(
    payload: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "marketing")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    _validate_marketing_draft_item(payload)
    _ensure_draft_key_owner(payload, service, current_user)
    existing_draft = service.db.query(CreateSampleRequest).filter(
        CreateSampleRequest.client_draft_key == (str(payload.get("client_draft_key") or "").strip() or None)
    ).first() if payload.get("client_draft_key") else None
    old_request_types = list(existing_draft.request_types or []) if existing_draft else []
    payload["created_by"] = _marketing_actor(current_user)
    payload["created_by_user_id"] = current_user.id
    payload["actor_user_id"] = current_user.id
    payload["actor_name"] = _marketing_actor(current_user)
    payload["target_plant"] = _marketing_request_plant(service)
    _validate_sample_design_count(payload)
    _prepare_mockup_intake_state(payload)
    _validate_new_mockup_design(payload)
    _validate_mockup_route(payload)
    created = service.create(payload)

    # Sync to design requests if request involves design
    request_types = payload.get("request_types") or []
    if "design" in old_request_types and "design" not in request_types:
        design_service.sync_sample_request(created, is_delete=True)
    elif "design" in request_types:
        sync_payload = {**payload, **created}
        design_service.sync_sample_request(sync_payload)

    return {"success": True, "message": "Sample request created successfully", "data": created}


@router.post("/api/v1/sample-requests/batch", status_code=status.HTTP_201_CREATED, summary="Batch create multiple sample requests")
@router.post("/api/sample-requests/batch", status_code=status.HTTP_201_CREATED, summary="Batch create multiple sample requests (legacy alias)")
def create_sample_requests_batch(
    body: Any = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "marketing")
    if isinstance(body, list):
        normalized_items = [item for item in body if isinstance(item, dict)]
        if len(normalized_items) != len(body):
            raise HTTPException(status_code=422, detail="Every batch item must be an object")
    elif isinstance(body, dict):
        items = body.get("requests") or body.get("items", [])
        if not items or not isinstance(items, list):
            raise HTTPException(status_code=422, detail="Expected 'requests' or 'items' array in payload")
        shared_fields = {
            key: value for key, value in body.items() if key not in {"requests", "items"}
        }
        normalized_items = [
            {**shared_fields, **item} for item in items if isinstance(item, dict)
        ]
        if len(normalized_items) != len(items):
            raise HTTPException(status_code=422, detail="Every batch item must be an object")
    else:
        raise HTTPException(status_code=422, detail="Payload must be a list or object with requests array")

    old_request_types_by_key: Dict[str, List[str]] = {}
    for item in normalized_items:
        _validate_marketing_draft_item(item)
        _ensure_draft_key_owner(item, service, current_user)
        draft_key = str(item.get("client_draft_key") or "").strip()
        if draft_key:
            existing = service.db.query(CreateSampleRequest).filter(
                CreateSampleRequest.client_draft_key == draft_key
            ).first()
            if existing:
                old_request_types_by_key[draft_key] = list(existing.request_types or [])
        item["created_by"] = _marketing_actor(current_user)
        item["created_by_user_id"] = current_user.id
        item["actor_user_id"] = current_user.id
        item["actor_name"] = _marketing_actor(current_user)
        item["target_plant"] = _marketing_request_plant(service)
        _validate_sample_design_count(item)
        _prepare_mockup_intake_state(item)
        _validate_new_mockup_design(item)
        _validate_mockup_route(item)
    created_results = service.batch_create(normalized_items)

    # Sync any design-scoped items with original input fields
    for idx, item in enumerate(created_results):
        req_types = item.get("request_types") or []
        raw_input = normalized_items[idx] if idx < len(normalized_items) else {}
        draft_key = str(raw_input.get("client_draft_key") or "").strip()
        old_types = old_request_types_by_key.get(draft_key, [])
        if "design" in old_types and "design" not in req_types:
            design_service.sync_sample_request(item, is_delete=True)
        elif "design" in req_types:
            sync_payload = {**raw_input, **item}
            design_service.sync_sample_request(sync_payload)

    return {
        "success": True,
        "count": len(created_results),
        "results": created_results,
    }


@router.post("/api/v1/sample-requests/search-materials", summary="Search products by material code")
def search_materials_post(
    body: Dict[str, Any] = Body(default_factory=dict),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    query = body.get("query", "") if isinstance(body, dict) else ""
    return filter_plant_records(current_user, _filter_marketing_sample_owners(service.search_materials(query), current_user), service.db)


@router.put("/api/v1/sample-requests/{id}", summary="Update sample request (PUT)")
@router.put("/api/sample-requests/{id}", summary="Update sample request (PUT legacy alias)")
@router.patch("/api/v1/sample-requests/{id}", summary="Update sample request")
@router.patch("/api/sample-requests/{id}", summary="Update sample request (legacy alias)")
def update_sample_request(
    id: str,
    body: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "marketing")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    if not is_admin(current_user) and any(
        key in body
        for key in ("mockup_workflow_state", "mockupWorkflowState", "target_artwork_date_studio", "targetArtworkDateStudio")
    ):
        raise HTTPException(status_code=403, detail="Use the Creative/Studio workflow for team-owned mock-up and studio fields")

    num_id = int(id) if id.isdigit() else None
    if not num_id:
        req = service.repo.get_by_sr_number(id)
        if req:
            num_id = req.id

    if not num_id:
        raise HTTPException(status_code=404, detail="Sample request not found")

    existing = service.get_by_id(num_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Sample request not found")
    _require_marketing_sample_owner(existing, current_user)

    workflow_state_key = "mockup_workflow_state" if "mockup_workflow_state" in body else "mockupWorkflowState" if "mockupWorkflowState" in body else None
    if workflow_state_key:
        old_state = _mockup_route_state(existing)
        requested_state = body.get(workflow_state_key)
        if not isinstance(requested_state, dict):
            raise HTTPException(status_code=422, detail="Mockup workflow details must be an object.")
        old_stage = old_state.get("stage", "marketing")
        if requested_state.get("stage", old_stage) != old_stage:
            raise HTTPException(status_code=409, detail="Mockup stages can only change through the workflow handoff actions.")
        route_keys = (
            "designNeeded", "design_needed",
            "marketingShutterstockNo", "marketing_shutterstock_no",
            "marketingRemark", "marketing_remark",
            "requiredDate", "required_date", "qtyForMockup", "qty_for_mockup",
        )
        route_changed = any(requested_state.get(key) != old_state.get(key) for key in route_keys)
        if old_stage not in {"marketing", "awaiting_design_acceptance"} and route_changed:
            raise HTTPException(status_code=409, detail="Marketing routing details are locked after the Mockup request is released.")
        requested_state["events"] = list(old_state.get("events") or [])
        body[workflow_state_key] = requested_state

    merged_payload = {**existing, **body}
    if any(key in body for key in ("creation_mode", "creationMode", "request_types", "requestTypes", "mockup_workflow_state", "mockupWorkflowState", "mockup_required", "mockupRequired")):
        _validate_new_mockup_design(merged_payload)
        _validate_mockup_route(merged_payload)

    old_types = existing.get("request_types") or []
    requested_types = body.get("request_types", body.get("requestTypes", old_types))
    if not isinstance(requested_types, list):
        raise HTTPException(status_code=422, detail="Request types must be a list")
    current_design = design_service.repo.get_model_by_sr_number(existing.get("sr_number"))
    if "design" in old_types and "design" not in requested_types and current_design:
        if not str(current_design.status or "").casefold().startswith("draft") or current_design.creative_submissions:
            raise HTTPException(status_code=409, detail="An active design workflow cannot be removed from its sample request")

    raw_design_count = body.get("number_of_designs", body.get("numberOfDesigns", body.get("product_artwork_nos")))
    if raw_design_count not in (None, "") and "design" in requested_types:
        try:
            requested_design_count = int(raw_design_count)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="Number of designs must be an integer")
        if not 1 <= requested_design_count <= 100:
            raise HTTPException(status_code=422, detail="Request between 1 and 100 artwork variants")
        if current_design and requested_design_count != int(current_design.number_of_designs or 0):
            if not str(current_design.status or "").casefold().startswith("draft") or current_design.creative_submissions:
                raise HTTPException(status_code=409, detail="Artwork count can only be changed before the request is released")

    update_payload = {
        **body,
        "actor_user_id": current_user.id,
        "actor_name": getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Marketing",
        "actor_department": _actor_team_label(current_user),
    }
    updated = service.update(num_id, update_payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Sample request not found")

    req_types = updated.get("request_types") or []
    if "design" in old_types and "design" not in req_types:
        design_service.sync_sample_request(existing, is_delete=True)
    elif "design" in req_types:
        sync_payload = {**body, **updated}
        design_service.sync_sample_request(sync_payload)

    return updated


@router.post("/api/v1/sample-requests/batch-status", summary="Batch update status")
def batch_update_status(
    body: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user = Depends(get_current_user),
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
    status_key = str(new_status).strip().casefold()
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

    candidates = {record.id: service.serialize(record) for record in records}
    now = datetime.now(timezone.utc)
    try:
        if status_key in {"creative", "studio"}:
            for request_id in numeric_ids:
                candidate = candidates[request_id]
                state = candidate.get("mockup_workflow_state") or {}
                is_mockup = "mockup" in (candidate.get("request_types") or []) or str(candidate.get("mockup_required") or "").casefold() == "yes"
                if status_key == "studio" and not is_mockup:
                    raise HTTPException(status_code=422, detail="Only a Mockup request can be released directly to Studio.")
                if is_mockup and state.get("stage") == "awaiting_design_acceptance":
                    raise HTTPException(status_code=409, detail="This Mockup is waiting for Marketing to accept its Design output.")
                if is_mockup:
                    design_needed = state.get("designNeeded", state.get("design_needed"))
                    if status_key == "creative" and design_needed is False:
                        state["creativeChangesRequired"] = True
                        candidate["mockup_workflow_state"] = state
                    _validate_mockup_route(candidate)
                    if status_key == "studio" and design_needed is True:
                        raise HTTPException(status_code=422, detail="This Mockup request needs Design and must be released to Creative first.")
                    if status_key == "studio" and design_needed is not False:
                        raise HTTPException(status_code=422, detail="Choose No Design and provide a Shutterstock number or remark before releasing to Studio.")
                if is_mockup and state.get("stage", "marketing") in {None, "marketing"}:
                    _validate_mockup_required_date(state, now)
    except Exception:
        db.rollback()
        raise
    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Marketing")
    try:
        for record in records:
            updated_request = candidates[record.id]
            previous_status = record.status
            record.status = str(new_status).strip()
            record.updated_at = now
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
            is_mockup = (
                "mockup" in (updated_request.get("request_types") or [])
                or str(updated_request.get("mockup_required") or "").casefold() == "yes"
            )
            has_sampling_scope = "sample" in (updated_request.get("request_types") or [])
            release_mockup_owner = status_key in {"creative", "studio"} or (
                status_key == "sampling review (pmt)" and has_sampling_scope
            )
            if is_mockup and release_mockup_owner:
                state = dict(record.mockup_workflow_state or {})
                if state.get("stage") in {None, "marketing"}:
                    if state.get("stage") in {None, "marketing"}:
                        design_needed = state.get("designNeeded", state.get("design_needed"))
                        if status_key == "creative":
                            state["creativeChangesRequired"] = design_needed is False or bool(state.get("creativePendingCharacteristicKeys"))
                            requested_stage = "creative"
                        elif status_key == "studio":
                            requested_stage = "studio"
                        else:
                            requested_stage = "creative" if _mockup_requires_design(state) or state.get("creativeChangesRequired") else "studio"
                        _initialize_mockup_release_dates(state, requested_stage, now)
                    events = list(state.get("events") or [])
                    design_needed = state.get("designNeeded", state.get("design_needed"))
                    needs_creative = _mockup_requires_design(state) or bool(state.get("creativeChangesRequired"))
                    if status_key == "studio" or (status_key != "creative" and not needs_creative):
                        next_stage = "studio"
                        event_action = "MOCKUP_RELEASED_TO_STUDIO"
                        event_title = "Mockup request released directly to Studio"
                        release_field = "releasedToStudioAt"
                    else:
                        # Legacy Mockup drafts without a stored choice are safely
                        # routed through Creative instead of bypassing its review.
                        next_stage = "creative"
                        event_action = "MOCKUP_RELEASED_TO_CREATIVE"
                        event_title = "Mockup request released to Creative for Design review"
                        release_field = "releasedToCreativeAt"
                    if not state.get(release_field):
                        events.append({
                            "action": event_action,
                            "title": event_title,
                            "actorName": actor,
                            "actorDepartment": "Marketing",
                            "timestamp": now.isoformat(),
                        })
                        _record_sample_activity(
                            service, record, current_user, event_action, "Marketing",
                            payload={"stage": next_stage, "design_needed": design_needed},
                            from_status=previous_status,
                            to_status=record.status,
                        )
                    if next_stage == "creative" and not state.get("creativeCharacteristicsClearedAt"):
                        creative_fields, required_fields = _clear_mockup_creative_characteristics(
                            record, db, state.get("creativePendingCharacteristicKeys")
                        )
                        state["creativeCharacteristicKeys"] = creative_fields
                        state["creativeRequiredCharacteristicKeys"] = required_fields
                        state["creativeCharacteristicsClearedAt"] = now.isoformat()
                    state.update({"stage": next_stage, release_field: state.get(release_field) or now.isoformat(), "events": events[-100:]})
                    record.mockup_workflow_state = state
        db.commit()
    except Exception:
        db.rollback()
        raise

    for record in records:
        updated_request = service.serialize(record)
        if "design" in (updated_request.get("request_types") or []):
            design_service.sync_sample_request(updated_request)

    updated_count = len(records)
    return {"success": True, "updated_count": updated_count}


def _mockup_actor(current_user: Any, body: Dict[str, Any]) -> str:
    return str(
        getattr(current_user, "name", None)
        or getattr(current_user, "userid", None)
        or body.get("actor_name")
        or ""
    ).strip()


def _actor_team_label(current_user: Any) -> str:
    """Return the authenticated user's workflow team for audit labels."""
    if user_has_team(current_user, "marketing"):
        return "Marketing"
    if user_has_team(current_user, "samp"):
        return "SAMP Team"
    if user_has_team(current_user, "plant"):
        return "Plant"
    if user_has_team(current_user, "creative_studio"):
        return "Creative Studio"
    return "Admin"


def _record_sample_activity(
    service: SampleRequestService,
    record: CreateSampleRequest,
    current_user: Any,
    action: str,
    department: str,
    payload: Optional[Dict[str, Any]] = None,
    from_status: Optional[str] = None,
    to_status: Optional[str] = None,
) -> None:
    service.add_activity_log(
        record,
        action=action,
        actor_id=getattr(current_user, "id", None),
        actor_name=getattr(current_user, "name", None) or getattr(current_user, "userid", None),
        actor_department=department,
        from_status=from_status,
        to_status=to_status,
        payload=payload,
    )


def _serialize_sample_activity(row: SampleRequestActivityLog) -> Dict[str, Any]:
    return {
        "id": row.id,
        "sample_request_id": row.sample_request_id,
        "sr_number": row.request_sr_number,
        "actor_user_id": row.actor_user_id,
        "actor_name": row.actor_name,
        "actor_department": row.actor_department,
        "action": row.action,
        "from_status": row.from_status,
        "to_status": row.to_status,
        "payload": row.payload or {},
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _require_mockup_request(sample: Dict[str, Any]) -> Dict[str, Any]:
    request_types = sample.get("request_types") or []
    is_mockup = "mockup" in request_types or str(sample.get("mockup_required") or "").casefold() == "yes"
    if not is_mockup:
        raise HTTPException(status_code=409, detail="This request does not include a mockup deliverable")
    state = sample.get("mockup_workflow_state") or {}
    return state if isinstance(state, dict) else {}


def _mockup_requires_design(state: Dict[str, Any]) -> bool:
    if state.get("creativeChangesRequired") is True:
        return True
    decision = state.get("designNeeded", state.get("design_needed"))
    if decision is False:
        return False
    if isinstance(decision, str) and decision.strip().casefold() in {"false", "no", "0"}:
        return False
    return True


def _require_mockup_stage_claim(state: Dict[str, Any], current_user: Any, stage: str) -> None:
    if is_admin(current_user):
        return
    if is_team_head(current_user):
        raise HTTPException(status_code=403, detail="Team heads have read-only access to mockup tasks.")
    if state.get("stage") != stage or state.get("claimedStage") != stage or not state.get("claimedBy"):
        raise HTTPException(status_code=409, detail="Claim this mockup task before continuing")
    claimed_by_id = state.get("claimedByUserId")
    if claimed_by_id is not None:
        if claimed_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the assigned Creative Studio member can continue this mockup task")
        return
    actor_names = {
        str(value).strip().casefold()
        for value in (getattr(current_user, "name", None), getattr(current_user, "userid", None))
        if value
    }
    if str(state.get("claimedBy") or "").strip().casefold() not in actor_names:
        raise HTTPException(status_code=403, detail="Only the assigned Creative Studio member can continue this mockup task")


def _clear_mockup_stage_claim(state: Dict[str, Any]) -> None:
    for key in ("claimedBy", "claimedByUserId", "claimedAt", "claimedStage"):
        state.pop(key, None)


@router.post("/api/v1/sample-requests/{sample_id}/mockup/claim", summary="Claim a Creative or Studio mockup task")
def claim_mockup_request(
    sample_id: int,
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")
    sample = service.serialize(record)
    state = dict(_require_mockup_request(sample))
    stage = state.get("stage")
    if is_team_head(current_user) and not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Team heads have read-only access to mockup tasks.")
    if stage not in {"creative", "studio", "creative_approval"}:
        raise HTTPException(status_code=409, detail="This mockup request is not waiting for Creative or Studio")
    if stage == "studio" and state.get("studioEarliestStartDate"):
        earliest = _parse_mockup_date(state.get("studioEarliestStartDate"), "Studio earliest start date")
        if _mockup_today() < earliest:
            raise HTTPException(status_code=409, detail=f"Studio work can start on {earliest.isoformat()} or later.")
    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Creative Studio").strip()[:100]
    claimed_by = str(state.get("claimedBy") or "").strip()
    claimed_stage = state.get("claimedStage")
    claimed_by_id = state.get("claimedByUserId")
    changed = False
    now = datetime.now(timezone.utc).isoformat()
    if stage == "creative" and "creativeCharacteristicKeys" not in state:
        fields, required = _clear_mockup_creative_characteristics(record, service.db, state.get("creativePendingCharacteristicKeys"))
        state["creativeCharacteristicKeys"] = fields
        state["creativeRequiredCharacteristicKeys"] = required
        state["creativeCharacteristicsClearedAt"] = now
        events = list(state.get("events") or [])
        events.append({
            "action": "MOCKUP_CREATIVE_FIELDS_PREPARED",
            "title": "Creative fields cleared and highlighted for completion",
            "actorName": "System",
            "actorDepartment": "System",
            "timestamp": now,
        })
        state["events"] = events[-100:]
        _record_sample_activity(service, record, current_user, "MOCKUP_CREATIVE_FIELDS_PREPARED", "System", payload={"field_count": len(fields), "required_count": len(required)})
        changed = True
    if claimed_stage == stage and claimed_by:
        is_same_owner = claimed_by_id == current_user.id if claimed_by_id is not None else claimed_by.casefold() == actor.casefold()
        if not is_same_owner:
            raise HTTPException(status_code=409, detail=f"This task is already claimed by {claimed_by}")
    else:
        state.update({
            "claimedBy": actor,
            "claimedByUserId": current_user.id,
            "claimedAt": now,
            "claimedStage": stage,
        })
        events = list(state.get("events") or [])
        events.append({
            "action": "MOCKUP_TASK_CLAIMED",
            "title": f"Mockup task claimed in {stage.title()}",
            "actorName": actor,
            "actorDepartment": "Creative Studio",
            "timestamp": now,
        })
        state["events"] = events[-100:]
        _record_sample_activity(
            service, record, current_user, "MOCKUP_TASK_CLAIMED", "Creative Studio",
            payload={"stage": stage},
        )
        changed = True
    if changed:
        record.mockup_workflow_state = state
        record.updated_at = datetime.now(timezone.utc)
        service.db.commit()
        service.db.refresh(record)
    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/mockup/send-to-studio", summary="Send a mockup request from Creative to Studio")
def send_mockup_request_to_studio(
    sample_id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")
    sample = service.serialize(record)
    state = _require_mockup_request(sample)
    if state.get("stage") != "creative":
        raise HTTPException(status_code=409, detail="This mockup request is not waiting for Creative review")
    state = dict(state)
    _require_mockup_stage_claim(state, current_user, "creative")
    if _mockup_requires_design(state):
        if state.get("creativeDateDecision") not in {"confirmed", "proposed"} or not state.get("creativeInputDate"):
            raise HTTPException(status_code=422, detail="Confirm or propose the Creative input date before sending this Mockup to Studio.")
        earliest_studio_date = _parse_mockup_date(
            state.get("studioEarliestStartDate"), "Studio earliest start date"
        )
        if _mockup_today() < earliest_studio_date:
            raise HTTPException(status_code=409, detail=f"Studio work can start on {earliest_studio_date.isoformat()} or later.")
        creative_shutterstock = str(body.get("creative_shutterstock_no") or body.get("creativeShutterstockNo") or "").strip()
        creative_remark = str(body.get("creative_remark") or body.get("creativeRemark") or "").strip()
        if not creative_shutterstock and not creative_remark:
            raise HTTPException(status_code=422, detail="Add a Creative Shutterstock number or remark before sending this Mockup to Studio.")
        if len(creative_shutterstock) > 100 or len(creative_remark) > 1000:
            raise HTTPException(status_code=422, detail="Shutterstock number must be 100 characters or fewer and remark 1,000 characters or fewer.")

        required_keys = state.get("creativeRequiredCharacteristicKeys")
        if required_keys is None:
            required_keys = state.get("creativeCharacteristicKeys") or []
        if required_keys:
            empty_characteristic_values = {"", "NA", "N/A", "NAN", "NULL", "NONE", "-"}
            values_by_key = {
                (_normalize_binding(detail.class_name), _normalize_binding(detail.characteristic_name)): str(detail.value or "").strip().upper()
                for detail in record.product_details
            }
            incomplete = [
                item for item in required_keys
                if values_by_key.get((
                    _normalize_binding(item.get("className") or item.get("class_name")),
                    _normalize_binding(item.get("characteristicName") or item.get("characteristic_name")),
                )) in empty_characteristic_values
            ]
            if incomplete:
                raise HTTPException(status_code=422, detail=f"Creative must complete all {len(incomplete)} highlighted characteristic field(s) before sending to Studio.")
        state.update({
            "creativeShutterstockNo": creative_shutterstock,
            "creativeRemark": creative_remark,
        })
    actor = _mockup_actor(current_user, body if isinstance(body, dict) else {}) or "Creative Studio"
    now = datetime.now(timezone.utc).isoformat()
    events = list(state.get("events") or [])
    events.append({
        "action": "MOCKUP_SENT_TO_STUDIO",
        "title": "Creative sent the mockup brief to Studio",
        "actorName": actor,
        "actorDepartment": "Creative Studio",
        "timestamp": now,
    })
    state.update({"stage": "studio", "sentToStudioAt": now, "sentToStudioBy": actor, "events": events[-100:]})
    _clear_mockup_stage_claim(state)
    previous_status = record.status
    record.status = "Studio"
    record.mockup_workflow_state = state
    record.updated_at = datetime.now(timezone.utc)
    _record_sample_activity(
        service, record, current_user, "MOCKUP_SENT_TO_STUDIO", "Creative Studio",
        payload={
            "creative_shutterstock_no": state.get("creativeShutterstockNo"),
            "creative_remark": state.get("creativeRemark"),
        },
        from_status=previous_status,
        to_status=record.status,
    )
    service.db.commit()
    service.db.refresh(record)
    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/mockup/creative-date", summary="Confirm or propose the Creative input date")
def set_mockup_creative_date(
    sample_id: int,
    body: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")
    state = dict(_require_mockup_request(service.serialize(record)))
    if state.get("stage") != "creative":
        raise HTTPException(status_code=409, detail="This mockup is not waiting for Creative input.")
    _require_mockup_stage_claim(state, current_user, "creative")
    decision = str(body.get("decision") or "").strip().lower()
    if decision not in {"confirmed", "proposed"}:
        raise HTTPException(status_code=422, detail="Choose Confirmed or Proposed for the Creative input date.")
    chosen = _parse_mockup_date(body.get("date"), "Creative input date")
    today = _mockup_today()
    required = _parse_mockup_date(state.get("requiredDate"), "Mockup required date")
    system_date = _parse_mockup_date(state.get("creativeSystemRequiredDate"), "System Creative date")
    if chosen < today or chosen >= required:
        raise HTTPException(status_code=422, detail="Creative input date must be today or later and at least one day before the Marketing required date.")
    if decision == "confirmed" and chosen != system_date:
        raise HTTPException(status_code=422, detail=f"Confirm the system date {system_date.isoformat()} or choose Proposed.")
    if decision == "proposed" and chosen == system_date:
        raise HTTPException(status_code=422, detail="Choose Confirmed when keeping the system date.")

    now = datetime.now(timezone.utc)
    due = _mockup_datetime(state.get("creativeDateDecisionDueAt"))
    late = bool(due and now > due)
    actor = _mockup_actor(current_user, body) or "Creative"
    state.update({
        "creativeDateDecision": decision,
        "creativeInputDate": chosen.isoformat(),
        "creativeConfirmedDate": chosen.isoformat() if decision == "confirmed" else None,
        "creativeProposedDate": chosen.isoformat() if decision == "proposed" else None,
        "creativeDateDecisionAt": now.isoformat(),
        "creativeDateDecisionLate": late,
        "studioEarliestStartDate": (chosen + timedelta(days=1)).isoformat(),
    })
    events = list(state.get("events") or [])
    events.append({
        "action": "CREATIVE_DATE_DECIDED",
        "title": f"Creative input date {decision}: {chosen.isoformat()}",
        "actorName": actor,
        "actorDepartment": "Creative",
        "timestamp": now.isoformat(),
    })
    state["events"] = events[-100:]
    record.mockup_workflow_state = state
    record.updated_at = now
    _record_sample_activity(service, record, current_user, "CREATIVE_DATE_DECIDED", "Creative", payload={"decision": decision, "date": chosen.isoformat(), "late": late})
    service.db.commit()
    service.db.refresh(record)
    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/mockup/creative-approval", summary="Creative approves or returns Studio mockup output")
def decide_mockup_creative_approval(
    sample_id: int,
    body: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")
    state = dict(_require_mockup_request(service.serialize(record)))
    if state.get("stage") != "creative_approval":
        raise HTTPException(status_code=409, detail="This mockup is not waiting for Creative approval.")
    _require_mockup_stage_claim(state, current_user, "creative_approval")
    decision = str(body.get("decision") or "").strip().lower()
    remark = str(body.get("remark") or "").strip()
    if decision not in {"accept", "request_revision"}:
        raise HTTPException(status_code=422, detail="Choose Accept or Request revision.")
    if decision == "request_revision" and not remark:
        raise HTTPException(status_code=422, detail="Add a note explaining the requested revision.")
    if len(remark) > 1000:
        raise HTTPException(status_code=422, detail="Revision note must be 1,000 characters or fewer.")
    now = datetime.now(timezone.utc).isoformat()
    actor = _mockup_actor(current_user, body) or "Creative"
    approval_due = _mockup_datetime(state.get("creativeApprovalDueAt"))
    approval_late = bool(approval_due and datetime.now(timezone.utc) > approval_due)
    next_stage = "awaiting_marketing_acceptance" if decision == "accept" else "studio"
    action = "CREATIVE_APPROVED_MOCKUP" if decision == "accept" else "CREATIVE_REQUESTED_STUDIO_REVISION"
    title = "Creative approved Studio output" if decision == "accept" else "Creative returned output to Studio for revision"
    state.update({"stage": next_stage, "creativeApprovalDecision": decision, "creativeApprovalActualAt": now, "creativeApprovalLate": approval_late})
    if decision == "accept":
        state["creativeApprovedAt"] = now
        state.pop("creativeRevisionRemark", None)
    else:
        state["creativeRevisionRemark"] = remark
        state["creativeRevisionRequestedAt"] = now
    events = list(state.get("events") or [])
    events.append({"action": action, "title": title, "actorName": actor, "actorDepartment": "Creative", "timestamp": now, "remark": remark or None})
    state["events"] = events[-100:]
    _clear_mockup_stage_claim(state)
    previous_status = record.status
    record.mockup_workflow_state = state
    record.status = "Awaiting Marketing Mockup Acceptance" if decision == "accept" else "Studio Revision Requested"
    record.updated_at = datetime.now(timezone.utc)
    _record_sample_activity(service, record, current_user, action, "Creative", payload={"decision": decision, "remark": remark, "late": approval_late}, from_status=previous_status, to_status=record.status)
    service.db.commit()
    service.db.refresh(record)
    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/mockup/marketing-decision", summary="Accept or return Creative-approved mockup")
def decide_mockup_marketing_acceptance(
    sample_id: int,
    body: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "marketing")
    if is_team_head(current_user) and not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Team heads have read-only access to mockup acceptance.")
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")
    sample = service.serialize(record)
    _require_marketing_sample_owner(sample, current_user)
    state = dict(_require_mockup_request(sample))
    if state.get("stage") != "awaiting_marketing_acceptance":
        raise HTTPException(status_code=409, detail="This mockup is not waiting for Marketing acceptance.")
    decision = str(body.get("decision") or "").strip().lower()
    remark = str(body.get("remark") or "").strip()
    if decision not in {"accept", "request_revision"}:
        raise HTTPException(status_code=422, detail="Choose Accept or Request revision.")
    if decision == "request_revision" and not remark:
        raise HTTPException(status_code=422, detail="Add a note explaining the requested revision.")
    if len(remark) > 1000:
        raise HTTPException(status_code=422, detail="Revision note must be 1,000 characters or fewer.")
    now = datetime.now(timezone.utc).isoformat()
    actor = _mockup_actor(current_user, body) or "Marketing"
    has_sampling = "sample" in (sample.get("request_types") or [])
    next_stage = "done" if decision == "accept" else "studio"
    action = "MARKETING_ACCEPTED_MOCKUP" if decision == "accept" else "MARKETING_REQUESTED_STUDIO_REVISION"
    title = "Marketing accepted mockup; deliverable closed" if decision == "accept" else "Marketing requested a Studio revision"
    state.update({"stage": next_stage, "marketingDecision": decision, "marketingDecisionAt": now})
    if decision == "accept":
        state["marketingAcceptedAt"] = now
        state.pop("marketingRevisionRemark", None)
        record.status = "Sampling Review (PMT)" if has_sampling else "Approved / Closed"
    else:
        state["marketingRevisionRemark"] = remark
        state["studioRevisionRequestedAt"] = now
        record.status = "Studio Revision Requested"
    events = list(state.get("events") or [])
    events.append({"action": action, "title": title, "actorName": actor, "actorDepartment": "Marketing", "timestamp": now, "remark": remark or None})
    state["events"] = events[-100:]
    _clear_mockup_stage_claim(state)
    record.mockup_workflow_state = state
    record.updated_at = datetime.now(timezone.utc)
    _record_sample_activity(service, record, current_user, action, "Marketing", payload={"decision": decision, "remark": remark, "scope_closed": decision == "accept", "sampling_remains_open": decision == "accept" and has_sampling})
    service.db.commit()
    service.db.refresh(record)
    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/mockup/submit", summary="Submit a Studio mockup link to Creative for approval")
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
    sample = service.serialize(record)
    state = _require_mockup_request(sample)
    stage = state.get("stage")
    if stage != "studio":
        raise HTTPException(status_code=409, detail="This deliverable is not waiting for Studio")
    state = dict(state)
    _require_mockup_stage_claim(state, current_user, "studio")
    mockup_url = str(body.get("mockup_url") or body.get("mockupUrl") or "").strip()
    if not mockup_url or len(mockup_url) > 2048:
        raise HTTPException(status_code=422, detail="Enter a valid mockup link or file path")
    parsed_url = urlsplit(mockup_url)
    is_web_url = parsed_url.scheme in {"http", "https"} and bool(parsed_url.netloc)
    is_file_path = (
        parsed_url.scheme == "file"
        or mockup_url.startswith(("\\\\", "//"))
        or (len(mockup_url) > 2 and mockup_url[1] == ":" and mockup_url[2] in ("\\", "/"))
        or (("/" in mockup_url or "\\" in mockup_url) and not parsed_url.scheme)
    )
    if not (is_web_url or is_file_path):
        raise HTTPException(status_code=422, detail="Enter a valid link (http/https) or file path")
    actor = _mockup_actor(current_user, body) or "Studio"
    previous_status = record.status
    now = datetime.now(timezone.utc).isoformat()
    events = list(state.get("events") or [])
    events.append({
        "action": "STUDIO_OUTPUT_SUBMITTED",
        "title": "Studio sent output link or file path",
        "actorName": actor,
        "actorDepartment": "Studio",
        "timestamp": now,
        "mockupUrl": mockup_url,
    })
    state.update({
        "stage": "creative_approval",
        "mockupUrl": mockup_url,
        "studioSubmittedAt": now,
        "submittedToCreativeAt": now,
        "submittedToCreativeBy": actor,
        "creativeApprovalDueAt": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "events": events[-100:],
    })
    for key in ("creativeRevisionRemark", "marketingRevisionRemark", "creativeApprovalDecision", "marketingDecision"):
        state.pop(key, None)
    _clear_mockup_stage_claim(state)
    record.mockup_workflow_state = state
    record.status = "Creative Mockup Approval"
    record.updated_at = datetime.now(timezone.utc)
    _record_sample_activity(
        service, record, current_user, "STUDIO_OUTPUT_SUBMITTED", "Studio",
        payload={"mockup_url": mockup_url},
        from_status=previous_status,
        to_status=record.status,
    )
    service.db.commit()
    service.db.refresh(record)
    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/release-to-plant", summary="Sampling team releases sample to plant")
def release_sample_to_plant(
    sample_id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_any_team(current_user, ("samp", "admin"))
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")

    target_plant = str(body.get("target_plant") or body.get("targetPlant") or record.target_plant or "Khaniwade").strip()
    sampling_remark = str(body.get("sampling_remark") or body.get("samplingRemark") or "").strip()
    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Sampling Specialist"
    now = datetime.now(timezone.utc).isoformat()

    state = dict(record.mockup_workflow_state or {})
    events = list(state.get("events") or [])
    events.append({
        "action": "SAMPLE_RELEASED_TO_PLANT",
        "title": f"Sample released to plant ({target_plant})",
        "actorName": actor,
        "actorDepartment": "Sampling Team",
        "timestamp": now,
        "targetPlant": target_plant,
        "samplingRemark": sampling_remark,
    })
    state.update({
        "plantReleasedAt": now,
        "plantReleasedBy": actor,
        "plantReleaseTarget": target_plant,
        "samplingRemark": sampling_remark,
        "events": events[-100:],
    })

    previous_status = record.status
    record.status = "Released to Plant"
    record.target_plant = target_plant
    record.mockup_workflow_state = state
    record.updated_at = datetime.now(timezone.utc)
    _record_sample_activity(
        service, record, current_user, "SAMPLE_RELEASED_TO_PLANT", "SAMP Team",
        payload={"target_plant": target_plant, "sampling_remark": sampling_remark},
        from_status=previous_status,
        to_status=record.status,
    )
    service.db.commit()
    service.db.refresh(record)
    return service.serialize(record)


@router.post("/api/v1/sample-requests/{sample_id}/sampling-feedback", summary="Sampling team adds technical feedback")
def add_sampling_feedback(
    sample_id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_any_team(current_user, ("samp", "admin"))
    record = service.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).with_for_update().first()
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")

    feedback = str(body.get("feedback") or body.get("sampling_remark") or body.get("samplingRemark") or "").strip()
    if not feedback:
        raise HTTPException(status_code=422, detail="Feedback text is required")

    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Sampling Specialist"
    now = datetime.now(timezone.utc).isoformat()

    state = dict(record.mockup_workflow_state or {})
    events = list(state.get("events") or [])
    events.append({
        "action": "SAMPLING_FEEDBACK_ADDED",
        "title": "Sampling review feedback recorded",
        "actorName": actor,
        "actorDepartment": "Sampling Team",
        "timestamp": now,
        "body": feedback,
    })
    state.update({
        "samplingFeedback": feedback,
        "samplingFeedbackAt": now,
        "samplingFeedbackBy": actor,
        "events": events[-100:],
    })
    record.mockup_workflow_state = state
    record.updated_at = datetime.now(timezone.utc)
    _record_sample_activity(
        service, record, current_user, "SAMPLING_FEEDBACK_ADDED", "SAMP Team",
        payload={"feedback": feedback},
    )
    service.db.commit()
    service.db.refresh(record)
    return service.serialize(record)


@router.delete("/api/v1/sample-requests/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete sample request")
@router.delete("/api/sample-requests/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete sample request (legacy alias)")
def delete_sample_request(
    id: str,
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user = Depends(get_current_user),
):
    require_admin(current_user)
    num_id = int(id) if id.isdigit() else None
    if not num_id:
        req = service.repo.get_by_sr_number(id)
        if req:
            num_id = req.id

    if not num_id:
        raise HTTPException(status_code=404, detail="Sample request not found")

    record = service.repo.get_for_update(num_id, include_product_details=False)
    if not record:
        raise HTTPException(status_code=404, detail="Sample request not found")
    existing_sr_number = record.sr_number
    linked_feasibility_id = service.db.query(FeasibilityRequest.id).filter(
        FeasibilityRequest.converted_sample_request_id == num_id
    ).scalar()
    if linked_feasibility_id:
        raise HTTPException(
            status_code=409,
            detail="This sample request is linked to an accepted Feasibility request and cannot be deleted.",
        )
    if "design" in (record.request_types or []):
        linked_design = design_service.repo.get_model_by_sr_number(existing_sr_number)
        if linked_design:
            service.db.delete(linked_design)
    service.add_activity_log(
        record,
        action="REQUEST_DELETED",
        actor_id=getattr(current_user, "id", None),
        actor_name=getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Admin",
        actor_department="Admin",
        from_status=record.status,
        payload={
            "sr_number": record.sr_number,
            "material_code": record.material_code,
            "customer": record.customer,
            "request_types": list(record.request_types or []),
        },
    )
    service.db.flush()
    if not service.delete(num_id):
        raise HTTPException(status_code=404, detail="Sample request not found")

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Design Requests (/api/v1/design-requests)
# ---------------------------------------------------------------------------

@router.get("/api/v1/design-requests", response_model=List[Dict[str, Any]], summary="List design requests")
def list_design_requests(
    year: Optional[str] = None,
    draft_only: bool = False,
    service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    records = service.list_all(year=year, draft_only=draft_only)
    if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user):
        records = [row for row in records if row.get("created_by_user_id") == current_user.id]
    if user_has_team(current_user, "creative_studio") and not is_admin(current_user):
        actor_name = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "").casefold()
        open_statuses = {"creative", "creative remaining requested", "creative studio", "target date counter proposed"}
        visible = []
        for row in records:
            if str(row.get("status") or "").casefold() not in open_statuses:
                continue
            state = row.get("workflow_state") if isinstance(row.get("workflow_state"), dict) else {}
            claim_id = state.get("claimedByUserId")
            claim_name = str(state.get("claimedBy") or "").casefold()
            if not is_team_head(current_user) and not claim_id and claim_name and claim_name != actor_name:
                continue
            if not is_team_head(current_user) and claim_id and claim_id != current_user.id:
                continue
            visible.append(row)
        records = visible
    return filter_linked_plant_records(current_user, records, service.db)


def _design_workflow_state(record: Any) -> Dict[str, Any]:
    state = record.get("workflow_state") if isinstance(record, dict) else record.workflow_state
    return dict(state) if isinstance(state, dict) else {}


def _require_design_counter_window_open(record: Any) -> None:
    """Enforce the 48-hour window from Marketing's release, not an earlier draft save."""
    state = _design_workflow_state(record)
    raised_at = state.get("releasedAt") or state.get("released_at")
    if not raised_at:
        raised_at = record.get("created_at") if isinstance(record, dict) else record.created_at
    if isinstance(raised_at, str):
        try:
            raised_at = datetime.fromisoformat(raised_at.replace("Z", "+00:00"))
        except ValueError:
            raised_at = None
    if not isinstance(raised_at, datetime):
        raise HTTPException(status_code=409, detail="Marketing release time is unavailable for the 48-hour window")
    if raised_at.tzinfo is None:
        raised_at = raised_at.replace(tzinfo=timezone.utc)
    deadline = raised_at.astimezone(timezone.utc) + timedelta(hours=48)
    if datetime.now(timezone.utc) >= deadline:
        raise HTTPException(status_code=409, detail="The 48-hour claim and counter-date window from Marketing's release has expired")


def _append_design_event(
    state: Dict[str, Any],
    *,
    action: str,
    title: str,
    body: str,
    actor: str,
    department: str,
    badge_text: str = "Update",
    badge_variant: str = "neutral",
    is_note: bool = False,
) -> Dict[str, Any]:
    events = list(state.get("events") or [])
    events.insert(0, {
        "id": f"event-{uuid4().hex}",
        "actorName": actor,
        "actorDepartment": department,
        "action": action,
        "title": title,
        "body": body,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "isNote": is_note,
        "badge": {"text": badge_text, "variant": badge_variant},
    })
    state["events"] = events[:500]
    return state


def _get_design_workflow_record(id: int, service: DesignRequestService) -> Dict[str, Any]:
    record = service.get_by_id(id)
    if not record:
        raise HTTPException(status_code=404, detail="Design request not found")
    return record


@router.post("/api/v1/design-requests/{id}/claim", summary="Claim a Creative design request")
def claim_design_request(
    id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: DesignRequestService = Depends(get_design_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    body = body if isinstance(body, dict) else {}
    actor = str(
        getattr(current_user, "name", None)
        or getattr(current_user, "userid", None)
        or body.get("designer_name")
        or "Creative Designer"
    ).strip()[:100]

    def mutate(item):
        if item.status not in {"Creative", "Creative Remaining Requested", "Creative Studio", "Target Date Counter Proposed"}:
            raise HTTPException(status_code=409, detail="This design request is not available to Creative")
        state = _design_workflow_state(item)
        current_claim = str(state.get("claimedBy") or "")
        current_claim_id = state.get("claimedByUserId")
        if current_claim and current_claim_id and current_claim_id != current_user.id:
            raise HTTPException(status_code=409, detail=f"This task is already claimed by {current_claim}")
        if current_claim and not current_claim_id and current_claim.casefold() != actor.casefold():
            raise HTTPException(status_code=409, detail=f"This task is already claimed by {current_claim}")
        if not current_claim:
            _require_design_counter_window_open(item)
            now = datetime.now(timezone.utc).isoformat()
            state.update({"claimedBy": actor, "claimedByUserId": current_user.id, "claimedAt": now})
            _append_design_event(
                state, action="TASK_CLAIMED", title="Task claimed by Creative",
                body=f"{actor} claimed ownership of this design request.", actor=actor,
                department="Creative Studio", badge_text="Claimed", badge_variant="purple",
            )
            item.workflow_state = state

    saved = service.mutate(id, mutate)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.delete("/api/v1/design-requests/{id}/claim", summary="Reject release of an assigned Creative design request")
def release_design_request_claim(
    id: int,
):
    raise HTTPException(status_code=409, detail="A Creative claim cannot be released after assignment")


@router.post("/api/v1/design-requests/{id}/counter-date-proposal", summary="Propose a revised design target date")
def propose_design_counter_date(
    id: int,
    body: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    body = body if isinstance(body, dict) else {}
    proposed_date = str(body.get("proposed_date") or "").strip()
    reason = str(body.get("reason") or "").strip()[:500]
    if not proposed_date or not reason:
        raise HTTPException(status_code=422, detail="Proposed date and reason are required")
    try:
        proposed_day = datetime.strptime(proposed_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail="Proposed date must use YYYY-MM-DD format")
    actor = (
        getattr(current_user, "name", None)
        or getattr(current_user, "userid", None)
        or body.get("designer_name")
        or "Creative Designer"
    )

    def mutate(item):
        if item.status not in {"Creative", "Creative Remaining Requested", "Creative Studio", "Target Date Counter Proposed"}:
            raise HTTPException(status_code=409, detail="This design request is not in Creative work")
        state = _design_workflow_state(item)
        claimed_by = str(state.get("claimedBy") or "")
        if not claimed_by:
            raise HTTPException(status_code=409, detail="Claim this design request before proposing a new date")
        claimed_by_id = state.get("claimedByUserId")
        if (claimed_by_id and claimed_by_id != current_user.id) or (not claimed_by_id and actor and claimed_by.casefold() != str(actor).casefold()):
            raise HTTPException(status_code=403, detail="Only the assigned designer can propose a new date")
        if state.get("isCounterDateActive"):
            raise HTTPException(status_code=409, detail="A counter-date proposal is already awaiting Marketing")
        if (
            state.get("counterDateRequestedAt")
            or state.get("counter_date_requested_at")
            or state.get("proposedTargetDate")
            or state.get("proposed_target_date")
            or state.get("counterDateDecision")
            or state.get("counter_date_decision")
        ):
            raise HTTPException(status_code=409, detail="Only one counter-date proposal is allowed per design request")
        _require_design_counter_window_open(item)
        today = datetime.now(timezone.utc).date()
        if proposed_day <= today:
            raise HTTPException(status_code=422, detail="The revised date must be in the future")
        original_date = str(item.design_required_date or "").split("T", 1)[0]
        if original_date and proposed_date <= original_date:
            raise HTTPException(status_code=422, detail="Proposed date must be later than the original required date")
        now = datetime.now(timezone.utc).isoformat()
        state.update({
            "isCounterDateActive": True,
            "proposedTargetDate": proposed_date,
            "counterDateReason": reason,
            "counterDateRequestedAt": now,
            "counterDateRequestedBy": actor,
            "counterDateDecision": "pending",
        })
        _append_design_event(
            state, action="COUNTER_DATE_PROPOSED", title="Revised target date proposed",
            body=f"Proposed {proposed_date}. {reason}", actor=str(actor),
            department="Creative Studio", badge_text="Counter Date", badge_variant="amber",
        )
        item.workflow_state = state

    saved = service.mutate(id, mutate)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.post("/api/v1/design-requests/{id}/counter-date-decision", summary="Accept or reject a revised design target date")
def decide_design_counter_date(
    id: int,
    body: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "marketing")
    _require_marketing_design_owner(id, service, current_user)
    body = body if isinstance(body, dict) else {}
    decision = body.get("decision")
    if decision not in {"accepted", "rejected"}:
        raise HTTPException(status_code=422, detail="Decision must be accepted or rejected")
    accepted = decision == "accepted"
    notes = str(body.get("notes") or ("Accepted by Marketing" if accepted else "Rejected by Marketing. Original deadline holds.")).strip()[:1000]
    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or ""

    def mutate(item):
        state = _design_workflow_state(item)
        if item.marketing_decision == "accepted" or item.status == "Approved / Closed":
            raise HTTPException(status_code=409, detail="A closed design request cannot accept a counter-date proposal")
        proposed_date = state.get("proposedTargetDate")
        if not state.get("isCounterDateActive") or not proposed_date:
            raise HTTPException(status_code=409, detail="There is no pending counter-date proposal")
        if accepted:
            item.design_required_date = proposed_date
            linked_sample = sample_service.repo.get_by_sr_number(item.sr_number)
            if linked_sample:
                linked_sample.target_artwork_date_creative = proposed_date
                try:
                    linked_sample.sample_required_date = datetime.strptime(proposed_date, "%Y-%m-%d").date()
                except ValueError:
                    raise HTTPException(status_code=409, detail="The proposed date on this request is invalid")
        state.update({
            "isCounterDateActive": False,
            "counterDateDecision": decision,
            "counterDateDecisionAt": datetime.now(timezone.utc).isoformat(),
            "counterDateDecisionNotes": notes,
        })
        _append_design_event(
            state, action=f"COUNTER_DATE_{decision.upper()}",
            title=f"Counter date {decision}",
            body=notes, actor=str(actor), department="Marketing",
            badge_text="Date Accepted" if accepted else "Date Retained",
            badge_variant="emerald" if accepted else "rose",
        )
        item.workflow_state = state

    saved = service.mutate(id, mutate)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.post("/api/v1/design-requests/{id}/notes", summary="Add a design workflow note")
def add_design_workflow_note(
    id: int,
    body: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    current_user = Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "samp", "plant", "creative_studio"))
    record = service.get_by_id(id)
    if not record:
        raise HTTPException(status_code=404, detail="Design request not found")
    if user_has_team(current_user, "marketing"):
        _require_marketing_design_owner(id, service, current_user)
    if user_has_team(current_user, "creative_studio") and not is_admin(current_user):
        state = record.get("workflow_state") if isinstance(record.get("workflow_state"), dict) else {}
        claim_id = state.get("claimedByUserId")
        if str(record.get("status") or "").casefold() not in {"creative", "creative remaining requested", "creative studio", "target date counter proposed"}:
            raise HTTPException(status_code=404, detail="Design request not found")
        if not is_team_head(current_user) and claim_id and claim_id != current_user.id:
            raise HTTPException(status_code=404, detail="Design request not found")
    body = body if isinstance(body, dict) else {}
    note_text = str(body.get("body") or "").strip()
    if not note_text or len(note_text) > 2000:
        raise HTTPException(status_code=422, detail="Note text is required")
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

    def mutate(item):
        state = _design_workflow_state(item)
        state["notes"] = [note, *(state.get("notes") or [])][:500]
        item.workflow_state = state

    saved = service.mutate(id, mutate)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.post("/api/v1/design-requests/{id}/release", summary="Release a design request to Creative")
def release_design_request(
    id: int,
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "marketing")
    _require_marketing_design_owner(id, service, current_user)
    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or ""

    def mutate(item):
        current_status = str(item.status or "")
        if not current_status.casefold().startswith("draft"):
            if current_status in {"Creative", "Creative Remaining Requested", "Creative Studio", "Target Date Counter Proposed"}:
                return
            raise HTTPException(status_code=409, detail="Only a draft design request can be released")
        now = datetime.now(timezone.utc).isoformat()
        state = _design_workflow_state(item)
        state["releasedAt"] = state.get("releasedAt") or now
        _append_design_event(
            state, action="REQUEST_RELEASED", title="Released from Marketing Draft",
            body="Marketing released this design request from the pre-SMT draft queue to Creative.", actor=str(actor),
            department="Marketing", badge_text="Released", badge_variant="emerald",
        )
        item.workflow_state = state
        item.status = "Creative"
        linked_sample = sample_service.repo.get_by_sr_number(item.sr_number)
        if linked_sample:
            linked_sample.status = "Creative"

    saved = service.mutate(id, mutate)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.post("/api/v1/sample-requests/{sample_id}/design-brief", summary="Submit a design-only brief to Creative")
def submit_design_brief(
    sample_id: int,
    body: Dict[str, Any] = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    design_service: DesignRequestService = Depends(get_design_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "marketing")
    sample_record = service.get_by_id(sample_id)
    if not sample_record or (not is_admin(current_user) and not is_team_head(current_user) and sample_record.get("created_by_user_id") != current_user.id):
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

    parent = service.get_by_id(sample_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Sample request not found")
    sr_number = parent.get("sr_number")
    if not sr_number:
        raise HTTPException(status_code=409, detail="Sample request number is unavailable; refresh the request and try again")
    existing_design = design_service.get_by_sr_number(sr_number)
    if existing_design and not str(existing_design.get("status") or "").lower().startswith("draft"):
        raise HTTPException(status_code=409, detail="This design request has already left Draft")

    request_types = list(parent.get("request_types") or [])
    if "design" not in request_types:
        request_types.append("design")
    updated_sample = service.update(sample_id, {
        "request_types": request_types,
        "status": "Creative",
        "product_description": description,
        "product_artwork_nos": count,
        "target_artwork_date_creative": required_date,
    })
    if not updated_sample:
        raise HTTPException(status_code=404, detail="Sample request not found")

    design_service.sync_sample_request(updated_sample)
    record = design_service.get_by_sr_number(sr_number)
    if not record:
        raise HTTPException(status_code=500, detail="Design request could not be created")

    record = design_service.update(record["id"], {
        "status": "Creative",
        "number_of_designs": count,
        "trend": body.get("trend") or None,
        "target_audience": body.get("target_audience") or None,
        "product_description": description,
        "design_required_date": required_date,
        "reference_image": body.get("reference_image") or None,
        "reference_images": body.get("reference_images") or [],
        "reference_links": body.get("reference_links") or [],
        "design_remarks": body.get("design_remarks") or None,
        "marketing_decision": None,
        "remaining_design_count": count,
        "creative_submissions": [],
    })
    return {"success": True, "data": record}


@router.put("/api/v1/design-requests/{id}/creative-output", summary="Submit Creative design output")
def submit_creative_design_output(
    id: int,
    body: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    file_url = str(body.get("design_file_url") or "").strip()
    rows = body.get("rows")
    if len(file_url) > 2048:
        raise HTTPException(status_code=422, detail="Artwork reference must be 2048 characters or fewer")
    if not file_url:
        raise HTTPException(status_code=422, detail="Add an artwork link, path, or reference text")
    if not isinstance(rows, list) or not rows or len(rows) > 100:
        raise HTTPException(status_code=422, detail="Add at least one completed design")
    raw_rows = []
    for row in rows:
        if not isinstance(row, dict):
            raise HTTPException(status_code=422, detail="Each design output must be an object")
        shutterstock_no = str(row.get("shutterstock_no") or row.get("shutterstockNo") or "").strip()
        remarks = str(row.get("remarks") or "").strip()[:1000]
        if not shutterstock_no and not remarks:
            raise HTTPException(status_code=422, detail="Add a Shutterstock No. or a remark for each artwork")
        if len(shutterstock_no) > 100:
            raise HTTPException(status_code=422, detail="Shutterstock No. must be 100 characters or fewer")
        raw_rows.append({"shutterstock_no": shutterstock_no, "remarks": remarks})

    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or body.get("designer_name")

    def mutate(item):
        if item.status not in {"Creative", "Creative Remaining Requested"}:
            raise HTTPException(status_code=409, detail="This request is not awaiting Creative output")
        state = _design_workflow_state(item)
        claimed_by = str(state.get("claimedBy") or "")
        if not claimed_by:
            raise HTTPException(status_code=409, detail="Claim this design request before submitting artwork")
        claimed_by_id = state.get("claimedByUserId")
        if (claimed_by_id and claimed_by_id != current_user.id) or (not claimed_by_id and (not actor or claimed_by.casefold() != str(actor).casefold())):
            raise HTTPException(status_code=403, detail="Only the assigned designer can submit artwork")
        submissions = list(item.creative_submissions or [])
        continuing_remaining_request = (
            item.marketing_decision == "remaining_requested"
            or item.status == "Creative Remaining Requested"
        )
        delivered_before = sum(len(batch.get("rows") or []) for batch in submissions if isinstance(batch, dict))
        requested = int(item.number_of_designs or 0)
        remaining = max(0, requested - delivered_before)
        if len(raw_rows) > remaining:
            raise HTTPException(status_code=422, detail=f"Only {remaining} design(s) remain")
        normalized_rows = []
        for offset, row in enumerate(raw_rows):
            design_number = f"D{delivered_before + offset + 1}"
            marketing_description = str(item.product_description or "").strip()
            normalized_rows.append({
                "design_number": design_number,
                "description": f"{marketing_description} - {design_number}",
                **row,
            })
        delivered = delivered_before + len(normalized_rows)
        submissions.append({
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "design_file_url": file_url,
            "rows": normalized_rows,
        })
        item.creative_submissions = submissions
        remaining_after = max(0, requested - delivered)
        item.remaining_design_count = remaining_after
        if continuing_remaining_request and remaining_after > 0:
            # Keep the request assigned to Creative across as many batches as needed.
            # Marketing can accept the delivered set at any point to close it.
            item.marketing_decision = "remaining_requested"
            item.status = "Creative Remaining Requested"
            submission_title = "Remaining artwork batch submitted"
            submission_body = f"{len(normalized_rows)} artwork(s) added; {remaining_after} requested artwork(s) remain."
        else:
            # Return to Marketing once the outstanding request is fulfilled, or after
            # the first regular batch when Marketing has not requested the remainder.
            item.marketing_decision = "awaiting_marketing_review"
            item.status = "Awaiting Marketing Review"
            submission_title = "Artwork submitted to Marketing"
            submission_body = f"{len(normalized_rows)} artwork(s) submitted for review."
        _append_design_event(
            state, action="DELIVERABLE_SUBMITTED", title=submission_title,
            body=submission_body, actor=str(actor or claimed_by),
            department="Creative Studio", badge_text="Submitted", badge_variant="teal",
        )
        item.workflow_state = state
        linked_sample = sample_service.repo.get_by_sr_number(item.sr_number)
        if linked_sample:
            linked_sample.status = item.status

    saved = service.mutate(id, mutate)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.post("/api/v1/design-requests/{id}/marketing-decision", summary="Accept design output or request remaining designs")
def marketing_design_decision(
    id: int,
    body: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "marketing")
    _require_marketing_design_owner(id, service, current_user)
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    decision = body.get("decision")
    if decision not in {"accept", "request_remaining"}:
        raise HTTPException(status_code=422, detail="Decision must be accept or request_remaining")
    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or ""

    def mutate(item):
        if item.marketing_decision == "accepted" or item.status == "Approved / Closed":
            raise HTTPException(status_code=409, detail="This design request is already closed")
        if item.status not in {"Awaiting Marketing Review", "Creative Remaining Requested"}:
            raise HTTPException(status_code=409, detail="Creative output must be submitted before review")
        remaining = max(0, int(item.number_of_designs or 0) - sum(
            len(batch.get("rows") or []) for batch in (item.creative_submissions or []) if isinstance(batch, dict)
        ))
        if decision == "accept":
            item.marketing_decision = "accepted"
            item.status = "Approved / Closed"
            item.remaining_design_count = 0
            title = "Artwork approved and closed"
            body_text = "Marketing accepted the submitted artwork."
            badge = "Accepted"
            variant = "emerald"
        else:
            if item.status == "Creative Remaining Requested" or item.marketing_decision == "remaining_requested":
                raise HTTPException(status_code=409, detail="Creative is already completing the requested remaining artwork")
            if remaining == 0:
                raise HTTPException(status_code=409, detail="All requested designs have been delivered")
            item.marketing_decision = "remaining_requested"
            item.status = "Creative Remaining Requested"
            item.remaining_design_count = remaining
            title = "Remaining artwork requested"
            body_text = f"Marketing returned {remaining} artwork(s) to Creative for completion."
            badge = "Revisions"
            variant = "amber"
        state = _design_workflow_state(item)
        _append_design_event(
            state, action="MARKETING_DECISION", title=title, body=body_text,
            actor=str(actor), department="Marketing", badge_text=badge, badge_variant=variant,
        )
        item.workflow_state = state
        linked_sample = sample_service.repo.get_by_sr_number(item.sr_number)
        if linked_sample:
            linked_sample.status = item.status
            mockup_state = linked_sample.mockup_workflow_state if isinstance(linked_sample.mockup_workflow_state, dict) else {}
            if decision == "accept" and mockup_state.get("stage") == "awaiting_design_acceptance":
                now = datetime.now(timezone.utc).isoformat()
                events = list(mockup_state.get("events") or [])
                events.append({
                    "action": "DESIGN_ACCEPTED_MOCKUP_RELEASED_TO_CREATIVE",
                    "title": "Design accepted; Mockup released to Creative",
                    "actorName": str(actor),
                    "actorDepartment": "Marketing",
                    "timestamp": now,
                })
                mockup_state.update({"stage": "creative", "designAcceptedAt": now, "events": events[-100:]})
                linked_sample.mockup_workflow_state = mockup_state
                linked_sample.status = "Creative"
                linked_sample.updated_at = datetime.now(timezone.utc)

    saved = service.mutate(id, mutate)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    return saved


@router.post("/api/v1/design-requests/{id}/request-followup", summary="Add Mockup or Sampling to an accepted design request")
def request_post_design_deliverables(
    id: int,
    body: Dict[str, Any] = Body(...),
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    """Add Marketing-selected work to the same sample request after artwork acceptance."""
    require_team(current_user, "marketing")
    _require_marketing_design_owner(id, service, current_user)
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    raw_deliverables = body.get("deliverables")
    if not isinstance(raw_deliverables, list):
        raise HTTPException(status_code=422, detail="Choose Mockup, Sampling, or both")
    deliverables = list(dict.fromkeys(str(value).strip().lower() for value in raw_deliverables))
    if not deliverables or any(value not in {"mockup", "sample"} for value in deliverables):
        raise HTTPException(status_code=422, detail="Choose Mockup, Sampling, or both")

    actor = str(getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Marketing").strip()[:100]

    def mutate(item: DesignRequest):
        if item.marketing_decision != "accepted" or item.status != "Approved / Closed":
            raise HTTPException(status_code=409, detail="Accept the submitted artwork before adding Mockup or Sampling")
        if not item.sr_number:
            raise HTTPException(status_code=409, detail="This design request is not linked to a sample request")

        sample = (
            sample_service.db.query(CreateSampleRequest)
            .filter(CreateSampleRequest.sr_number == item.sr_number)
            .with_for_update()
            .first()
        )
        if not sample:
            raise HTTPException(status_code=409, detail="The linked sample request could not be found")

        previous_types = list(sample.request_types or [])
        existing_types = list(dict.fromkeys(str(value).strip().lower() for value in previous_types if value))
        added = [value for value in deliverables if value not in existing_types]
        if not added:
            return

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        for value in added:
            existing_types.append(value)
        sample.request_types = existing_types
        previous_status = sample.status
        sample_service._apply_request_type_audit(
            sample,
            {
                "request_types": existing_types,
                "request_type_timestamps": {value: now_iso for value in added},
            },
            stamp_new=True,
        )
        if "mockup" in added:
            sample.mockup_required = "Yes"
            mockup_state = sample.mockup_workflow_state if isinstance(sample.mockup_workflow_state, dict) else {}
            events = list(mockup_state.get("events") or [])
            if not mockup_state.get("releasedToCreativeAt"):
                events.append({
                    "action": "MOCKUP_RELEASED_TO_CREATIVE",
                    "title": "Mockup request released to Creative",
                    "actorName": actor,
                    "actorDepartment": "Marketing",
                    "timestamp": now_iso,
                })
            mockup_state.update({
                "stage": "creative",
                "releasedToCreativeAt": mockup_state.get("releasedToCreativeAt") or now_iso,
                "events": events[-100:],
            })
            sample.mockup_workflow_state = mockup_state

        combined_types = set(existing_types)
        sample.status = "Sampling Review (PMT)" if "sample" in combined_types else "Creative"
        sample_service.add_activity_log(
            sample,
            action="REQUEST_SCOPES_ADDED",
            actor_id=getattr(current_user, "id", None),
            actor_name=actor,
            actor_department="Marketing",
            from_status=previous_status,
            to_status=sample.status,
            payload={
                "added_request_types": added,
                "previous_request_types": previous_types,
                "request_types": existing_types,
            },
        )

        state = _design_workflow_state(item)
        labels = " and ".join("Mockup" if value == "mockup" else "Sampling" for value in added)
        _append_design_event(
            state,
            action="POST_DESIGN_FOLLOWUP_REQUESTED",
            title=f"{labels} added to the request",
            body=f"Marketing added {labels} after accepting the artwork.",
            actor=actor,
            department="Marketing",
            badge_text="Follow-up",
            badge_variant="emerald",
        )
        item.workflow_state = state
        sample.updated_at = now

    saved = service.mutate(id, mutate)
    if not saved:
        raise HTTPException(status_code=404, detail="Design request not found")
    sample = sample_service.repo.get_by_sr_number(saved.get("sr_number"))
    if not sample:
        raise HTTPException(status_code=409, detail="The linked sample request could not be found")
    return sample_service.serialize(sample)


@router.post("/api/v1/design-requests", status_code=status.HTTP_201_CREATED, summary="Create design request")
def create_design_request(
    body: Dict[str, Any] = Body(default_factory=dict),
    service: DesignRequestService = Depends(get_design_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "marketing")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    customer_name = str(body.get("customer_name") or body.get("customerName") or "").strip()
    description = str(body.get("product_description") or body.get("productDescription") or "").strip()
    if not customer_name or len(customer_name) > 150:
        raise HTTPException(status_code=422, detail="Customer name is required and must be 150 characters or fewer")
    if not description or len(description) > 5000:
        raise HTTPException(status_code=422, detail="Design brief is required and must be 5,000 characters or fewer")
    try:
        number_of_designs = int(body.get("number_of_designs", body.get("numberOfDesigns", 1)))
    except (TypeError, ValueError):
        number_of_designs = 0
    if not 1 <= number_of_designs <= 100:
        raise HTTPException(status_code=422, detail="Request between 1 and 100 artwork variants")

    required_date = body.get("design_required_date") or body.get("designRequiredDate") or None
    if required_date:
        try:
            datetime.strptime(str(required_date), "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=422, detail="Design required date must use YYYY-MM-DD format")

    reference_images = body.get("reference_images", body.get("referenceImages", []))
    reference_links = body.get("reference_links", body.get("referenceLinks", []))
    if not isinstance(reference_images, list) or not isinstance(reference_links, list):
        raise HTTPException(status_code=422, detail="Reference images and links must be lists")
    if len(reference_images) > 50 or len(reference_links) > 50:
        raise HTTPException(status_code=422, detail="A design request can include at most 50 references of each type")

    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or body.get("created_by") or ""
    request_data = {
        "sr_number": body.get("sr_number") or body.get("srNumber"),
        "customer_name": customer_name,
        "program_name": str(body.get("program_name") or body.get("programName") or "").strip() or None,
        "program_year": str(body.get("program_year") or body.get("programYear") or "").strip() or None,
        "status": "Draft (Pre-SMT)",
        "number_of_designs": number_of_designs,
        "trend": str(body.get("trend") or "").strip() or None,
        "target_audience": str(body.get("target_audience") or body.get("targetAudience") or "").strip() or None,
        "reference_image": body.get("reference_image") or body.get("referenceImage") or None,
        "product_description": description,
        "design_required_date": required_date,
        "created_by": str(actor).strip()[:100],
        "created_by_user_id": current_user.id,
        "design_remarks": str(body.get("design_remarks") or body.get("designRemarks") or "").strip() or None,
        "reference_images": reference_images,
        "reference_links": reference_links,
        "creative_submissions": [],
        "marketing_decision": None,
        "remaining_design_count": number_of_designs,
    }
    try:
        return service.create(request_data)
    except IntegrityError:
        raise HTTPException(status_code=409, detail="A design request already uses this SR number")


@router.get("/api/v1/design-requests/{id}", response_model=Dict[str, Any], summary="Get design request")
def get_design_request(
    id: int,
    service: DesignRequestService = Depends(get_design_request_service),
    current_user=Depends(get_current_user),
):
    record = service.get_by_id(id)
    if not record:
        raise HTTPException(status_code=404, detail="Design request not found")
    if user_has_team(current_user, "marketing") and not is_admin(current_user) and not is_team_head(current_user) and record.get("created_by_user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Design request not found")
    if user_has_team(current_user, "creative_studio") and not is_admin(current_user):
        if str(record.get("status") or "").casefold() not in {"creative", "creative remaining requested", "creative studio", "target date counter proposed"}:
            raise HTTPException(status_code=404, detail="Design request not found")
        if not is_team_head(current_user):
            state = record.get("workflow_state") if isinstance(record.get("workflow_state"), dict) else {}
            claimed_id = state.get("claimedByUserId")
            if claimed_id and claimed_id != current_user.id:
                raise HTTPException(status_code=404, detail="Design request not found")
            if not claimed_id and state.get("claimedBy") and str(state.get("claimedBy")).casefold() != str(getattr(current_user, "name", "")).casefold():
                raise HTTPException(status_code=404, detail="Design request not found")
    if user_has_team(current_user, "plant") and not can_access_plant(
        current_user,
        (service.db.query(CreateSampleRequest.target_plant)
         .filter(CreateSampleRequest.sr_number == record.get("sr_number")).scalar()),
        service.db,
    ):
        raise HTTPException(status_code=404, detail="Design request not found")
    return record


@router.patch("/api/v1/design-requests/{id}", summary="Update design request")
def update_design_request(
    id: int,
    body: Dict[str, Any] = Body(default_factory=dict),
    service: DesignRequestService = Depends(get_design_request_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "marketing")
    _require_marketing_design_owner(id, service, current_user)
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    aliases = {
        "customerName": "customer_name",
        "programName": "program_name",
        "programYear": "program_year",
        "numberOfDesigns": "number_of_designs",
        "targetAudience": "target_audience",
        "referenceImage": "reference_image",
        "productDescription": "product_description",
        "designRequiredDate": "design_required_date",
        "designRemarks": "design_remarks",
        "referenceImages": "reference_images",
        "referenceLinks": "reference_links",
    }
    editable = {
        "customer_name", "program_name", "program_year", "number_of_designs",
        "trend", "target_audience", "reference_image", "product_description",
        "design_required_date", "design_remarks", "reference_images", "reference_links",
    }
    updates = {aliases.get(key, key): value for key, value in body.items()}
    unknown = set(updates) - editable
    if unknown:
        raise HTTPException(status_code=422, detail=f"These design fields cannot be edited here: {', '.join(sorted(unknown))}")
    if not updates:
        return _get_design_workflow_record(id, service)
    for field in ("customer_name", "product_description"):
        if field in updates:
            value = str(updates[field] or "").strip()
            if not value:
                raise HTTPException(status_code=422, detail=f"{field.replace('_', ' ').title()} cannot be empty")
            max_length = 150 if field == "customer_name" else 5000
            if len(value) > max_length:
                raise HTTPException(status_code=422, detail=f"{field.replace('_', ' ').title()} is too long")
            updates[field] = value
    if "number_of_designs" in updates:
        try:
            updates["number_of_designs"] = int(updates["number_of_designs"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="Number of designs must be an integer")
        if not 1 <= updates["number_of_designs"] <= 100:
            raise HTTPException(status_code=422, detail="Request between 1 and 100 artwork variants")
    if "design_required_date" in updates and updates["design_required_date"]:
        try:
            datetime.strptime(str(updates["design_required_date"]), "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=422, detail="Design required date must use YYYY-MM-DD format")
    for field in ("reference_images", "reference_links"):
        if field in updates and (not isinstance(updates[field], list) or len(updates[field]) > 50):
            raise HTTPException(status_code=422, detail=f"{field.replace('_', ' ').title()} must be a list of at most 50 items")
    actor = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or ""

    def mutate(item):
        count_changed = (
            updates.get("number_of_designs") is not None
            and int(updates["number_of_designs"]) != int(item.number_of_designs or 0)
        )
        if count_changed and (
            not str(item.status or "").casefold().startswith("draft") or item.creative_submissions
        ):
            raise HTTPException(status_code=409, detail="Artwork count can only be changed before the request is released")
        changed_fields = [key for key, value in updates.items() if getattr(item, key) != value]
        for key, value in updates.items():
            setattr(item, key, value)
        if count_changed:
            item.remaining_design_count = updates["number_of_designs"]
        if changed_fields:
            state = _design_workflow_state(item)
            _append_design_event(
                state,
                action="DESIGN_REQUEST_UPDATED",
                title="Design brief updated",
                body="Updated " + ", ".join(field.replace("_", " ") for field in changed_fields) + ".",
                actor=str(actor),
                department="Marketing",
                badge_text="Updated",
                badge_variant="neutral",
            )
            item.workflow_state = state

    record = service.mutate(id, mutate)
    if not record:
        raise HTTPException(status_code=404, detail="Design request not found")
    return record


@router.delete("/api/v1/design-requests/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete design request")
def delete_design_request(
    id: int,
    service: DesignRequestService = Depends(get_design_request_service),
    sample_service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_admin(current_user)
    record = service.get_by_id(id)
    if not record:
        raise HTTPException(status_code=404, detail="Design request not found")
    linked_sample = (
        sample_service.db.query(CreateSampleRequest)
        .filter(CreateSampleRequest.sr_number == record.get("sr_number"))
        .with_for_update()
        .first()
    ) if record.get("sr_number") else None
    if linked_sample:
        previous_types = list(linked_sample.request_types or [])
        remaining_types = [value for value in previous_types if str(value).strip().lower() != "design"]
        if len(remaining_types) != len(previous_types):
            previous_status = linked_sample.status
            linked_sample.request_types = remaining_types
            sample_service._apply_request_type_audit(linked_sample, {"request_types": remaining_types})
            linked_sample.updated_at = datetime.now(timezone.utc)
            sample_service.add_activity_log(
                linked_sample,
                action="REQUEST_SCOPE_REMOVED",
                actor_id=getattr(current_user, "id", None),
                actor_name=getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Admin",
                actor_department="Admin",
                from_status=previous_status,
                to_status=linked_sample.status,
                payload={
                    "removed_request_types": ["design"],
                    "previous_request_types": previous_types,
                    "request_types": remaining_types,
                },
            )
    if not service.delete(id):
        raise HTTPException(status_code=404, detail="Design request not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Downstream Cross-Desk Persistent Operations
# ---------------------------------------------------------------------------

@router.get("/api/v1/creative/briefs", response_model=List[Dict[str, Any]], summary="List creative briefs")
def list_creative_briefs(
    service: DownstreamService = Depends(get_downstream_service),
    current_user=Depends(get_current_user),
):
    return filter_plant_records(current_user, service.list_creative_briefs(), service.db)


@router.patch("/api/v1/creative/briefs/{id}", summary="Update creative brief")
def update_creative_brief(
    id: str,
    body: Dict[str, Any] = Body(...),
    service: DownstreamService = Depends(get_downstream_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    updated = service.update_creative_brief(id, body)
    if not updated:
        raise HTTPException(status_code=404, detail="Creative brief not found")
    return updated


@router.get("/api/v1/studio/dielines", response_model=List[Dict[str, Any]], summary="List studio dielines")
def list_studio_dielines(
    service: DownstreamService = Depends(get_downstream_service),
    current_user=Depends(get_current_user),
):
    return filter_plant_records(current_user, service.list_studio_dielines(), service.db)


@router.patch("/api/v1/studio/dielines/{id}", summary="Update studio dieline")
def update_studio_dieline(
    id: str,
    body: Dict[str, Any] = Body(...),
    service: DownstreamService = Depends(get_downstream_service),
    current_user = Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    updated = service.update_studio_dieline(id, body)
    if not updated:
        raise HTTPException(status_code=404, detail="Studio dieline not found")
    return updated


@router.get("/api/v1/costing/estimations", response_model=List[Dict[str, Any]], summary="List costing estimations")
def list_costing_estimations(
    service: DownstreamService = Depends(get_downstream_service),
    current_user=Depends(get_current_user),
):
    require_admin(current_user)
    return service.list_costing_estimations()


@router.patch("/api/v1/costing/estimations/{id}", summary="Update costing estimation")
def update_costing_estimation(
    id: str,
    body: Dict[str, Any] = Body(...),
    service: DownstreamService = Depends(get_downstream_service),
    current_user = Depends(get_current_user),
):
    require_admin(current_user)
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    updated = service.update_costing_estimation(id, body)
    if not updated:
        raise HTTPException(status_code=404, detail="Costing estimation not found")
    return updated


# ---------------------------------------------------------------------------
# Product Characteristics (/api/v1/product-characteristics)
# ---------------------------------------------------------------------------

@router.get("/api/v1/product-characteristics", summary="List all active product characteristics", dependencies=[Depends(require_smps_member)])
def list_product_characteristics(service: SampleRequestService = Depends(get_sample_request_service)):
    return service.get_all_characteristics()


@router.get("/api/v1/product-characteristics/classes", summary="List product characteristic classes", dependencies=[Depends(require_smps_member)])
def list_characteristic_classes(service: SampleRequestService = Depends(get_sample_request_service)):
    return service.get_characteristic_classes()


@router.get("/api/v1/product-characteristics/details/{sample_request_id}", summary="Get product details for a sample request")
def get_product_details(
    sample_request_id: int,
    exclude_na: bool = False,
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
    sample = service.get_by_id(sample_request_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample request not found")
    state = sample.get("mockup_workflow_state") or {}
    request_types = sample.get("request_types") or []
    is_mockup = "mockup" in request_types or str(sample.get("mockup_required") or "").casefold() == "yes"
    creative_workflow_read = (
        user_has_team(current_user, "creative_studio")
        and is_mockup
        and isinstance(state, dict)
        and state.get("stage") in {"creative", "studio", "creative_approval"}
    )
    if not creative_workflow_read:
        _require_marketing_sample_owner(sample, current_user)
        require_plant_access(current_user, sample.get("target_plant"), service.db)
    return service.get_product_details(sample_request_id)


@router.post("/api/v1/product-characteristics/details", summary="Save product details for a sample request")
def save_product_details(
    request: Request,
    body: Any = Body(...),
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user = Depends(get_current_user),
):
    require_any_team(current_user, ("marketing", "creative_studio"))
    sample_request_id = (
        request.query_params.get("sample_request_id")
        or (body.get("sample_request_id") if isinstance(body, dict) else None)
        or (body.get("sampleRequestId") if isinstance(body, dict) else None)
    )
    if isinstance(body, list):
        details = body
    elif isinstance(body, dict):
        details = body.get("details") or []
    else:
        details = []

    if not sample_request_id or not isinstance(details, list):
        raise HTTPException(status_code=422, detail="Missing sample_request_id or details list")

    sample = service.get_by_id(int(sample_request_id))
    if not sample:
        raise HTTPException(status_code=404, detail="Sample request not found")
    if user_has_team(current_user, "creative_studio"):
        state = sample.get("mockup_workflow_state") or {}
        if not isinstance(state, dict) or state.get("stage") != "creative":
            raise HTTPException(status_code=403, detail="Creative can only update characteristics while the Mockup request is in Creative review.")
        _require_mockup_stage_claim(state, current_user, "creative")
        allowed_keys = {
            (_normalize_binding(item.get("className") or item.get("class_name")),
             _normalize_binding(item.get("characteristicName") or item.get("characteristic_name")))
            for item in state.get("creativeCharacteristicKeys", [])
            if isinstance(item, dict)
        }
        submitted_keys = {
            (_normalize_binding(item.get("class_name") or item.get("className")),
             _normalize_binding(item.get("characteristic_name") or item.get("characteristicName")))
            for item in details
            if isinstance(item, dict)
        }
        if not allowed_keys or not submitted_keys.issubset(allowed_keys):
            raise HTTPException(status_code=403, detail="Creative may only update the designated Mockup characteristics.")
    else:
        _require_marketing_sample_owner(sample, current_user)

    success = service.save_product_details(int(sample_request_id), details)
    if not success:
        raise HTTPException(status_code=404, detail="Sample request not found")
    return {"success": True, "message": "Product details updated successfully"}



@router.get("/api/v1/product-characteristics/binding-hierarchy", summary="Get binding hierarchy")
def get_binding_hierarchy(
    category: Optional[str] = None,
    sub_category: Optional[str] = None,
    third_category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
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
            func.lower(func.coalesce(column, "")),
            "[^a-z0-9]+",
            "",
            "g",
        )

    def normalized_taxonomy_value(value: str) -> str:
        return _normalize_binding(value)

    product_query = db.query(CreateSampleRequest.id)
    if category and category.strip():
        product_query = product_query.filter(
            normalized_taxonomy_sql(CreateSampleRequest.product_category)
            == normalized_taxonomy_value(category)
        )
    if sub_category and sub_category.strip():
        product_query = product_query.filter(
            normalized_taxonomy_sql(CreateSampleRequest.product_sub_category)
            == normalized_taxonomy_value(sub_category)
        )
    if third_category and third_category.strip():
        product_query = product_query.filter(
            normalized_taxonomy_sql(CreateSampleRequest.product_third_category)
            == normalized_taxonomy_value(third_category)
        )
    product_ids = [request_id for (request_id,) in product_query.all()]
    products_by_request: Dict[int, Dict[str, str]] = {request_id: {} for request_id in product_ids}
    binding_rows = (
        db.query(
            ProductDetail.sample_request_id,
            ProductDetail.characteristic_name,
            ProductDetail.value,
        )
        .filter(ProductDetail.sample_request_id.in_(product_ids))
        .filter(func.upper(ProductDetail.class_name) == "NB_BINDING")
        .filter(normalized_taxonomy_sql(ProductDetail.characteristic_name).in_(
            ("bindingtype1", "binding1", "bindingtype2", "binding2")
        ))
        .all()
        if product_ids
        else []
    )
    for request_id, characteristic_name, value in binding_rows:
        normalized = _normalize_binding(characteristic_name)
        clean_value = str(value or "").strip()
        if not clean_value or clean_value.upper() in {"NA", "N/A", "NAN", "NULL", "NONE", "-", "—"}:
            continue
        product_bindings = products_by_request.setdefault(request_id, {})
        if normalized in {"bindingtype1", "binding1"}:
            product_bindings["binding1"] = clean_value
        elif normalized in {"bindingtype2", "binding2"}:
            product_bindings["binding2"] = clean_value

    master_b1_options = master_b1_options if isinstance(master_b1_options, list) else []
    master_b2_options = master_b2_options if isinstance(master_b2_options, list) else []
    product_b1_options = [
        bindings["binding1"] for bindings in products_by_request.values() if bindings.get("binding1")
    ]
    product_b2_options = [
        bindings["binding2"] for bindings in products_by_request.values() if bindings.get("binding2")
    ]

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

    b1_cleaned = merge_binding_options(product_b1_options, master_b1_options)
    b2_cleaned = merge_binding_options(product_b2_options, master_b2_options)

    # Build the dependency only from actual saved product pairs. The master
    # option lists do not encode which Binding 2 values belong to each Binding 1.
    hierarchy: Dict[str, List[str]] = {}
    for binding1 in b1_cleaned:
        matching_binding2 = [
            bindings["binding2"]
            for bindings in products_by_request.values()
            if _normalize_binding(bindings.get("binding1")) == _normalize_binding(binding1)
            and bindings.get("binding2")
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
    limit: Optional[int] = None,
    service: SampleRequestService = Depends(get_sample_request_service),
    current_user=Depends(get_current_user),
):
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
    return filter_plant_records(current_user, _filter_marketing_sample_owners(rows, current_user), service.db)

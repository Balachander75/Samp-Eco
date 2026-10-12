"""
Feasibility Request Service.
Encapsulates business operations for technical verdicts, image decoding,
status transitions, and activity audit logging.
"""
import base64
import binascii
import re
from uuid import uuid4
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.repositories.feasibility_repo import FeasibilityRepository
from app.models.feasibility import (
    FeasibilityRequest,
    FeasibilityReferenceImage,
)
from app.models.master import Customer, Plant
from app.models.sample_request import CreateSampleRequest
from app.services.sample_request_service import SampleRequestService
from app.schemas.feasibility import (
    FeasibilityRequestCreate,
    FeasibilitySampVerdictPayload,
    FeasibilityMarketingDecisionPayload,
    FeasibilityCounterDateProposalPayload,
    FeasibilityCounterDateDecisionPayload,
)

MAX_IMAGE_BYTES = 1_048_576
IMAGE_DATA_URL_RE = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$")


def _is_operational_workday(day: date) -> bool:
    if day.weekday() < 5:
        return True
    if day.weekday() == 5:
        saturday_occurrence = (day.day + 6) // 7
        return saturday_occurrence % 2 == 1
    return False


INDIA_TZ = ZoneInfo("Asia/Kolkata")


def _counter_date_deadline(proposed_at: datetime) -> datetime:
    """Return end-of-day India time on the fourth working day after proposal."""
    local = proposed_at.replace(tzinfo=timezone.utc) if proposed_at.tzinfo is None else proposed_at
    local_day = local.astimezone(INDIA_TZ).date()
    counted = 0
    while counted < 4:
        local_day += timedelta(days=1)
        if _is_operational_workday(local_day):
            counted += 1
    return datetime.combine(local_day, time.max, tzinfo=INDIA_TZ).astimezone(timezone.utc)


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _operational_workdays_between(start: datetime, end: datetime) -> int:
    start_local = _utc(start).astimezone(INDIA_TZ).date()
    end_local = _utc(end).astimezone(INDIA_TZ).date()
    cursor = start_local + timedelta(days=1)
    count = 0
    while cursor <= end_local:
        count += int(_is_operational_workday(cursor))
        cursor += timedelta(days=1)
    return count


def _shift_workdays(day: date, count: int) -> date:
    shifted = day
    while count > 0:
        shifted += timedelta(days=1)
        if _is_operational_workday(shifted):
            count -= 1
    return shifted


class FeasibilityService:
    """Application service for Feasibility Requests and Verdicts."""

    def __init__(self, db: Session, api_prefix: str = "/api/v1/feasibility-requests"):
        self.db = db
        self.repo = FeasibilityRepository(db)
        self.api_prefix = api_prefix

    @staticmethod
    def decode_image_data_url(data_url: str, enforce_size_limit: bool = True) -> Tuple[str, bytes]:
        """Decode and validate a base64 image data URL."""
        match = IMAGE_DATA_URL_RE.fullmatch(data_url or "")
        if not match:
            raise HTTPException(status_code=422, detail="Reference images must be JPEG, PNG, or WebP data URLs")
        content_type, encoded = match.groups()
        try:
            image_data = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(status_code=422, detail="Reference image data is invalid")
        if not image_data or (enforce_size_limit and len(image_data) > MAX_IMAGE_BYTES):
            raise HTTPException(status_code=413, detail="Each compressed reference image must be at most 1 MB")
        signatures = {
            "image/jpeg": image_data.startswith(b"\xff\xd8\xff"),
            "image/png": image_data.startswith(b"\x89PNG\r\n\x1a\n"),
            "image/webp": image_data.startswith(b"RIFF") and image_data[8:12] == b"WEBP",
        }
        if not signatures.get(content_type, False):
            raise HTTPException(status_code=422, detail="Reference image content does not match its file type")
        return content_type, image_data

    def serialize_activity(self, activity) -> Dict[str, Any]:
        """Serialize an activity log entry."""
        return {
            "id": activity.id,
            "feasibility_request_id": activity.feasibility_request_id,
            "request_code": activity.request_code,
            "actor_id": activity.actor_id,
            "actor_name": activity.actor_name,
            "actor_department": activity.actor_department,
            "action": activity.action,
            "payload": activity.payload or {},
            "created_at": activity.created_at,
        }

    def serialize_request(
        self, request: FeasibilityRequest, include_activities: bool = True
    ) -> Dict[str, Any]:
        """Serialize FeasibilityRequest model instance."""
        is_on_time = request.is_responded_on_time
        if is_on_time is None and request.feasibility_closed_at:
            closed_at = request.feasibility_closed_at
            closed_date = (closed_at.replace(tzinfo=timezone.utc) if closed_at.tzinfo is None else closed_at).astimezone(INDIA_TZ).date()
            is_on_time = closed_date <= _shift_workdays(request.required_date, request.samp_sla_paused_workdays or 0)

        return {
            "id": request.id,
            "request_code": request.request_code,
            "customer": request.customer.name if request.customer else "",
            "target_plant": request.target_plant,
            "feasibility_type": request.feasibility_type,
            "custom_feasibility_type": request.custom_feasibility_type,
            "description_notes": request.description_notes,
            "required_date": request.required_date,
            "marketing_remarks": request.marketing_remarks,
            "reference_images": [
                *[
                    f"{self.api_prefix}/{request.id}/images/{image.id}"
                    for image in (request.reference_image_records or [])
                ],
                *[
                    value for value in (request.reference_images or []) if isinstance(value, str)
                ],
            ],
            "reference_image_names": [
                image.original_name for image in (request.reference_image_records or [])
            ],
            "reference_links": request.reference_links or [],
            "status": request.status,
            "created_by": request.created_by,
            "request_created_by": request.request_created_by,
            "created_by_user_id": request.created_by_user_id,
            "request_raised_at": request.request_raised_at,
            "updated_at": request.updated_at,
            "taken_by_samp": request.taken_by_samp,
            "taken_by_samp_user_id": request.taken_by_samp_user_id,
            "taken_at_samp": request.taken_at_samp,
            "sampling_feasibility_response": request.sampling_feasibility_response,
            "sampling_feasibility_remark": request.sampling_feasibility_remark,
            "feasibility_conditions": request.feasibility_conditions,
            "lead_time_note": request.lead_time_note,
            "sampling_feasibility_approved_by": request.sampling_feasibility_approved_by,
            "feasibility_closed_at": request.feasibility_closed_at,
            "feasibility_closed_by": request.feasibility_closed_by,
            "is_responded_on_time": is_on_time,
            "samp_counter_date": request.samp_counter_date,
            "samp_counter_date_reason": request.samp_counter_date_reason,
            "samp_counter_date_proposed_at": request.samp_counter_date_proposed_at,
            "samp_counter_date_proposed_by": request.samp_counter_date_proposed_by,
            "counter_date_decision": request.counter_date_decision,
            "counter_date_decision_at": request.counter_date_decision_at,
            "counter_date_decision_by": request.counter_date_decision_by,
            "counter_date_decision_remark": request.counter_date_decision_remark,
            "counter_date_decision_due_at": request.counter_date_decision_due_at,
            "counter_date_wait_workdays": request.counter_date_wait_workdays,
            "samp_sla_paused_workdays": request.samp_sla_paused_workdays or 0,
            "marketing_decision": request.marketing_decision,
            "marketing_decision_by": request.marketing_decision_by,
            "marketing_decision_at": request.marketing_decision_at,
            "marketing_decision_remark": request.marketing_decision_remark,
            "converted_sample_request_id": request.converted_sample_request_id,
            "converted_sr_number": request.converted_sr_number,
            "converted_request_types": list(request.converted_sample_request.request_types or [])
            if request.converted_sample_request else [],
            "converted_at": request.converted_at,
            "converted_by": request.converted_by,
            "activities": [
                self.serialize_activity(act)
                for act in (request.activities or [])
            ] if include_activities else [],
        }

    def list_requests(
        self,
        status_filter: Optional[str] = None,
        year: Optional[str] = None,
        created_by_user_id: Optional[int] = None,
        visible_samp_user_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """List queue rows without audit history; history is loaded on inspector open."""
        requests = self.repo.list_all_detailed(
            year=year,
            status_filter=status_filter,
            created_by_user_id=created_by_user_id,
            visible_samp_user_id=visible_samp_user_id,
        )
        return [self.serialize_request(r, include_activities=False) for r in requests]

    def get_by_id(self, request_id: int) -> Optional[Dict[str, Any]]:
        """Fetch request by ID with relations."""
        req = self.repo.get_with_details(request_id)
        if not req:
            return None
        return self.serialize_request(req)

    def create(self, payload: FeasibilityRequestCreate, current_user=None) -> Dict[str, Any]:
        """Create new feasibility check and assign codes."""
        if not _is_operational_workday(payload.required_date):
            raise HTTPException(
                status_code=422,
                detail="Required date must be a working day. Sundays and 2nd/4th Saturdays are off.",
            )
        target_plant = self.db.query(Plant).filter(Plant.code == "1505").first()
        if not target_plant or not target_plant.name:
            raise HTTPException(status_code=409, detail="Khaniwade plant master record (code 1505) is required")
        customer_name = payload.customer.strip()
        customer = self.db.query(Customer).filter(Customer.name.ilike(customer_name)).first()
        if not customer:
            customer = Customer(name=customer_name)
            self.db.add(customer)
            self.db.flush()

        creator_name = getattr(payload, "created_by", None) or (current_user.name if current_user else "Marketing Specialist")
        creator_user_id = current_user.id if current_user else None

        req = FeasibilityRequest(
            request_code="PENDING",
            customer_id=customer.id,
            target_plant=target_plant.name,
            feasibility_type=payload.feasibility_type,
            custom_feasibility_type=payload.custom_feasibility_type,
            description_notes=payload.description_notes,
            required_date=payload.required_date,
            marketing_remarks=payload.marketing_remarks,
            reference_images=[],
            reference_links=payload.reference_links or [],
            created_by=creator_name,
            request_created_by=creator_name,
            created_by_user_id=creator_user_id,
            status="Pending Feasibility",
        )
        self.db.add(req)
        self.db.flush()

        seq = req.id
        while True:
            candidate_code = f"FC-{seq:04d}"
            collision = (
                self.db.query(FeasibilityRequest)
                .filter(FeasibilityRequest.request_code == candidate_code)
                .filter(FeasibilityRequest.id != req.id)
                .first()
            )
            if not collision:
                req.request_code = candidate_code
                break
            seq += 1

        # Decode reference images
        if payload.reference_images:
            names = payload.reference_image_names or []
            for idx, data_url in enumerate(payload.reference_images):
                content_type, image_data = self.decode_image_data_url(data_url)
                name = names[idx] if idx < len(names) else f"Reference image {idx + 1}"
                img_record = FeasibilityReferenceImage(
                    feasibility_request_id=req.id,
                    original_name=name,
                    content_type=content_type,
                    image_data=image_data,
                    sort_order=idx,
                )
                self.db.add(img_record)

        # Log creation activity
        self.repo.add_activity_log(
            feasibility_request_id=req.id,
            actor_id=creator_user_id,
            actor_name=creator_name,
            actor_department="Marketing",
            action="CREATED",
            payload={"type": payload.feasibility_type, "customer": customer.name},
        )

        self.db.commit()
        return self.serialize_request(self.repo.get_with_details(req.id))

    def record_samp_verdict(
        self,
        request_id: int,
        payload: FeasibilitySampVerdictPayload,
        current_user=None,
    ) -> Dict[str, Any]:
        """Record technical verdict from SAMP team."""
        req = self.repo.get_for_update(request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Feasibility request was not found")

        if not req.taken_by_samp:
            raise HTTPException(
                status_code=400,
                detail="Task must be claimed by a sampling team member before submitting a technical verdict.",
            )

        is_admin = "admin" in f"{getattr(current_user, 'role', '')} {getattr(current_user, 'sub_role', '')}".lower() if current_user else False
        if not is_admin and current_user and req.taken_by_samp_user_id and req.taken_by_samp_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="This review is assigned to another SAMP team member")
        if not is_admin and current_user and not req.taken_by_samp_user_id and req.taken_by_samp != current_user.name:
            raise HTTPException(status_code=403, detail="This review is assigned to another SAMP team member")

        if req.marketing_decision or req.converted_sample_request_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot modify technical verdict after a marketing decision has been rendered or request converted.",
            )

        if req.sampling_feasibility_response:
            raise HTTPException(status_code=409, detail="The SAMP technical verdict has already been submitted")

        if self._auto_accept_if_due(req):
            self.db.commit()
            req = self.repo.get_for_update(request_id)
        if req.counter_date_decision == "pending":
            raise HTTPException(status_code=409, detail="Resolve the pending Marketing counter-date decision before submitting the technical verdict")

        if payload.response in ("No", "Maybe") and not (payload.remark or "").strip():
            raise HTTPException(
                status_code=400,
                detail=f"Technical evaluation remarks are compulsory when selecting '{payload.response}'.",
            )

        actor_name = current_user.name if current_user else (req.taken_by_samp or "Sampling Lead")
        actor_id = current_user.id if current_user else None

        req.sampling_feasibility_response = payload.response
        req.sampling_feasibility_remark = payload.remark.strip() if payload.remark else None
        req.feasibility_conditions = payload.conditions.strip() if payload.conditions else None
        req.lead_time_note = payload.lead_time_note.strip() if payload.lead_time_note else None
        req.sampling_feasibility_approved_by = actor_name
        req.feasibility_closed_at = datetime.now(timezone.utc)
        req.feasibility_closed_by = "sampling"
        req.status = f"Feasibility {payload.response}"
        closed_date = req.feasibility_closed_at.astimezone(INDIA_TZ).date()
        effective_due_date = _shift_workdays(req.required_date, req.samp_sla_paused_workdays or 0)
        req.is_responded_on_time = closed_date <= effective_due_date

        self.repo.add_activity_log(
            feasibility_request_id=req.id,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_department="SAMP",
            action="SAMP_EVALUATED",
            payload={"verdict": payload.response, "remark": payload.remark},
        )

        self.db.commit()
        return self.serialize_request(self.repo.get_with_details(req.id))

    def record_marketing_decision(
        self,
        request_id: int,
        payload: FeasibilityMarketingDecisionPayload,
        current_user=None,
    ) -> Dict[str, Any]:
        """Record Marketing acceptance or rejection."""
        req = self.repo.get_for_update(request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Feasibility request was not found")

        if self._auto_accept_if_due(req):
            self.db.commit()
            req = self.repo.get_for_update(request_id)

        if not req.sampling_feasibility_response:
            raise HTTPException(
                status_code=400,
                detail="Technical evaluation by SAMP team must be completed before recording marketing decision.",
            )

        if req.converted_sample_request_id:
            raise HTTPException(
                status_code=400,
                detail="Request has already been converted to commercial sampling.",
            )

        if req.counter_date_decision == "pending":
            raise HTTPException(status_code=409, detail="Decide the SAMP counter-date proposal before the final feasibility decision")

        if req.marketing_decision:
            raise HTTPException(status_code=409, detail="Marketing has already recorded its final decision")

        if (
            req.sampling_feasibility_response == "No"
            and payload.decision == "Accepted"
            and not (payload.decision_remark or "").strip()
        ):
            raise HTTPException(status_code=422, detail="Explain the Marketing exception when accepting a Not Feasible result")

        actor_name = current_user.name if current_user else "Marketing Specialist"
        actor_id = current_user.id if current_user else None

        req.marketing_decision = payload.decision
        req.marketing_decision_remark = payload.decision_remark.strip() if payload.decision_remark else None
        req.marketing_decision_by = actor_name
        req.marketing_decision_at = datetime.now(timezone.utc)
        req.status = f"Marketing {payload.decision}"

        self.repo.add_activity_log(
            feasibility_request_id=req.id,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_department="Marketing",
            action="MARKETING_DECIDED",
            payload={"decision": payload.decision, "remark": payload.decision_remark},
        )

        self.db.commit()
        return self.serialize_request(self.repo.get_with_details(req.id))

    def propose_counter_date(
        self,
        request_id: int,
        payload: FeasibilityCounterDateProposalPayload,
        current_user=None,
    ) -> Dict[str, Any]:
        req = self.repo.get_for_update(request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Feasibility request was not found")
        if not req.taken_by_samp:
            raise HTTPException(status_code=409, detail="Claim the SAMP review before proposing a revised date")
        is_admin = "admin" in f"{getattr(current_user, 'role', '')} {getattr(current_user, 'sub_role', '')}".lower() if current_user else False
        if not is_admin and current_user and req.taken_by_samp_user_id and req.taken_by_samp_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the assigned SAMP reviewer can propose a revised date")
        if not is_admin and current_user and not req.taken_by_samp_user_id and req.taken_by_samp != current_user.name:
            raise HTTPException(status_code=403, detail="Only the assigned SAMP reviewer can propose a revised date")
        if req.sampling_feasibility_response or req.marketing_decision or req.converted_sample_request_id:
            raise HTTPException(status_code=409, detail="A counter-date can only be proposed while technical review is open")
        if req.samp_counter_date is not None:
            raise HTTPException(status_code=409, detail="A counter-date proposal has already been used for this request")
        if payload.proposed_date <= req.required_date:
            raise HTTPException(status_code=422, detail="The proposed date must be later than the requested date")
        if not _is_operational_workday(payload.proposed_date):
            raise HTTPException(status_code=422, detail="The proposed date must be a working day")

        now = datetime.now(timezone.utc)
        actor_name = current_user.name if current_user else req.taken_by_samp
        actor_id = current_user.id if current_user else None
        req.samp_counter_date = payload.proposed_date
        req.samp_counter_date_reason = payload.reason.strip()
        req.samp_counter_date_proposed_at = now
        req.samp_counter_date_proposed_by = actor_name
        req.samp_counter_date_proposed_by_user_id = actor_id
        req.counter_date_decision = "pending"
        req.counter_date_decision_at = None
        req.counter_date_decision_by = None
        req.counter_date_decision_by_user_id = None
        req.counter_date_decision_remark = None
        req.counter_date_wait_workdays = None
        req.counter_date_decision_due_at = _counter_date_deadline(now)
        req.status = "Awaiting Marketing Date Decision"
        self.repo.add_activity_log(
            feasibility_request_id=req.id,
            actor_id=actor_id,
            actor_name=actor_name or "SAMP Team",
            actor_department="SAMP",
            action="SAMP_COUNTER_DATE_PROPOSED",
            payload={
                "original_date": req.required_date.isoformat(),
                "proposed_date": payload.proposed_date.isoformat(),
                "reason": req.samp_counter_date_reason,
                "decision_due_at": req.counter_date_decision_due_at.isoformat(),
                "auto_accept_after_working_days": 4,
            },
        )
        self.db.commit()
        return self.serialize_request(self.repo.get_with_details(req.id))

    def _auto_accept_if_due(self, req: FeasibilityRequest, now: Optional[datetime] = None) -> bool:
        if req.counter_date_decision != "pending" or not req.counter_date_decision_due_at or not req.samp_counter_date:
            return False
        now = now or datetime.now(timezone.utc)
        if _utc(now) <= _utc(req.counter_date_decision_due_at):
            return False
        self._apply_counter_date_decision(req, "auto_accepted", "System", None, None, now)
        return True

    def _apply_counter_date_decision(
        self,
        req: FeasibilityRequest,
        decision: str,
        actor_name: str,
        actor_id: Optional[int],
        remark: Optional[str],
        decided_at: datetime,
    ) -> None:
        old_date = req.required_date
        wait_workdays = _operational_workdays_between(req.samp_counter_date_proposed_at or decided_at, decided_at)
        req.counter_date_wait_workdays = wait_workdays
        req.samp_sla_paused_workdays = (req.samp_sla_paused_workdays or 0) + wait_workdays
        if decision in ("accepted", "auto_accepted"):
            req.required_date = req.samp_counter_date
        if req.feasibility_closed_at:
            closed_at = req.feasibility_closed_at
            closed_date = (closed_at.replace(tzinfo=timezone.utc) if closed_at.tzinfo is None else closed_at).astimezone(INDIA_TZ).date()
            req.is_responded_on_time = closed_date <= _shift_workdays(req.required_date, req.samp_sla_paused_workdays)
        req.counter_date_decision = decision
        req.counter_date_decision_at = decided_at
        req.counter_date_decision_by = actor_name
        req.counter_date_decision_by_user_id = actor_id
        req.counter_date_decision_remark = remark
        req.status = "Under SAMP Review"
        self.repo.add_activity_log(
            feasibility_request_id=req.id,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_department="System" if decision == "auto_accepted" else "Marketing",
            action="COUNTER_DATE_AUTO_ACCEPTED" if decision == "auto_accepted" else f"COUNTER_DATE_{decision.upper()}",
            commit=decision != "auto_accepted",
            payload={
                "decision": decision,
                "original_date": old_date.isoformat(),
                "proposed_date": req.samp_counter_date.isoformat(),
                "effective_date": req.required_date.isoformat(),
                "proposed_by": req.samp_counter_date_proposed_by,
                "proposed_at": req.samp_counter_date_proposed_at.isoformat() if req.samp_counter_date_proposed_at else None,
                "decision_due_at": req.counter_date_decision_due_at.isoformat() if req.counter_date_decision_due_at else None,
                "remark": remark,
                "marketing_wait_workdays": wait_workdays,
                "samp_sla_paused_workdays": req.samp_sla_paused_workdays or 0,
                "samp_sla_paused_while_marketing_decided": True,
            },
        )

    def decide_counter_date(
        self,
        request_id: int,
        payload: FeasibilityCounterDateDecisionPayload,
        current_user=None,
    ) -> Dict[str, Any]:
        req = self.repo.get_for_update(request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Feasibility request was not found")
        if self._auto_accept_if_due(req):
            self.db.commit()
            return self.serialize_request(self.repo.get_with_details(req.id))
        if req.counter_date_decision != "pending" or not req.samp_counter_date:
            raise HTTPException(status_code=409, detail="There is no pending SAMP counter-date proposal")
        actor_name = current_user.name if current_user else "Marketing Team"
        actor_id = current_user.id if current_user else None
        self._apply_counter_date_decision(
            req, payload.decision, actor_name, actor_id,
            (payload.decision_remark or "").strip() or None,
            datetime.now(timezone.utc),
        )
        self.db.commit()
        return self.serialize_request(self.repo.get_with_details(req.id))

    @classmethod
    def auto_accept_due_counter_dates(cls, db: Session, batch_size: int = 100) -> int:
        """Idempotently process due proposals; row locks let multiple API workers coexist."""
        service = cls(db)
        now = datetime.now(timezone.utc)
        due = (
            db.query(FeasibilityRequest)
            .filter(
                FeasibilityRequest.counter_date_decision == "pending",
                FeasibilityRequest.counter_date_decision_due_at <= now,
            )
            .order_by(FeasibilityRequest.counter_date_decision_due_at.asc())
            .with_for_update(skip_locked=True)
            .limit(batch_size)
            .all()
        )
        for req in due:
            service._auto_accept_if_due(req, now)
        if due:
            db.commit()
        return len(due)

    def claim_task(self, request_id: int, current_user=None) -> Dict[str, Any]:
        """Claim a feasibility review task by a SAMP team engineer."""
        req = self.repo.get_for_update(request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Feasibility request was not found")

        if req.sampling_feasibility_response:
            raise HTTPException(
                status_code=400,
                detail="Cannot claim an already evaluated feasibility task.",
            )

        is_admin = "admin" in f"{getattr(current_user, 'role', '')} {getattr(current_user, 'sub_role', '')}".lower() if current_user else False
        if req.taken_by_samp:
            same_claimant = (
                (current_user and req.taken_by_samp_user_id == current_user.id)
                or (not req.taken_by_samp_user_id and current_user and req.taken_by_samp == current_user.name)
            )
            if not is_admin and not same_claimant:
                raise HTTPException(status_code=409, detail="This feasibility review is already claimed by another SAMP member")

        actor_name = current_user.name if current_user else "Sampling Engineer"
        actor_id = current_user.id if current_user else None

        req.taken_by_samp = actor_name
        req.taken_by_samp_user_id = actor_id
        req.taken_at_samp = datetime.now(timezone.utc)
        if req.status == "Pending Feasibility":
            req.status = "Under SAMP Review"

        self.repo.add_activity_log(
            feasibility_request_id=req.id,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_department="SAMP",
            action="TASK_CLAIMED",
            payload={"claimed_by": actor_name},
        )

        self.db.commit()
        return self.serialize_request(self.repo.get_with_details(req.id))

    def convert_to_sampling(
        self,
        request_id: int,
        current_user=None,
        request_types: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Create a linked Sample and/or Costing request from accepted Feasibility."""
        req = self.repo.get_for_update(request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Feasibility request was not found")

        selected = {
            str(value).strip().lower() for value in (request_types or ["sample"]) if str(value).strip()
        }
        selected_types = [value for value in ("sample", "costing") if value in selected]
        if selected != set(selected_types):
            raise HTTPException(status_code=422, detail="Choose Sampling, Costing, or both request types.")
        if not selected_types or any(value not in {"sample", "costing"} for value in selected_types):
            raise HTTPException(status_code=422, detail="Choose Sampling, Costing, or both request types.")

        if req.marketing_decision != "Accepted":
            raise HTTPException(
                status_code=400,
                detail="Only accepted feasibility requests can be converted to commercial sampling.",
            )

        if req.converted_sample_request_id:
            existing_request = self.db.query(CreateSampleRequest).filter(
                CreateSampleRequest.id == req.converted_sample_request_id
            ).first()
            if existing_request and set(existing_request.request_types or []) == set(selected_types):
                return {
                    "feasibility": self.serialize_request(req),
                    "sample_request_id": existing_request.id,
                    "sample_sr_number": existing_request.sr_number,
                    "request_types": list(existing_request.request_types or []),
                }
            raise HTTPException(status_code=409, detail="This Feasibility request has already created its commercial request.")

        actor_name = current_user.name if current_user else "Marketing Lead"
        actor_id = current_user.id if current_user else None

        # Build new CreateSampleRequest
        yr_suffix = datetime.now(timezone.utc).year % 100
        now = datetime.now(timezone.utc)
        request_type_timestamps = {scope: now.isoformat() for scope in selected_types}

        customer_name = req.customer.name if req.customer else "Unknown Customer"
        now_date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        plant = self.db.query(Plant).filter(Plant.code == "1505").first()
        if not plant or not plant.name:
            raise HTTPException(status_code=409, detail="Khaniwade plant master record (code 1505) is required")
        target_plant = plant.name

        sample_req = CreateSampleRequest(
            sr_number=f"TMP-FC-{uuid4().hex}",
            year=f"20{yr_suffix}-20{yr_suffix + 1}",
            customer=customer_name,
            target_plant=target_plant,
            product_description=f"[Converted from {req.request_code}] {req.description_notes}",
            material_code=req.request_code,
            date_request_created=now_date_str,
            sample_required_date=req.required_date,
            costing_required_date=req.required_date.isoformat() if req.required_date else None,
            status="Sampling Review (PMT)" if "sample" in selected_types else "Costing Review",
            creation_mode="feasibility_conversion",
            request_types=selected_types,
            created_by=actor_name,
            created_by_user_id=actor_id,
            program_year=f"20{yr_suffix}-20{yr_suffix + 1}",
            program_name=f"{customer_name} · {req.custom_feasibility_type or req.feasibility_type}",
        )
        self.db.add(sample_req)
        self.db.flush()

        sample_service = SampleRequestService(self.db)
        sample_service._reserve_sr_number(sample_req)
        sample_service._apply_request_type_audit(sample_req, {
            "request_types": selected_types,
            "request_type_timestamps": request_type_timestamps,
        })
        sample_sr_num = sample_req.sr_number
        sample_service.add_activity_log(
            sample_req,
            action="CONVERTED_FROM_FEASIBILITY",
            actor_id=actor_id,
            actor_name=actor_name,
            actor_department="Marketing",
            to_status=sample_req.status,
            payload={
                "feasibility_request_id": req.id,
                "feasibility_request_code": req.request_code,
                "request_types": selected_types,
            },
        )

        req.converted_sample_request_id = sample_req.id
        req.converted_sr_number = sample_sr_num
        req.converted_at = datetime.now(timezone.utc)
        req.converted_by = actor_name
        req.status = (
            "Converted to Sampling and Costing"
            if {"sample", "costing"}.issubset(selected_types)
            else "Converted to Sampling"
            if "sample" in selected_types
            else "Converted to Costing"
        )

        self.repo.add_activity_log(
            feasibility_request_id=req.id,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_department="Marketing",
            action="CONVERTED_TO_SAMPLING",
            payload={
                "sample_request_id": sample_req.id,
                "sample_sr_number": sample_sr_num,
                "request_types": selected_types,
            },
            commit=False,
        )

        self.db.commit()
        return {
            "feasibility": self.serialize_request(self.repo.get_with_details(req.id)),
            "sample_request_id": sample_req.id,
            "sample_sr_number": sample_sr_num,
            "request_types": selected_types,
        }

    def add_note(self, request_id: int, note: str, current_user=None) -> Dict[str, Any]:
        """Add a manual communication note/comment to the feasibility audit chatter."""
        req = self.repo.get_with_details(request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Feasibility request was not found")

        clean_note = note.strip()
        if not clean_note:
            raise HTTPException(status_code=400, detail="Note content cannot be empty.")

        actor_name = current_user.name if current_user else "Team Member"
        actor_id = current_user.id if current_user else None
        roles = f"{getattr(current_user, 'role', '') or ''} {getattr(current_user, 'sub_role', '') or ''}".lower() if current_user else ""
        actor_department = (
            "SAMP Team" if "samp" in roles or "sampling" in roles
            else "Marketing" if "marketing" in roles
            else (getattr(current_user, "sub_role", None) or getattr(current_user, "role", None) or "Operations") if current_user else "Operations"
        )

        self.repo.add_activity_log(
            feasibility_request_id=req.id,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_department=actor_department,
            action="NOTE_ADDED",
            payload={"note": clean_note},
        )
        return self.serialize_request(self.repo.get_with_details(req.id))

    def record_viewed(self, request_id: int, current_user=None) -> bool:
        """Record view event with deduplication so audit logs remain clean and unpolluted."""
        req = self.repo.get_with_details(request_id)
        if not req:
            return False

        actor_name = current_user.name if current_user else "Operator"
        actor_id = current_user.id if current_user else None
        roles = f"{getattr(current_user, 'role', '') or ''} {getattr(current_user, 'sub_role', '') or ''}".lower() if current_user else ""
        actor_department = (
            "SAMP Team" if "samp" in roles or "sampling" in roles
            else "Marketing" if "marketing" in roles
            else "Operations"
        )

        # Smart deduplication: check if the latest activity was already a VIEWED event by this user
        last_log = (req.activities or [])[-1] if req.activities else None
        if last_log and last_log.action == "VIEWED" and last_log.actor_name == actor_name:
            return False

        self.repo.add_activity_log(
            feasibility_request_id=req.id,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_department=actor_department,
            action="VIEWED",
            payload={"viewed_at": datetime.now(timezone.utc).isoformat()},
        )
        return True

    def delete(self, request_id: int) -> bool:
        """Delete feasibility request."""
        return self.repo.delete(request_id)

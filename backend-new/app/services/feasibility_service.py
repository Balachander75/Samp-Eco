"""
Feasibility Request Service.
Encapsulates business operations for technical verdicts, image decoding,
status transitions, and activity audit logging.
"""
import base64
import binascii
import io
import re
from sqlalchemy import func
from datetime import date, datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple
from app.utils.operational_workdays import (
    INDIA_TZ,
    india_operational_deadline,
    is_operational_workday,
)
try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover
    Image = None
    ImageOps = None
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.auth.permissions import user_has_team
from app.repositories.feasibility_repo import FeasibilityRepository
from app.models.feasibility import (
    FeasibilityRequest,
    FeasibilityReferenceImage,
)
from app.models.master import Customer, Plant
from app.models.sample_request import CreateSampleRequest
from app.utils.request_codes import REQUEST_CODE_PREFIX_BY_SCOPE, next_request_code, temporary_request_code
from app.schemas.feasibility import (
    FeasibilityRequestCreate,
    FeasibilitySampVerdictPayload,
    FeasibilityMarketingDecisionPayload,
    FeasibilityCounterDateProposalPayload,
    FeasibilityCounterDateDecisionPayload,
)

MAX_RAW_IMAGE_BYTES = 15 * 1024 * 1024
MAX_IMAGE_BYTES = 1_048_576
IMAGE_DATA_URL_RE = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$")


def _is_operational_workday(day: date) -> bool:
    return is_operational_workday(day)


def _counter_date_deadline(proposed_at: datetime) -> datetime:
    """Return end-of-day India time on the fourth working day after proposal."""
    return india_operational_deadline(proposed_at, 4)


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
    def compress_image(
        image_bytes: bytes,
        original_content_type: str,
        max_dimension: int = 1600,
        quality: int = 70,
    ) -> Tuple[str, bytes]:
        """Compress image binary using Pillow to optimize database storage and delivery speed."""
        if Image is None or ImageOps is None:
            return original_content_type, image_bytes
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                img = ImageOps.exif_transpose(img)
                width, height = img.size
                if max(width, height) > max_dimension:
                    scale = max_dimension / max(width, height)
                    new_width = max(1, int(width * scale))
                    new_height = max(1, int(height * scale))
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

                out_buffer = io.BytesIO()
                has_alpha = img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info)
                if original_content_type == "image/jpeg" or not has_alpha:
                    if img.mode != "RGB":
                        img = img.convert("RGB")
                    img.save(out_buffer, format="JPEG", quality=quality, optimize=True)
                    target_content_type = "image/jpeg"
                else:
                    img.save(out_buffer, format="WEBP", quality=quality, method=4)
                    target_content_type = "image/webp"

                compressed_bytes = out_buffer.getvalue()
                if len(compressed_bytes) < len(image_bytes):
                    return target_content_type, compressed_bytes
                return original_content_type, image_bytes
        except Exception:
            return original_content_type, image_bytes

    @classmethod
    def decode_image_data_url(cls, data_url: str, enforce_size_limit: bool = True) -> Tuple[str, bytes]:
        """Decode, validate, and compress a base64 image data URL."""
        match = IMAGE_DATA_URL_RE.fullmatch(data_url or "")
        if not match:
            raise HTTPException(status_code=422, detail="Reference images must be JPEG, PNG, or WebP data URLs")
        content_type, encoded = match.groups()
        try:
            image_data = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(status_code=422, detail="Reference image data is invalid")
        if not image_data or len(image_data) > MAX_RAW_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Each reference image upload must be at most 15 MB")
        signatures = {
            "image/jpeg": image_data.startswith(b"\xff\xd8\xff"),
            "image/png": image_data.startswith(b"\x89PNG\r\n\x1a\n"),
            "image/webp": image_data.startswith(b"RIFF") and image_data[8:12] == b"WEBP",
        }
        if not signatures.get(content_type, False):
            raise HTTPException(status_code=422, detail="Reference image content does not match its file type")

        # Compress image before storing
        target_content_type, compressed_data = cls.compress_image(image_data, content_type)

        if enforce_size_limit and len(compressed_data) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Each compressed reference image must be at most 1 MB")

        return target_content_type, compressed_data

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

        converted_request = self.db.query(CreateSampleRequest).filter(
            CreateSampleRequest.id == request.converted_sample_request_id,
        ).first() if request.converted_sample_request_id else None
        converted_codes = converted_request.request_codes if converted_request and isinstance(converted_request.request_codes, dict) else {}
        converted_request_code = (
            converted_request.sr_number
            if converted_request and "sample" in (converted_request.request_types or [])
            else next((converted_codes.get(key) for key in ("design", "mockup", "costing") if converted_codes.get(key)), None)
            if converted_request
            else request.converted_sr_number
        )

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
                f"{self.api_prefix}/{request.id}/images/{image.id}"
                for image in (request.reference_image_records or [])
            ],
            "reference_image_names": [
                image.original_name for image in (request.reference_image_records or [])
            ],
            "reference_links": request.reference_links or [],
            "status": request.status,
            "created_by": request.created_by,
            "request_created_by": request.created_by,
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
            "converted_request_code": converted_request_code,
            "converted_request_types": converted_request.request_types if converted_request else [],
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
        offset: int = 0,
        limit: Optional[int] = None,
        before_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """List queue rows without audit history; history is loaded on inspector open."""
        self.auto_accept_due_counter_dates(self.db)
        requests = self.repo.list_all_detailed(
            year=year,
            status_filter=status_filter,
            created_by_user_id=created_by_user_id,
            visible_samp_user_id=visible_samp_user_id,
            offset=offset,
            limit=limit,
            before_id=before_id,
        )
        return [self.serialize_request(r, include_activities=False) for r in requests]

    def get_by_id(self, request_id: int) -> Optional[Dict[str, Any]]:
        """Fetch request by ID with relations."""
        req = self.repo.get_with_details(request_id)
        if not req:
            return None
        if self._auto_accept_if_due(req):
            self.db.commit()
            req = self.repo.get_with_details(request_id)
        return self.serialize_request(req)

    def create(self, payload: FeasibilityRequestCreate, current_user=None) -> Dict[str, Any]:
        """Create new feasibility check and assign codes."""
        today_local = datetime.now(timezone.utc).astimezone(INDIA_TZ).date()
        if payload.required_date < today_local:
            raise HTTPException(
                status_code=422,
                detail="Required date cannot be in the past.",
            )
        if not _is_operational_workday(payload.required_date):
            raise HTTPException(
                status_code=422,
                detail="Required date must be a working day. Sundays and 2nd/4th Saturdays are off.",
            )
        target_plant_name = "1505 - Khaniwade"
        if payload.target_plant and payload.target_plant.strip():
            target_plant_name = payload.target_plant.strip()
        else:
            plant = self.db.query(Plant).filter(Plant.code == "1505").first()
            if plant and plant.name:
                target_plant_name = plant.name
        customer_name = payload.customer.strip()
        customer = self.db.query(Customer).filter(func.lower(Customer.name) == customer_name.lower()).first()
        if not customer:
            customer = Customer(name=customer_name)
            self.db.add(customer)
            self.db.flush()

        creator_name = getattr(payload, "created_by", None) or (current_user.name if current_user else "Marketing Specialist")
        creator_user_id = current_user.id if current_user else None

        req = FeasibilityRequest(
            request_code=temporary_request_code(),
            customer_id=customer.id,
            target_plant=target_plant_name,
            feasibility_type=payload.feasibility_type,
            custom_feasibility_type=payload.custom_feasibility_type,
            description_notes=payload.description_notes,
            required_date=payload.required_date,
            marketing_remarks=payload.marketing_remarks,
            reference_links=payload.reference_links or [],
            created_by=creator_name,
            created_by_user_id=creator_user_id,
            status="Pending Feasibility",
        )
        self.db.add(req)
        self.db.flush()

        req.request_code = next_request_code(
            self.db,
            REQUEST_CODE_PREFIX_BY_SCOPE["feasibility"],
            req.request_raised_at or datetime.now(timezone.utc),
        )

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
        if not is_admin and current_user and req.created_by_user_id and req.created_by_user_id == current_user.id:
            raise HTTPException(status_code=403, detail="The creator of this feasibility request cannot submit the technical verdict. A separate SAMP team member must review it.")
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
            actor_department="SAMP Team",
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
        today_local = datetime.now(timezone.utc).astimezone(INDIA_TZ).date()
        if payload.proposed_date <= today_local:
            raise HTTPException(status_code=422, detail="The proposed date must be later than today")
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
            actor_department="SAMP Team",
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
        if not is_admin and current_user and req.created_by_user_id and req.created_by_user_id == current_user.id:
            raise HTTPException(status_code=403, detail="The creator of this feasibility request cannot claim it for technical evaluation. A separate SAMP team member must review it.")
        if req.taken_by_samp:
            same_claimant = (
                (current_user and req.taken_by_samp_user_id == current_user.id)
                or (not req.taken_by_samp_user_id and current_user and req.taken_by_samp == current_user.name)
            )
            if not is_admin and not same_claimant:
                raise HTTPException(status_code=409, detail="This feasibility review is already claimed by another SAMP member")
            if same_claimant:
                return self.serialize_request(self.repo.get_with_details(req.id))

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
            actor_department="SAMP Team",
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
        sample_request_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Link a fully staged commercial draft to an accepted Feasibility request."""
        req = self.repo.get_for_update(request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Feasibility request was not found")
        if sample_request_id is not None:
            try:
                sample_request_id = int(sample_request_id)
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail="The staged commercial request ID is invalid.")

        selected = {
            str(value).strip().lower() for value in (request_types or ["sample"]) if str(value).strip()
        }
        selected_types = [value for value in ("sample", "mockup", "costing") if value in selected]
        if not selected_types or not selected.issubset({"sample", "mockup", "costing"}):
            raise HTTPException(status_code=422, detail="Choose Sample, Mockup, or both request types.")

        if req.sampling_feasibility_response == "No":
            raise HTTPException(
                status_code=409,
                detail="SAMP marked this request Not Feasible. Sample and Mockup requests cannot be created from it.",
            )
        if req.sampling_feasibility_response not in {"Yes", "Maybe"}:
            raise HTTPException(
                status_code=409,
                detail="A completed Feasible or Conditional SAMP verdict is required before creating a Sample or Mockup request.",
            )

        if req.marketing_decision != "Accepted":
            raise HTTPException(
                status_code=400,
                detail="Only accepted feasibility requests can be converted to a Sample or Mockup request.",
            )

        if req.converted_sample_request_id:
            linked = self.db.query(CreateSampleRequest).filter(
                CreateSampleRequest.id == req.converted_sample_request_id,
            ).first()
            if linked:
                linked_types = [
                    value for value in (linked.request_types or [])
                    if value in {"sample", "mockup", "costing"}
                ]
                if sample_request_id is not None and int(sample_request_id) != linked.id:
                    raise HTTPException(status_code=409, detail="This feasibility request is already linked to a different commercial request.")
                if set(linked_types) != set(selected_types):
                    raise HTTPException(status_code=409, detail="This feasibility request is already linked to a different request type.")
                return {
                    "feasibility": self.serialize_request(req),
                    "sample_request_id": linked.id,
                    "sample_sr_number": linked.sr_number,
                    "sample_request_code": linked.sr_number if "sample" in (linked.request_types or []) else next(
                        ((linked.request_codes or {}).get(key) for key in ("design", "mockup", "costing") if (linked.request_codes or {}).get(key)),
                        None,
                    ),
                    "request_types": linked_types,
                }
            # Older versions recorded the Feasibility row ID and a synthetic SR
            # without creating a commercial request. Let this conversion repair it.
            req.converted_sample_request_id = None
            req.converted_sr_number = None

        actor_name = current_user.name if current_user else "Marketing Lead"
        actor_id = current_user.id if current_user else None

        if sample_request_id is None:
            from app.utils.business_year import get_current_business_year
            # Create a commercial sample request draft directly from the feasibility request
            created_today = datetime.now(timezone.utc).date()
            customer_name = self.db.query(Customer.name).filter(Customer.id == req.customer_id).scalar() or ""
            generated_sr_num = (
                next_request_code(self.db, REQUEST_CODE_PREFIX_BY_SCOPE["sample"], created_today)
                if "sample" in selected_types
                else None
            )
            codes = {}
            for scope_key in ("design", "mockup", "costing"):
                if scope_key in selected_types:
                    codes[scope_key] = next_request_code(
                        self.db, REQUEST_CODE_PREFIX_BY_SCOPE[scope_key], created_today
                    )

            staged = CreateSampleRequest(
                customer=customer_name,
                year=getattr(req, "year", None) or get_current_business_year(),
                date_request_created=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                material_code=getattr(req, "material_code", None) or f"FS-{req.id:04d}",
                creation_mode="new",
                product_description=req.description_notes or getattr(req, "product_description", None) or "Commercial request from Feasibility",
                request_types=selected_types,
                request_codes=codes,
                sr_number=generated_sr_num,
                status="Draft (Pre-SMT)",
                created_by=actor_name,
                created_by_user_id=actor_id,
                qty_for_sampling=1 if "sample" in selected_types else None,
                sample_required_date=req.required_date if "sample" in selected_types else None,
                target_plant=req.target_plant,
                reference_links=req.reference_links or [],
                mockup_required="Yes" if "mockup" in selected_types else "No",
                mockup_workflow_state={
                    "qtyForMockup": 1,
                    "requiredDate": str(req.required_date or ""),
                    "designNeeded": False,
                    "marketingRemark": req.marketing_remarks or "Converted from Feasibility",
                } if "mockup" in selected_types else None,
            )
            self.db.add(staged)
            self.db.flush()
        else:
            staged = self.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_request_id).first()
            if not staged:
                raise HTTPException(status_code=404, detail="The staged commercial request was not found.")
            if not str(staged.status or "").strip().casefold().startswith("draft"):
                raise HTTPException(status_code=409, detail="Only a staged draft can be linked to feasibility.")
            staged_types = [
                value for value in (staged.request_types or [])
                if value in {"sample", "mockup", "costing"}
            ]
            if set(staged_types) != set(selected_types):
                raise HTTPException(status_code=409, detail="The staged draft request type does not match the selected feasibility next process.")
            customer_name = self.db.query(Customer.name).filter(Customer.id == req.customer_id).scalar() or ""
            if str(staged.customer or "").strip().casefold() != customer_name.strip().casefold():
                raise HTTPException(status_code=409, detail="The staged draft customer does not match the feasibility request.")
            if not str(staged.product_description or "").strip():
                raise HTTPException(status_code=409, detail="Add a product description in Product Staging before linking this request.")
            if "sample" in selected_types:
                try:
                    sampling_quantity = int(str(staged.qty_for_sampling or "").strip())
                except (TypeError, ValueError):
                    sampling_quantity = 0
                if sampling_quantity < 1 or not staged.sample_required_date:
                    raise HTTPException(status_code=409, detail="Complete the Sample quantity and required date in Product Staging first.")
            if "mockup" in selected_types:
                mockup_state = staged.mockup_workflow_state if isinstance(staged.mockup_workflow_state, dict) else {}
                try:
                    mockup_quantity = int(str(mockup_state.get("qtyForMockup") or "").strip())
                except (TypeError, ValueError):
                    mockup_quantity = 0
                has_mockup_detail = bool(
                    str(mockup_state.get("marketingShutterstockNo") or "").strip()
                    or str(mockup_state.get("marketingRemark") or "").strip()
                )
                if (
                    str(staged.mockup_required or "").strip().casefold() not in {"yes", "true", "y"}
                    or mockup_quantity < 1
                    or not str(mockup_state.get("requiredDate") or "").strip()
                    or not isinstance(mockup_state.get("designNeeded"), bool)
                    or not has_mockup_detail
                ):
                    raise HTTPException(status_code=409, detail="Complete the Mockup product, quantity, required date, and design details in Product Staging first.")
            already_linked = self.db.query(FeasibilityRequest).filter(
                FeasibilityRequest.converted_sample_request_id == staged.id,
                FeasibilityRequest.id != req.id,
            ).first()
            if already_linked:
                raise HTTPException(status_code=409, detail="This staged draft is already linked to another feasibility request.")

        staged_types = [
            value for value in (staged.request_types or [])
            if value in {"sample", "mockup", "costing"}
        ]

        if req.reference_image_records:
            from app.models.sample_request import SampleRequestReferenceImage

            scope = selected_types[0]
            existing_images = self.db.query(SampleRequestReferenceImage).filter(
                SampleRequestReferenceImage.sample_request_id == staged.id,
                SampleRequestReferenceImage.scope == scope,
            ).all()
            used_orders = {image.sort_order for image in existing_images}
            next_order = 0
            for image in req.reference_image_records:
                while next_order in used_orders and next_order < 2:
                    next_order += 1
                if next_order >= 2:
                    break
                self.db.add(SampleRequestReferenceImage(
                    sample_request_id=staged.id,
                    scope=scope,
                    original_name=image.original_name,
                    content_type=image.content_type,
                    original_size_bytes=len(image.image_data) if image.image_data else None,
                    image_data=image.image_data,
                    sort_order=next_order,
                ))
                used_orders.add(next_order)
                next_order += 1

        sample_request_code = (
            staged.sr_number
            if "sample" in staged_types
            else next(
                (
                    (staged.request_codes or {}).get(key)
                    for key in ("mockup", "costing", "design")
                    if (staged.request_codes or {}).get(key)
                ),
                None,
            )
        )
        req.converted_sample_request_id = staged.id
        req.converted_sr_number = staged.sr_number or sample_request_code
        req.converted_at = datetime.now(timezone.utc)
        req.converted_by = actor_name
        if "sample" in selected_types and "mockup" in selected_types and "costing" in selected_types:
            req.status = "Converted to Sample, Mockup & Costing"
        elif "sample" in selected_types and "mockup" in selected_types:
            req.status = "Converted to Sample & Mockup"
        elif "sample" in selected_types and "costing" in selected_types:
            req.status = "Converted to Sampling and Costing"
        elif "mockup" in selected_types and "costing" in selected_types:
            req.status = "Converted to Mockup & Costing"
        elif "sample" in selected_types:
            req.status = "Converted to Sample"
        elif "mockup" in selected_types:
            req.status = "Converted to Mockup"
        elif "costing" in selected_types:
            req.status = "Converted to Costing"
        else:
            req.status = "Converted to Commercial"
        self.repo.add_activity_log(
            feasibility_request_id=req.id,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_department="Marketing",
            action="CONVERTED_TO_SAMPLING",
            payload={
                "sample_request_id": staged.id,
                "sample_sr_number": staged.sr_number,
                "sample_request_code": sample_request_code,
                "request_types": selected_types,
                "staged_before_link": True,
            },
            commit=False,
        )
        self.db.commit()
        return {
            "feasibility": self.serialize_request(self.repo.get_with_details(req.id)),
            "sample_request_id": staged.id,
            "sample_sr_number": staged.sr_number,
            "sample_request_code": sample_request_code,
            "request_types": staged_types,
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
        if current_user and user_has_team(current_user, "samp"):
            actor_department = "SAMP Team"
        elif current_user and user_has_team(current_user, "marketing"):
            actor_department = "Marketing"
        else:
            actor_department = (
                getattr(current_user, "team", None)
                or getattr(current_user, "sub_role", None)
                or getattr(current_user, "role", None)
                or "Operations"
            ) if current_user else "Operations"

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
        if current_user and user_has_team(current_user, "samp"):
            actor_department = "SAMP Team"
        elif current_user and user_has_team(current_user, "marketing"):
            actor_department = "Marketing"
        else:
            actor_department = (
                getattr(current_user, "team", None)
                or getattr(current_user, "sub_role", None)
                or getattr(current_user, "role", None)
                or "Operations"
            ) if current_user else "Operations"

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

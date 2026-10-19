"""PostgreSQL repository for Creative Design Requests in backend-new."""
from datetime import datetime, timezone
import logging
from typing import Any, Callable, Dict, List, Optional
from uuid import uuid4
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.repositories.base import BaseRepository
from app.models.sample_request import CreateSampleRequest, DesignRequest, SampleRequestActivityLog
from app.utils.business_year import get_business_year_date_range
from app.utils.request_codes import REQUEST_CODE_PREFIX_BY_SCOPE, next_request_code, temporary_request_code

logger = logging.getLogger("uvicorn.error")


class DesignRequestRepository(BaseRepository[DesignRequest]):
    """Repository dedicated to Creative Design Requests persistence."""

    def __init__(self, db: Session):
        super().__init__(DesignRequest, db)

    def list_all_records(
        self,
        year: Optional[str] = None,
        draft_only: bool = False,
        created_by_user_id: Optional[int] = None,
        status_in: Optional[List[str]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """List design requests, restricting FY and role views in PostgreSQL before serialization."""
        query = self.db.query(DesignRequest)
        if year and year.strip().upper() != "ALL":
            clean_year = year.strip()
            date_range = get_business_year_date_range(clean_year)
            if date_range and "-" in clean_year and len(clean_year) == 9:
                start, end = date_range
                start_dt = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc)
                end_dt = datetime.combine(end, datetime.min.time(), tzinfo=timezone.utc)
                _, second_yr = clean_year.split("-")
                query = query.filter(
                    or_(
                        DesignRequest.program_year == clean_year,
                        DesignRequest.program_year == second_yr,
                        and_(
                            or_(
                                DesignRequest.program_year.is_(None),
                                func.trim(DesignRequest.program_year) == "",
                            ),
                            DesignRequest.created_at >= start_dt,
                            DesignRequest.created_at < end_dt,
                        ),
                    )
                )
            else:
                query = query.filter(DesignRequest.program_year == clean_year)
        if draft_only:
            normalized_status = func.lower(func.coalesce(DesignRequest.status, ""))
            query = query.filter(
                or_(
                    normalized_status.like("%draft%"),
                    normalized_status.like("%smt%"),
                )
            )
        if created_by_user_id is not None:
            query = query.filter(DesignRequest.created_by_user_id == created_by_user_id)
        if status_in:
            normalized_statuses = [s.strip().lower() for s in status_in if s and s.strip()]
            if normalized_statuses:
                query = query.filter(func.lower(func.coalesce(DesignRequest.status, "")).in_(normalized_statuses))
        query = query.order_by(DesignRequest.id.desc())
        if offset is not None and offset > 0:
            query = query.offset(offset)
        if limit is not None and limit > 0:
            query = query.limit(limit)

        items = query.all()
        return [self.to_dict(item) for item in items]

    def get_record_by_id(self, item_id: int) -> Optional[Dict[str, Any]]:
        """Fetch a design request from PostgreSQL."""
        item = self.db.query(DesignRequest).filter(DesignRequest.id == item_id).first()
        return self.to_dict(item) if item else None

    def get_model_by_sr_number(self, sr_number: Optional[str]) -> Optional[DesignRequest]:
        if not sr_number:
            return None
        return self.db.query(DesignRequest).filter(DesignRequest.sr_number == sr_number).first()

    def get_model_by_request_code(self, request_code: Optional[str]) -> Optional[DesignRequest]:
        if not request_code:
            return None
        return self.db.query(DesignRequest).filter(DesignRequest.request_code == request_code).first()

    def _get_linked_sample(
        self,
        request_code: Optional[str],
        sr_number: Optional[str] = None,
        *,
        sample_request_id: Optional[int] = None,
        for_update: bool = False,
    ) -> Optional[CreateSampleRequest]:
        if sample_request_id:
            query = self.db.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_request_id)
            if for_update:
                query = query.with_for_update().populate_existing()
            linked = query.first()
            if linked:
                return linked
        if request_code:
            query = self.db.query(CreateSampleRequest).filter(
                CreateSampleRequest.request_codes["design"].astext == request_code
            )
            if for_update:
                query = query.with_for_update().populate_existing()
            linked = query.first()
            if linked:
                return linked
        if sr_number:
            query = self.db.query(CreateSampleRequest).filter(CreateSampleRequest.sr_number == sr_number)
            if for_update:
                query = query.with_for_update().populate_existing()
            return query.first()
        return None

    def create_record(self, data: Dict[str, Any], *, commit: bool = True) -> Dict[str, Any]:
        """Create a design request in PostgreSQL using its sequence-generated ID."""
        now = datetime.now(timezone.utc)
        number_of_designs = int(data.get("number_of_designs") or 1)
        workflow_state = dict(data.get("workflow_state") or {})
        if not workflow_state.get("events"):
            workflow_state["events"] = [
                {
                    "id": f"event-{uuid4().hex}",
                    "actorName": data.get("created_by") or "",
                    "actorDepartment": "Marketing",
                    "action": "INTAKE_CREATED",
                    "title": "Design brief saved",
                    "body": f"{number_of_designs} artwork variant(s) requested.",
                    "timestamp": now.isoformat(),
                    "isNote": False,
                    "badge": {"text": "Intake", "variant": "purple"},
                }
            ]
        if not str(data.get("status") or "Draft (Pre-SMT)").casefold().startswith("draft"):
            workflow_state["releasedAt"] = workflow_state.get("releasedAt") or now.isoformat()
            if not any(event.get("action") == "REQUEST_RELEASED" for event in workflow_state["events"]):
                workflow_state["events"].append(
                    {
                        "id": f"event-{uuid4().hex}",
                        "actorName": data.get("created_by") or "",
                        "actorDepartment": "Marketing",
                        "action": "REQUEST_RELEASED",
                        "title": "Design request released to Creative",
                        "body": "The design brief entered the Creative workflow.",
                        "timestamp": now.isoformat(),
                        "isNote": False,
                        "badge": {"text": "Released", "variant": "emerald"},
                    }
                )

        item = DesignRequest(
            request_code=temporary_request_code(),
            sample_request_id=data.get("sample_request_id"),
            # Creative Design requests use their DR material/request code.
            # Keep SR only on the actual Sample request, not its design mirror.
            sr_number=None,
            customer_name=str(data.get("customer_name") or "").strip(),
            program_name=data.get("program_name") or None,
            program_year=str(data.get("program_year") or "").strip() or None,
            status=data.get("status") or "Draft (Pre-SMT)",
            number_of_designs=number_of_designs,
            trend=data.get("trend") or None,
            target_audience=data.get("target_audience") or None,
            reference_image=data.get("reference_image") or None,
            product_description=data.get("product_description") or "",
            design_required_date=data.get("design_required_date") or None,
            created_by=data.get("created_by") or "",
            created_by_user_id=data.get("created_by_user_id"),
            design_remarks=data.get("design_remarks") or None,
            reference_images=data.get("reference_images") if isinstance(data.get("reference_images"), list) else [],
            reference_links=data.get("reference_links") if isinstance(data.get("reference_links"), list) else [],
            creative_submissions=data.get("creative_submissions") if isinstance(data.get("creative_submissions"), list) else [],
            marketing_decision=data.get("marketing_decision") or None,
            remaining_design_count=int(
                data.get("remaining_design_count")
                if data.get("remaining_design_count") is not None
                else number_of_designs
            ),
            workflow_state=workflow_state,
            created_at=now,
            updated_at=now,
        )
        self.db.add(item)
        try:
            self.db.flush()
            item.request_code = data.get("request_code") or next_request_code(
                self.db, REQUEST_CODE_PREFIX_BY_SCOPE["design"], now
            )
            linked_sample = self._get_linked_sample(
                item.request_code,
                data.get("sr_number"),
                sample_request_id=item.sample_request_id,
            )
            self.db.add(
                SampleRequestActivityLog(
                    sample_request_id=linked_sample.id if linked_sample else None,
                    request_sr_number=item.sr_number,
                    actor_user_id=data.get("created_by_user_id"),
                    actor_name=str(item.created_by or "Marketing")[:255],
                    actor_department="Marketing",
                    action="DESIGN_REQUEST_CREATED",
                    from_status=None,
                    to_status=item.status,
                    payload={
                        "design_request_id": item.id,
                        "request_code": item.request_code,
                        "number_of_designs": number_of_designs,
                        "event": workflow_state["events"][0],
                    },
                    created_at=now,
                )
            )
            if commit:
                self.db.commit()
                self.db.refresh(item)
            return self.to_dict(item)
        except Exception:
            self.db.rollback()
            raise

    def update_record(self, item_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a design request in PostgreSQL."""
        return self.mutate_record(item_id, lambda item: self._apply_updates(item, updates))

    @staticmethod
    def _apply_updates(item: DesignRequest, updates: Dict[str, Any]) -> None:
        column_names = {column.key for column in DesignRequest.__table__.columns}
        protected = {"id", "request_code", "sr_number", "created_at"}
        was_draft = str(item.status or "").casefold().startswith("draft")
        changed_fields = []
        for key, value in updates.items():
            if key in column_names and key not in protected:
                if getattr(item, key) != value:
                    changed_fields.append(key)
                setattr(item, key, value)
        released_now = was_draft and not str(item.status or "").casefold().startswith("draft")
        if released_now:
            state = dict(item.workflow_state or {})
            if not state.get("releasedAt"):
                now = datetime.now(timezone.utc).isoformat()
                state["releasedAt"] = now
                events = list(state.get("events") or [])
                events.append(
                    {
                        "id": f"event-{uuid4().hex}",
                        "actorName": item.created_by or "",
                        "actorDepartment": "Marketing",
                        "action": "REQUEST_RELEASED",
                        "title": "Released from Marketing Draft",
                        "body": "Marketing released this design request from the pre-SMT draft queue to Creative.",
                        "timestamp": now,
                        "isNote": False,
                        "badge": {"text": "Released", "variant": "emerald"},
                    }
                )
                state["events"] = events
                item.workflow_state = state
        audit_fields = [field for field in changed_fields if field != "status"]
        if "status" in changed_fields and not released_now:
            audit_fields.append("status")
        if audit_fields:
            state = dict(item.workflow_state or {})
            events = list(state.get("events") or [])
            events.insert(
                0,
                {
                    "id": f"event-{uuid4().hex}",
                    "actorName": item.created_by or "",
                    "actorDepartment": "Marketing",
                    "action": "DESIGN_REQUEST_UPDATED",
                    "title": "Design brief updated",
                    "body": "Updated " + ", ".join(field.replace("_", " ") for field in audit_fields) + ".",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "isNote": False,
                    "badge": {"text": "Updated", "variant": "neutral"},
                },
            )
            state["events"] = events[:500]
            item.workflow_state = state

    def mutate_record(
        self,
        item_id: int,
        mutator: Callable[[DesignRequest], None],
        *,
        actor_user_id: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        """Lock, mutate, and persist one workflow row in a single transaction."""
        item = (
            self.db.query(DesignRequest)
            .filter(DesignRequest.id == item_id)
            .with_for_update()
            .populate_existing()
            .first()
        )
        if not item:
            return None
        try:
            linked_sample = self._get_linked_sample(
                item.request_code,
                item.sr_number,
                sample_request_id=item.sample_request_id,
                for_update=True,
            )
            previous_sample_status = linked_sample.status if linked_sample else None
            previous_state = item.workflow_state if isinstance(item.workflow_state, dict) else {}
            previous_events = previous_state.get("events") if isinstance(previous_state.get("events"), list) else []
            previous_event_ids = {
                str(event.get("id"))
                for event in previous_events
                if isinstance(event, dict) and event.get("id")
            }

            mutator(item)
            if linked_sample is None and item.sample_request_id:
                linked_sample = self._get_linked_sample(
                    item.request_code,
                    item.sr_number,
                    sample_request_id=item.sample_request_id,
                    for_update=True,
                )
            if linked_sample and item.sample_request_id != linked_sample.id:
                item.sample_request_id = linked_sample.id
            item.updated_at = datetime.now(timezone.utc)
            next_state = item.workflow_state if isinstance(item.workflow_state, dict) else {}
            next_events = next_state.get("events") if isinstance(next_state.get("events"), list) else []
            new_events = [
                event
                for event in next_events
                if isinstance(event, dict) and event.get("id") and str(event.get("id")) not in previous_event_ids
            ]
            sample_request_id = linked_sample.id if linked_sample else None
            for event in new_events:
                timestamp = str(event.get("timestamp") or "")
                try:
                    created_at = (
                        datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                        if timestamp
                        else datetime.now(timezone.utc)
                    )
                except ValueError:
                    created_at = datetime.now(timezone.utc)
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                self.db.add(
                    SampleRequestActivityLog(
                        sample_request_id=sample_request_id,
                        request_sr_number=item.sr_number,
                        actor_user_id=actor_user_id,
                        actor_name=str(event.get("actorName") or item.created_by or "System")[:255],
                        actor_department=str(event.get("actorDepartment") or "Creative Studio")[:100],
                        action=str(event.get("action") or "DESIGN_EVENT")[:64],
                        from_status=previous_sample_status,
                        to_status=linked_sample.status if linked_sample else None,
                        payload=event,
                        created_at=created_at,
                    )
                )

            self.db.commit()
            self.db.refresh(item)
            return self.to_dict(item)
        except Exception:
            self.db.rollback()
            raise

    def delete_record(self, item_id: int) -> bool:
        """Delete a design request from PostgreSQL."""
        db_item = self.db.query(DesignRequest).filter(DesignRequest.id == item_id).first()
        if not db_item:
            return False
        self.db.delete(db_item)
        self.db.commit()
        return True

    def sync_sample_request_design(self, sample_req: Dict[str, Any], is_delete: bool = False, *, commit: bool = True):
        """Sync design requests whenever a sample request with 'design' scope is created, updated, or deleted."""
        sr_number = sample_req.get("sr_number")
        request_codes = sample_req.get("request_codes") if isinstance(sample_req.get("request_codes"), dict) else {}
        request_code = request_codes.get("design") or sample_req.get("design_request_code")
        if not sr_number and not request_code:
            return None

        if is_delete:
            item = self.get_model_by_request_code(request_code) if request_code else None
            if not item and sr_number:
                item = self.get_model_by_sr_number(sr_number)
            if item:
                self.db.delete(item)
                if commit:
                    self.db.commit()
            return None

        trend = sample_req.get("trend")
        target_audience = sample_req.get("target_audience", sample_req.get("targetAudience"))
        design_remarks = sample_req.get("design_remarks")
        if design_remarks is None:
            design_remarks = sample_req.get("designRemarks")
        ref_images = sample_req.get("reference_images", sample_req.get("referenceImages"))
        ref_links = sample_req.get("reference_links", sample_req.get("referenceLinks"))
        ref_images = ref_images if isinstance(ref_images, list) else []
        ref_links = ref_links if isinstance(ref_links, list) else []
        ref_image = (
            sample_req.get("product_image_path")
            or sample_req.get("reference_image")
            or (ref_images[0] if ref_images else None)
        )
        raw_num_designs = (
            sample_req.get("number_of_designs")
            or sample_req.get("product_artwork_nos")
            or sample_req.get("designs_customer_creative")
        )
        try:
            num_designs = int(raw_num_designs) if raw_num_designs not in (None, "") else None
            if num_designs is not None and num_designs < 1:
                num_designs = None
        except (ValueError, TypeError):
            num_designs = None

        req_date = (
            sample_req.get("design_required_date")
            or sample_req.get("target_artwork_date_creative")
            or sample_req.get("sample_required_date")
        )
        desc = sample_req.get("product_description") or ""

        current = self.get_model_by_request_code(request_code) if request_code else None
        if not current and sr_number:
            current = self.get_model_by_sr_number(sr_number)
        if not current:
            status_value = sample_req.get("status") or "Draft (Pre-SMT)"
            return self.create_record(
                {
                    "sr_number": None,
                    "request_code": request_code,
                    "customer_name": sample_req.get("customer") or sample_req.get("customer_name") or "",
                    "program_name": sample_req.get("program_name", ""),
                    "program_year": sample_req.get("program_year"),
                    "status": status_value,
                    "number_of_designs": num_designs or 1,
                    "remaining_design_count": num_designs or 1,
                    "product_description": desc,
                    "design_required_date": req_date,
                    "trend": trend,
                    "target_audience": target_audience,
                    "reference_image": ref_image,
                    "reference_images": ref_images,
                    "reference_links": ref_links,
                    "design_remarks": design_remarks,
                    "created_by": sample_req.get("created_by") or "",
                    "created_by_user_id": sample_req.get("created_by_user_id"),
                    "sample_request_id": sample_req.get("id"),
                    "workflow_state": {},
                },
                commit=commit,
            )

        updates: Dict[str, Any] = {}
        if sample_req.get("id") is not None:
            updates["sample_request_id"] = sample_req.get("id")
        # Normalize older mirrored rows as they are touched. The link is now
        # resolved through DR code, with the legacy SR retained as fallback.
        if current.sr_number is not None:
            current.sr_number = None
        if sample_req.get("status"):
            updates["status"] = sample_req["status"]
        if "trend" in sample_req:
            updates["trend"] = str(trend or "").strip() or None
        if "target_audience" in sample_req or "targetAudience" in sample_req:
            updates["target_audience"] = str(target_audience or "").strip() or None
        if "design_remarks" in sample_req or "designRemarks" in sample_req:
            updates["design_remarks"] = str(design_remarks or "").strip() or None
        updates["reference_images"] = ref_images
        updates["reference_links"] = ref_links
        if ref_image is not None:
            updates["reference_image"] = ref_image
        if num_designs is not None:
            updates["number_of_designs"] = num_designs
            if not (current.creative_submissions or []):
                updates["remaining_design_count"] = num_designs
        if req_date is not None or any(
            key in sample_req for key in ("design_required_date", "target_artwork_date_creative", "sample_required_date")
        ):
            updates["design_required_date"] = req_date or None
        if "product_description" in sample_req:
            updates["product_description"] = desc
        if "customer" in sample_req or "customer_name" in sample_req:
            updates["customer_name"] = str(sample_req.get("customer") or sample_req.get("customer_name") or "").strip()
        if sample_req.get("program_name") is not None:
            updates["program_name"] = sample_req.get("program_name") or None
        if sample_req.get("program_year") is not None:
            updates["program_year"] = sample_req.get("program_year")

        self._apply_updates(current, updates)
        current.updated_at = datetime.now(timezone.utc)
        if commit:
            self.db.commit()
            self.db.refresh(current)
        return self.to_dict(current)

    @staticmethod
    def to_dict(item: DesignRequest) -> Dict[str, Any]:
        """Convert a DesignRequest model instance into a clean dictionary."""
        creative_submissions = []
        for batch in item.creative_submissions or []:
            if not isinstance(batch, dict):
                continue
            clean_batch = {key: value for key, value in batch.items() if key != "rows"}
            clean_rows = []
            for row in batch.get("rows") or []:
                if not isinstance(row, dict):
                    continue
                clean_rows.append(
                    {
                        "design_number": row.get("design_number") or row.get("designNumber") or "",
                        "description": row.get("description") or "",
                        "shutterstock_no": row.get("shutterstock_no") or row.get("shutterstockNo") or "",
                        "remarks": row.get("remarks") or "",
                    }
                )
            clean_batch["rows"] = clean_rows
            creative_submissions.append(clean_batch)
        return {
            "id": item.id,
            "request_code": item.request_code,
            "sample_request_id": item.sample_request_id,
            "sr_number": item.sr_number,
            "customer_name": item.customer_name,
            "program_name": item.program_name,
            "program_year": item.program_year,
            "status": item.status,
            "number_of_designs": item.number_of_designs,
            "trend": item.trend,
            "target_audience": item.target_audience,
            "reference_image": item.reference_image,
            "product_description": item.product_description,
            "design_required_date": item.design_required_date,
            "created_by": item.created_by,
            "created_by_user_id": item.created_by_user_id,
            "design_remarks": item.design_remarks,
            "reference_images": item.reference_images or [],
            "reference_links": item.reference_links or [],
            "creative_submissions": creative_submissions,
            "marketing_decision": item.marketing_decision,
            "remaining_design_count": item.remaining_design_count or 0,
            "workflow_state": item.workflow_state or {},
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        }

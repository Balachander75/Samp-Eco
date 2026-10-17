"""
Program Request Service.
Encapsulates business operations for Seasonal Program Planning, Material Matrices,
and permanent audit chatter logging.
"""
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.repositories.program_request_repo import ProgramRequestRepository
from app.models.program_request import ProgramRequest
from app.schemas.program_request import (
    ProgramRequestCreate,
    ProgramRequestUpdate,
    ProgramBatchSampRemarksUpdate,
    SingleSampRemarkUpdate,
    ProgramMaterialCreate,
    ProgramSeenSubmit,
)
from app.utils.business_year import get_current_business_year
from app.utils.request_codes import REQUEST_CODE_PREFIX_BY_SCOPE, next_request_code, temporary_request_code
from app.auth.permissions import is_admin


class ProgramRequestService:
    """Application service for Seasonal Program Planning."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = ProgramRequestRepository(db)

    def _get_actor_info(self, current_user: Optional[Any] = None) -> Tuple[Optional[int], str, str]:
        """Extract user id, display name, and department from current_user object."""
        if current_user:
            name = (
                getattr(current_user, "name", None)
                or getattr(current_user, "username", None)
                or getattr(current_user, "email", None)
                or "Unknown User"
            )
            dept = (
                getattr(current_user, "team", None)
                or getattr(current_user, "department", None)
                or getattr(current_user, "role", None)
                or "Marketing"
            )
            normalized_dept = str(dept).strip().casefold()
            if "marketing" in normalized_dept:
                dept = "Marketing"
            elif "samp" in normalized_dept or "sampling" in normalized_dept:
                dept = "SAMP Team"
            elif "plant" in normalized_dept:
                dept = "Plant"
            elif "creative" in normalized_dept or "studio" in normalized_dept:
                dept = "Creative Studio"
            elif normalized_dept == "admin":
                dept = "Admin"
            uid = getattr(current_user, "id", None)
            return uid, name, dept
        return None, "System Operator", "System"

    def serialize(self, item: ProgramRequest, include_activities: bool = True) -> Dict[str, Any]:
        """Serializes a ProgramRequest, material matrix, and activity audit logs."""
        return {
            "id": item.id,
            "request_code": item.request_code,
            "sr_number": item.sr_number,
            "customer_name": item.customer_name,
            "target_plant": item.target_plant,
            "program_campaign_title": item.program_campaign_title,
            "program_year": item.program_year,
            "status": item.status,
            "is_active": getattr(item, "is_active", True) if getattr(item, "is_active", None) is not None else True,
            "created_by": item.created_by,
            "created_by_user_id": item.created_by_user_id,
            "sampling_seen_at": item.sampling_seen_at,
            "sampling_seen_by": item.sampling_seen_by,
            "sampling_verdict": item.sampling_verdict,
            "sampling_remark": item.sampling_remark,
            "sampling_signed_at": item.sampling_signed_at,
            "sampling_signed_by": item.sampling_signed_by,
            "sampling_claimed_by_user_id": item.sampling_claimed_by_user_id,
            "sampling_claimed_by": item.sampling_claimed_by,
            "plant_seen_at": item.plant_seen_at,
            "plant_seen_by": item.plant_seen_by,
            "plant_verdict": item.plant_verdict,
            "plant_remark": item.plant_remark,
            "plant_signed_at": item.plant_signed_at,
            "plant_signed_by": item.plant_signed_by,
            "plant_claimed_by_user_id": item.plant_claimed_by_user_id,
            "plant_claimed_by": item.plant_claimed_by,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "materials": [
                {
                    "id": m.id,
                    "program_request_id": m.program_request_id,
                    "material_type": m.material_type,
                    "supplier_name": m.supplier_name,
                    "grade": m.grade,
                    "color_variant": m.color_variant,
                    "caliper_wt": m.caliper_wt,
                    "quantity": m.quantity,
                    "unit": m.unit,
                    "remark": m.remark,
                    "samp_remark": m.samp_remark,
                    "created_at": m.created_at,
                    "updated_at": m.updated_at,
                }
                for m in (item.materials or [])
            ],
            "activities": [
                {
                    "id": a.id,
                    "program_request_id": a.program_request_id,
                    "actor_id": a.actor_id,
                    "actor_name": a.actor_name,
                    "actor_department": a.actor_department,
                    "action": a.action,
                    "payload": a.payload or {},
                    "created_at": a.created_at,
                    "pinned_by_marketing": a.pinned_by_marketing,
                    "pinned_by": a.pinned_by,
                    "pinned_at": a.pinned_at,
                }
                for a in sorted(item.activities or [], key=lambda x: x.id)
            ] if include_activities else [],
        }

    def list_all(
        self,
        year: Optional[str] = None,
        status_filter: Optional[str] = None,
        plant_labels: Optional[set[str]] = None,
        created_by_user_id: Optional[int] = None,
        visible_samp_user_id: Optional[int] = None,
        visible_plant_user_id: Optional[int] = None,
        offset: int = 0,
        limit: Optional[int] = None,
        before_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """List program requests for the selected business year."""
        items = self.repo.list_all_detailed(
            year=year, status_filter=status_filter, plant_labels=plant_labels,
            created_by_user_id=created_by_user_id,
            visible_samp_user_id=visible_samp_user_id,
            visible_plant_user_id=visible_plant_user_id,
            offset=offset,
            limit=limit,
            before_id=before_id,
        )
        return [self.serialize(i, include_activities=False) for i in items]

    def get_by_id(self, request_id: int) -> Optional[Dict[str, Any]]:
        """Fetch single program request by ID."""
        item = self.repo.get_with_materials(request_id)
        if not item:
            return None
        return self.serialize(item)

    def create(self, payload: ProgramRequestCreate, current_user: Optional[Any] = None) -> Dict[str, Any]:
        """Create program planning request and assign contiguous codes."""
        actor_id, actor_name, actor_dept = self._get_actor_info(current_user)
        # The authenticated identity is authoritative; never trust a creator
        # name supplied in the request body for the audit record.
        creator_name = actor_name or "Marketing Team"

        program_req = ProgramRequest(
            request_code=temporary_request_code(),
            sr_number=None,
            customer_name=payload.customer_name.strip(),
            target_plant=payload.target_plant.strip(),
            program_campaign_title=payload.program_campaign_title.strip(),
            program_year=(payload.program_year or get_current_business_year()).strip(),
            status="Pending SAMP Review",
            created_by=creator_name,
            created_by_user_id=actor_id,
        )
        self.db.add(program_req)
        self.db.flush()

        program_req.request_code = next_request_code(
            self.db,
            REQUEST_CODE_PREFIX_BY_SCOPE["program"],
            program_req.created_at or datetime.now(timezone.utc),
        )

        materials_count = 0
        if payload.materials:
            for mat_item in payload.materials:
                self.repo.add_material(
                    program_request_id=program_req.id,
                    commit=False,
                    material_data={
                        "material_type": (mat_item.material_type or "").strip() or None,
                        "supplier_name": (mat_item.supplier_name or "").strip() or None,
                        "grade": (mat_item.grade or "").strip() or None,
                        "color_variant": (mat_item.color_variant or "").strip() or None,
                        "caliper_wt": (mat_item.caliper_wt or "").strip() or None,
                        "quantity": (mat_item.quantity or "").strip() or None,
                        "unit": (mat_item.unit or "").strip() or None,
                        "remark": (mat_item.remark or "").strip() or None,
                        "samp_remark": (mat_item.samp_remark or "").strip() or None,
                    },
                )
                materials_count += 1

        # Audit activity
        self.repo.add_activity_log(
            program_request_id=program_req.id,
            actor_name=creator_name,
            actor_department=actor_dept if current_user else "Marketing",
            action="CREATED",
            payload={
                "customer_name": program_req.customer_name,
                "program_campaign_title": program_req.program_campaign_title,
                "material_count": materials_count,
            },
            actor_id=actor_id,
        )

        self.db.commit()
        item = self.repo.get_with_materials(program_req.id)
        return self.serialize(item)

    def update(
        self,
        request_id: int,
        payload: ProgramRequestUpdate,
        current_user: Optional[Any] = None,
    ) -> Optional[Dict[str, Any]]:
        """Update high-level metadata."""
        item = self.repo.get_with_materials(request_id)
        if not item:
            return None

        actor_id, actor_name, actor_dept = self._get_actor_info(current_user)
        updates = payload.model_dump(exclude_unset=True)
        if updates.get("status") is not None:
            raise HTTPException(status_code=409, detail="Program plan status cannot be edited manually")
        protected_fields = {"sampling_verdict", "sampling_remark", "plant_verdict", "plant_remark"}
        if protected_fields.intersection(updates):
            raise HTTPException(status_code=409, detail="Review fields must be changed through the team review workflow")
        old_status = item.status

        for field, value in updates.items():
            if value is not None:
                setattr(item, field, value)

        # Audit status changes or general updates
        if "status" in updates and updates["status"] != old_status:
            self.repo.add_activity_log(
                program_request_id=item.id,
                actor_name=actor_name,
                actor_department=actor_dept,
                action="STATUS_UPDATED",
                payload={"old_status": old_status, "new_status": item.status},
                actor_id=actor_id,
            )
        elif updates:
            self.repo.add_activity_log(
                program_request_id=item.id,
                actor_name=actor_name,
                actor_department=actor_dept,
                action="UPDATED",
                payload={"fields": list(updates.keys())},
                actor_id=actor_id,
            )

        self.db.commit()
        self.db.refresh(item)
        return self.serialize(item)

    def update_batch_samp_remarks(
        self,
        request_id: int,
        payload: ProgramBatchSampRemarksUpdate,
        current_user: Optional[Any] = None,
    ) -> Optional[Dict[str, Any]]:
        """Batch update SAMP remarks on materials."""
        item = self.repo.get_for_update(request_id)
        if not item:
            return None

        self._claim_team_task(item, "sampling", current_user)
        actor_id, actor_name, actor_dept = self._get_actor_info(current_user)
        mat_map = {mat.id: mat for mat in item.materials}
        updated_count = 0

        for remark_update in payload.remarks:
            mat = mat_map.get(remark_update.material_id)
            if mat:
                mat.samp_remark = (remark_update.samp_remark or "").strip() or None
                updated_count += 1

        self.repo.add_activity_log(
            program_request_id=item.id,
            actor_name=actor_name,
            actor_department=actor_dept,
            action="SAMP_REMARKS_UPDATED",
            payload={"updated_count": updated_count},
            actor_id=actor_id,
        )

        self.db.commit()
        self.db.refresh(item)
        return self.serialize(item)

    def update_single_samp_remark(
        self,
        request_id: int,
        material_id: int,
        payload: SingleSampRemarkUpdate,
        current_user: Optional[Any] = None,
    ) -> Optional[Dict[str, Any]]:
        """Update single SAMP remark."""
        item = self.repo.get_for_update(request_id)
        if not item:
            return None
        self._claim_team_task(item, "sampling", current_user)
        mat = next((m for m in item.materials if m.id == material_id), None)
        if not mat:
            return None

        actor_id, actor_name, actor_dept = self._get_actor_info(current_user)
        old_remark = mat.samp_remark
        new_remark = (payload.samp_remark or "").strip() or None
        mat.samp_remark = new_remark

        self.repo.add_activity_log(
            program_request_id=item.id,
            actor_name=actor_name,
            actor_department=actor_dept,
            action="SAMP_REMARK_UPDATED",
            payload={
                "material_id": material_id,
                "material_type": mat.material_type,
                "old_remark": old_remark,
                "new_remark": new_remark,
            },
            actor_id=actor_id,
        )

        self.db.commit()
        self.db.refresh(item)
        return self.serialize(item)

    def add_material(
        self,
        request_id: int,
        payload: ProgramMaterialCreate,
        current_user: Optional[Any] = None,
    ) -> Optional[Dict[str, Any]]:
        """Add single material spec to program request."""
        item = self.repo.get_with_materials(request_id)
        if not item:
            return None

        actor_id, actor_name, actor_dept = self._get_actor_info(current_user)
        mat = self.repo.add_material(
            program_request_id=request_id,
            material_data={
                "material_type": (payload.material_type or "").strip() or None,
                "supplier_name": (payload.supplier_name or "").strip() or None,
                "grade": (payload.grade or "").strip() or None,
                "color_variant": (payload.color_variant or "").strip() or None,
                "caliper_wt": (payload.caliper_wt or "").strip() or None,
                "quantity": (payload.quantity or "").strip() or None,
                "unit": (payload.unit or "").strip() or None,
                "remark": (payload.remark or "").strip() or None,
                "samp_remark": (payload.samp_remark or "").strip() or None,
            },
        )

        self.repo.add_activity_log(
            program_request_id=item.id,
            actor_name=actor_name,
            actor_department=actor_dept,
            action="MATERIAL_ADDED",
            payload={
                "material_id": mat.id,
                "material_type": mat.material_type,
                "supplier_name": mat.supplier_name,
                "grade": mat.grade,
                "color_variant": mat.color_variant,
                "caliper_wt": mat.caliper_wt,
                "quantity": mat.quantity,
                "unit": mat.unit,
                "remark": mat.remark,
                "created_at": mat.created_at.isoformat() if mat.created_at else None,
            },
            actor_id=actor_id,
        )

        self.db.refresh(item)
        return self.serialize(item)

    def delete_material(
        self,
        request_id: int,
        material_id: int,
        current_user: Optional[Any] = None,
    ) -> Optional[Dict[str, Any]]:
        """Delete material spec from program request."""
        item = self.repo.get_with_materials(request_id)
        if not item:
            return None

        mat = next((m for m in item.materials if m.id == material_id), None)
        if not mat:
            return None

        actor_id, actor_name, actor_dept = self._get_actor_info(current_user)
        mat_type = mat.material_type

        deleted = self.repo.delete_material(request_id, material_id)
        if not deleted:
            return None

        self.repo.add_activity_log(
            program_request_id=item.id,
            actor_name=actor_name,
            actor_department=actor_dept,
            action="MATERIAL_DELETED",
            payload={"material_id": material_id, "material_type": mat_type},
            actor_id=actor_id,
        )

        self.db.refresh(item)
        return self.serialize(item)

    def add_note(
        self,
        request_id: int,
        note: str,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Add a persistent communication note to program request chatter audit log."""
        item = self.repo.get_with_materials(request_id)
        if not item:
            raise HTTPException(status_code=404, detail="Program planning request was not found")

        trimmed_note = (note or "").strip()
        if not trimmed_note:
            raise HTTPException(status_code=400, detail="Note content cannot be empty")

        actor_id, actor_name, actor_dept = self._get_actor_info(current_user)

        self.repo.add_activity_log(
            program_request_id=item.id,
            actor_name=actor_name,
            actor_department=actor_dept,
            action="NOTE_POSTED",
            payload={"note": trimmed_note},
            actor_id=actor_id,
        )

        self.db.refresh(item)
        return self.serialize(item)

    def submit_output(
        self,
        request_id: int,
        department: str,
        remark: str,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Save a SAMP or Plant planning observation as an auditable output."""
        item = self.repo.get_for_update(request_id)
        if not item:
            raise HTTPException(status_code=404, detail="Program planning request was not found")
        department = department.strip().casefold()
        trimmed_remark = (remark or "").strip()
        if department not in {"sampling", "plant"}:
            raise HTTPException(status_code=422, detail="Department must be SAMP or Plant")
        if not trimmed_remark:
            raise HTTPException(status_code=422, detail="Enter an output remark before saving")

        actor_id, actor_name, _ = self._get_actor_info(current_user)
        now = datetime.now(timezone.utc)
        if department == "sampling":
            self._claim_team_task(item, "sampling", current_user)
            item.sampling_remark = trimmed_remark
            item.sampling_signed_at = now
            item.sampling_signed_by = actor_name
            item.sampling_seen_at = item.sampling_seen_at or now
            item.sampling_seen_by = item.sampling_seen_by or actor_name
            action = "SAMP_OUTPUT"
            actor_department = "SAMP Team"
        else:
            self._claim_team_task(item, "plant", current_user)
            item.plant_remark = trimmed_remark
            item.plant_signed_at = now
            item.plant_signed_by = actor_name
            item.plant_seen_at = item.plant_seen_at or now
            item.plant_seen_by = item.plant_seen_by or actor_name
            action = "PLANT_OUTPUT"
            actor_department = f"Plant ({item.target_plant})"

        self.repo.add_activity_log(
            program_request_id=item.id,
            actor_name=actor_name,
            actor_department=actor_department,
            action=action,
            payload={"remark": trimmed_remark},
            actor_id=actor_id,
        )
        self.db.refresh(item)
        return self.serialize(item)

    def claim_task(
        self,
        request_id: int,
        department: str,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Claim a program planning review task for Sampling Team or Plant Team."""
        item = self.repo.get_for_update(request_id)
        if not item:
            raise HTTPException(status_code=404, detail="Program planning request was not found")

        dept = department.strip().casefold()
        if dept not in {"sampling", "plant"}:
            raise HTTPException(status_code=422, detail="Department must be sampling or plant")

        actor_id, actor_name, _ = self._get_actor_info(current_user)
        is_admin_user = is_admin(current_user) if current_user else False
        now = datetime.now(timezone.utc)

        if dept == "sampling":
            current_id = item.sampling_claimed_by_user_id
            current_name = item.sampling_claimed_by
            if current_id and current_id != actor_id and not is_admin_user:
                raise HTTPException(
                    status_code=409,
                    detail=f"This Sampling review is already claimed by {current_name or 'another team member'}",
                )
            if current_id == actor_id and item.sampling_claimed_by:
                return self.serialize(item)

            item.sampling_claimed_by_user_id = actor_id
            item.sampling_claimed_by = actor_name
            if not item.sampling_seen_at:
                item.sampling_seen_at = now
                item.sampling_seen_by = actor_name
            action = "SAMP_TASK_CLAIMED"
            actor_dept = "SAMP Team"
        else:
            current_id = item.plant_claimed_by_user_id
            current_name = item.plant_claimed_by
            if current_id and current_id != actor_id and not is_admin_user:
                raise HTTPException(
                    status_code=409,
                    detail=f"This Plant review is already claimed by {current_name or 'another team member'}",
                )
            if current_id == actor_id and item.plant_claimed_by:
                return self.serialize(item)

            item.plant_claimed_by_user_id = actor_id
            item.plant_claimed_by = actor_name
            if not item.plant_seen_at:
                item.plant_seen_at = now
                item.plant_seen_by = actor_name
            action = "PLANT_TASK_CLAIMED"
            actor_dept = f"Plant ({item.target_plant})"

        self.repo.add_activity_log(
            program_request_id=item.id,
            actor_name=actor_name,
            actor_department=actor_dept,
            action=action,
            payload={"claimed_by": actor_name, "claimed_by_user_id": actor_id, "department": dept},
            actor_id=actor_id,
        )
        self.db.commit()
        self.db.refresh(item)
        return self.serialize(item)

    @staticmethod
    def _claim_team_task(item: ProgramRequest, department: str, current_user: Optional[Any]) -> None:
        """Ensure the user has claimed the SAMP/Plant review lane before submitting remarks."""
        if not current_user:
            return
        field_prefix = "sampling" if department == "sampling" else "plant"
        id_field = f"{field_prefix}_claimed_by_user_id"
        name_field = f"{field_prefix}_claimed_by"
        actor_id, actor_name, _ = ProgramRequestService._actor_info_for_claim(current_user)
        current_id = getattr(item, id_field)
        current_name = getattr(item, name_field)
        is_admin_user = is_admin(current_user) if current_user else False

        if not current_id and not is_admin_user:
            raise HTTPException(
                status_code=409,
                detail=f"Please claim this {department} review task before submitting observations or line remarks."
            )
        if current_id and current_id != actor_id and not is_admin_user:
            raise HTTPException(
                status_code=409,
                detail=f"This {department} review is already claimed by {current_name or 'another team member'}."
            )

    @staticmethod
    def _actor_info_for_claim(current_user: Any) -> Tuple[Optional[int], str, str]:
        user_id = getattr(current_user, "id", None)
        name = getattr(current_user, "name", None) or getattr(current_user, "userid", None) or "Team member"
        return user_id, str(name), ""

    def pin_output(
        self, request_id: int, activity_id: int, pinned: bool, current_user: Optional[Any] = None
    ) -> Dict[str, Any]:
        item = self.repo.get_for_update(request_id)
        if not item:
            raise HTTPException(status_code=404, detail="Program planning request was not found")
        activity = next((entry for entry in item.activities if entry.id == activity_id), None)
        if not activity or activity.action not in {"SAMP_OUTPUT", "PLANT_OUTPUT"}:
            raise HTTPException(status_code=404, detail="Team output was not found")
        actor_id, actor_name, _ = self._get_actor_info(current_user)
        activity.pinned_by_marketing = pinned
        activity.pinned_by = actor_name if pinned else None
        activity.pinned_at = datetime.now(timezone.utc) if pinned else None
        self.repo.add_activity_log(
            program_request_id=item.id,
            actor_name=actor_name,
            actor_department="Marketing",
            action="OUTPUT_PINNED" if pinned else "OUTPUT_UNPINNED",
            payload={"output_activity_id": activity_id},
            actor_id=actor_id,
        )
        self.db.refresh(item)
        return self.serialize(item)

    def reply_to_output(
        self, request_id: int, activity_id: int, remark: str, current_user: Optional[Any] = None
    ) -> Dict[str, Any]:
        item = self.repo.get_for_update(request_id)
        if not item:
            raise HTTPException(status_code=404, detail="Program planning request was not found")
        activity = next((entry for entry in item.activities if entry.id == activity_id), None)
        if not activity or activity.action not in {"SAMP_OUTPUT", "PLANT_OUTPUT"} or not activity.pinned_by_marketing:
            raise HTTPException(status_code=409, detail="Pin the SAMP or Plant output before adding a Marketing remark")
        trimmed_remark = (remark or "").strip()
        if not trimmed_remark:
            raise HTTPException(status_code=422, detail="Enter a Marketing remark")
        actor_id, actor_name, _ = self._get_actor_info(current_user)
        self.repo.add_activity_log(
            program_request_id=item.id,
            actor_name=actor_name,
            actor_department="Marketing",
            action="MARKETING_OUTPUT_REPLY",
            payload={"output_activity_id": activity_id, "remark": trimmed_remark},
            actor_id=actor_id,
        )
        self.db.refresh(item)
        return self.serialize(item)
    def mark_seen(
        self,
        request_id: int,
        payload: ProgramSeenSubmit,
        current_user: Optional[Any] = None,
    ) -> Optional[Dict[str, Any]]:
        """Mark program request as seen by Sampling Team or Plant Team."""
        item = self.repo.get_with_materials(request_id)
        if not item:
            return None

        actor_id, actor_name, actor_dept = self._get_actor_info(current_user)
        viewer_name = actor_name if current_user else (payload.actor_name or actor_name)
        now = datetime.now(timezone.utc)
        dept = payload.department.lower()

        is_new_view = False
        if "samp" in dept:
            if not item.sampling_seen_at:
                item.sampling_seen_at = now
                item.sampling_seen_by = viewer_name
                is_new_view = True
                action = "SAMP_VIEWED"
                log_dept = "SAMP Team"
        else:
            if not item.plant_seen_at:
                item.plant_seen_at = now
                item.plant_seen_by = viewer_name
                is_new_view = True
                action = "PLANT_VIEWED"
                log_dept = f"Plant Desk ({item.target_plant or 'Fulfillment'})"

        if is_new_view:
            self.repo.add_activity_log(
                program_request_id=item.id,
                actor_name=viewer_name,
                actor_department=log_dept,
                action=action,
                payload={
                    "viewer": viewer_name,
                    "department": payload.department,
                    "viewed_at": now.isoformat(),
                },
                actor_id=actor_id,
            )
            self.db.commit()
            self.db.refresh(item)

        return self.serialize(item)

    def toggle_pause(
        self,
        request_id: int,
        paused: bool,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Marketing creator or Admin pauses/resumes execution of a seasonal program."""
        item = self.repo.get_for_update(request_id)
        if not item:
            raise HTTPException(status_code=404, detail="Program planning request was not found")

        actor_id, actor_name, actor_dept = self._get_actor_info(current_user)
        item.is_active = not paused

        action = "PROGRAM_PAUSED" if paused else "PROGRAM_RESUMED"
        note = "Seasonal Program was paused by Marketing" if paused else "Seasonal Program was resumed by Marketing"

        self.repo.add_activity_log(
            program_request_id=item.id,
            actor_name=actor_name,
            actor_department=actor_dept if current_user else "Marketing",
            action=action,
            payload={
                "is_active": item.is_active,
                "paused": paused,
                "note": note,
            },
            actor_id=actor_id,
        )
        self.db.commit()
        self.db.refresh(item)
        return self.serialize(item)

    def delete(self, request_id: int) -> bool:
        """Delete a program request without changing any surviving business codes."""
        item = self.repo.get_by_id(request_id)
        if not item:
            return False
        self.db.delete(item)
        self.db.commit()
        return True

"""
Feasibility Request Repository.
Handles all database operations for `feasibility_requests`, `feasibility_activity_logs`,
and `feasibility_reference_images`.
"""
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, or_
from app.repositories.base import BaseRepository
from app.models.feasibility import (
    FeasibilityRequest,
    FeasibilityActivityLog,
    FeasibilityReferenceImage,
)
from app.utils.business_year import get_business_year_date_range
from datetime import datetime, time, timezone


class FeasibilityRepository(BaseRepository[FeasibilityRequest]):
    """Repository dedicated to feasibility requests and their audit logs."""

    def __init__(self, db: Session):
        super().__init__(FeasibilityRequest, db)

    def _eager_options(self, include_activities: bool = True):
        options = [
            joinedload(FeasibilityRequest.customer),
        ]
        if include_activities:
            options.append(selectinload(FeasibilityRequest.activities))
        options.append(
            selectinload(FeasibilityRequest.reference_image_records).load_only(
                FeasibilityReferenceImage.id,
                FeasibilityReferenceImage.feasibility_request_id,
                FeasibilityReferenceImage.original_name,
                FeasibilityReferenceImage.content_type,
                FeasibilityReferenceImage.sort_order,
            )
        )
        return tuple(options)

    def get_with_details(self, request_id: int) -> Optional[FeasibilityRequest]:
        """Fetch request with eager-loaded customer, activities, and image metadata."""
        return (
            self.db.query(FeasibilityRequest)
            .options(*self._eager_options())
            .filter(FeasibilityRequest.id == request_id)
            .first()
        )

    def get_for_update(self, request_id: int) -> Optional[FeasibilityRequest]:
        """Lock a workflow row while applying an ownership-sensitive transition."""
        return (
            self.db.query(FeasibilityRequest)
            .filter(FeasibilityRequest.id == request_id)
            .with_for_update()
            .populate_existing()
            .first()
        )

    def list_all_detailed(
        self,
        year: Optional[str] = None,
        status_filter: Optional[str] = None,
        created_by_user_id: Optional[int] = None,
        visible_samp_user_id: Optional[int] = None,
        offset: int = 0,
        limit: Optional[int] = None,
        before_id: Optional[int] = None,
    ) -> List[FeasibilityRequest]:
        """List queue rows without loading activity history for an optional business year."""
        query = (
            self.db.query(FeasibilityRequest)
            .options(*self._eager_options(include_activities=False))
        )
        if year and year.strip().upper() != "ALL":
            date_range = get_business_year_date_range(year)
            if date_range:
                start, end = date_range
                query = query.filter(
                    FeasibilityRequest.request_raised_at >= datetime.combine(start, time.min, tzinfo=timezone.utc),
                    FeasibilityRequest.request_raised_at < datetime.combine(end, time.min, tzinfo=timezone.utc),
                )
        if status_filter and status_filter.strip():
            query = query.filter(FeasibilityRequest.status == status_filter.strip())
        if created_by_user_id is not None:
            query = query.filter(FeasibilityRequest.created_by_user_id == created_by_user_id)
        if visible_samp_user_id is not None:
            query = query.filter(or_(
                FeasibilityRequest.taken_by_samp_user_id.is_(None),
                FeasibilityRequest.taken_by_samp_user_id == visible_samp_user_id,
            ))
        if before_id is not None:
            query = query.filter(FeasibilityRequest.id < before_id)
        query = query.order_by(FeasibilityRequest.id.desc())
        if offset > 0:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    def add_activity_log(
        self,
        feasibility_request_id: int,
        actor_id: Optional[int],
        actor_name: str,
        actor_department: str,
        action: str,
        payload: Dict[str, Any],
        commit: bool = True,
    ) -> FeasibilityActivityLog:
        """Append an audit log event to a feasibility request."""
        request = self.db.get(FeasibilityRequest, feasibility_request_id)
        log = FeasibilityActivityLog(
            feasibility_request_id=feasibility_request_id,
            request_code=request.request_code if request else None,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_department=actor_department,
            action=action,
            payload=payload,
        )
        self.db.add(log)
        if commit:
            self.db.commit()
            self.db.refresh(log)
        return log

    def get_image_record(self, request_id: int, image_id: int) -> Optional[FeasibilityReferenceImage]:
        """Fetch image binary content by image ID."""
        return (
            self.db.query(FeasibilityReferenceImage)
            .filter(
                FeasibilityReferenceImage.id == image_id,
                FeasibilityReferenceImage.feasibility_request_id == request_id,
            )
            .first()
        )

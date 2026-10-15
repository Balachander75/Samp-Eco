"""
Program Request Repository.
Handles all database operations for `program_requests` and `program_material_specifications`.
"""
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func, literal_column, text
from app.repositories.base import BaseRepository
from app.models.program_request import (
    ProgramActivityLog,
    ProgramMaterialSpecification,
    ProgramRequest,
)
from app.utils.business_year import get_business_year_date_range
from datetime import datetime, time, timezone
from sqlalchemy import and_, or_


class ProgramRequestRepository(BaseRepository[ProgramRequest]):
    """Repository dedicated to seasonal program requests and material matrix."""

    def __init__(self, db: Session):
        super().__init__(ProgramRequest, db)

    def list_all_detailed(
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
    ) -> List[ProgramRequest]:
        """List program queue rows and material matrix without loading audit history."""
        query = (
            self.db.query(ProgramRequest)
            .options(selectinload(ProgramRequest.materials))
        )
        if year and year.strip().upper() != "ALL":
            clean_year = year.strip()
            date_range = get_business_year_date_range(clean_year)
            if date_range and "-" in clean_year and len(clean_year) == 9:
                start, end = date_range
                start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
                end_dt = datetime.combine(end, time.min, tzinfo=timezone.utc)
                _, second_yr = clean_year.split("-")
                query = query.filter(or_(
                    ProgramRequest.program_year == clean_year,
                    ProgramRequest.program_year == second_yr,
                    and_(
                        or_(
                            ProgramRequest.program_year.is_(None),
                            func.trim(ProgramRequest.program_year) == "",
                        ),
                        ProgramRequest.created_at >= start_dt,
                        ProgramRequest.created_at < end_dt,
                    ),
                ))
            else:
                query = query.filter(ProgramRequest.program_year == clean_year)
        if status_filter and status_filter.strip():
            query = query.filter(ProgramRequest.status == status_filter.strip())
        if created_by_user_id is not None:
            query = query.filter(ProgramRequest.created_by_user_id == created_by_user_id)
        if visible_samp_user_id is not None:
            query = query.filter(or_(
                ProgramRequest.sampling_claimed_by_user_id.is_(None),
                ProgramRequest.sampling_claimed_by_user_id == visible_samp_user_id,
            ))
        if visible_plant_user_id is not None:
            query = query.filter(or_(
                ProgramRequest.plant_claimed_by_user_id.is_(None),
                ProgramRequest.plant_claimed_by_user_id == visible_plant_user_id,
            ))
        if plant_labels is not None:
            normalized_plant = func.regexp_replace(
                func.lower(func.coalesce(ProgramRequest.target_plant, literal_column("''"))),
                literal_column("'[^a-z0-9]+'"),
                literal_column("' '"),
                literal_column("'g'"),
            )
            query = query.filter(normalized_plant.in_(plant_labels))
        if before_id is not None:
            query = query.filter(ProgramRequest.id < before_id)
        query = query.order_by(ProgramRequest.id.desc())
        if offset > 0:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    def get_with_materials(self, request_id: int) -> Optional[ProgramRequest]:
        """Fetch program request by ID with materials and activity logs."""
        return (
            self.db.query(ProgramRequest)
            .options(
                selectinload(ProgramRequest.materials),
                selectinload(ProgramRequest.activities),
            )
            .filter(ProgramRequest.id == request_id)
            .first()
        )

    def get_for_update(self, request_id: int) -> Optional[ProgramRequest]:
        """Load a workflow row under a database lock before a state transition."""
        return (
            self.db.query(ProgramRequest)
            .options(
                selectinload(ProgramRequest.materials),
                selectinload(ProgramRequest.activities),
            )
            .filter(ProgramRequest.id == request_id)
            .with_for_update()
            .first()
        )

    def add_activity_log(
        self,
        program_request_id: int,
        actor_name: str,
        actor_department: str,
        action: str,
        payload: Dict[str, Any],
        actor_id: Optional[int] = None,
        commit: bool = True,
    ) -> ProgramActivityLog:
        """Create and persist an activity log for seasonal program planning."""
        log = ProgramActivityLog(
            program_request_id=program_request_id,
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


    def add_material(
        self,
        program_request_id: int,
        material_data: Dict[str, Any],
        *,
        commit: bool = True,
    ) -> ProgramMaterialSpecification:
        """Add a material row to a program request."""
        mat = ProgramMaterialSpecification(
            program_request_id=program_request_id,
            **material_data,
        )
        self.db.add(mat)
        if commit:
            self.db.commit()
            self.db.refresh(mat)
        else:
            self.db.flush()
        return mat

    def delete_material(self, program_request_id: int, material_id: int) -> bool:
        """Delete a material line from a program request."""
        mat = (
            self.db.query(ProgramMaterialSpecification)
            .filter(
                ProgramMaterialSpecification.id == material_id,
                ProgramMaterialSpecification.program_request_id == program_request_id,
            )
            .first()
        )
        if not mat:
            return False
        self.db.delete(mat)
        self.db.commit()
        return True

    def resequence_all(self, yr_suffix: int):
        """Re-sequence contiguous program request codes."""
        items = self.db.query(ProgramRequest).order_by(ProgramRequest.id.asc()).all()
        for item in items:
            item.request_code = f"PG-TMP-{item.id:04d}"
            item.sr_number = f"SR-TMP-{item.id:04d}"
        self.db.flush()

        for idx, item in enumerate(items, start=1):
            item.request_code = f"PG-{idx:04d}"
            item.sr_number = f"SR-{yr_suffix:02d}-PG-{idx:03d}"
        self.db.flush()

        if not items:
            self.db.execute(text("ALTER SEQUENCE program_requests_id_seq RESTART WITH 1"))
        else:
            max_id = max(item.id for item in items)
            self.db.execute(text(f"SELECT setval('program_requests_id_seq', {max_id}, true)"))
        self.db.commit()

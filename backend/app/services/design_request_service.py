"""
Creative Design Request Service.
Encapsulates business operations for Creative Design Requests, artwork variant counts,
and workflow status transitions.
"""
from typing import Any, Callable, Dict, List, Optional
from sqlalchemy.orm import Session
from app.repositories.design_request_repo import DesignRequestRepository
from app.models.sample_request import DesignRequest


class DesignRequestService:
    """Application service for Creative Design Requests."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = DesignRequestRepository(db)

    def list_all(
        self,
        year: Optional[str] = None,
        draft_only: bool = False,
        created_by_user_id: Optional[int] = None,
        status_in: Optional[List[str]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """List design requests for the selected business year and filters."""
        return self.repo.list_all_records(
            year=year,
            draft_only=draft_only,
            created_by_user_id=created_by_user_id,
            status_in=status_in,
            limit=limit,
            offset=offset,
        )

    def get_by_id(self, item_id: int) -> Optional[Dict[str, Any]]:
        """Fetch design request by ID."""
        return self.repo.get_record_by_id(item_id)

    def get_by_sr_number(self, sr_number: Optional[str]) -> Optional[Dict[str, Any]]:
        """Fetch the design workflow linked to one sample request without scanning the full queue."""
        item = self.repo.get_model_by_sr_number(sr_number)
        return self.repo.to_dict(item) if item else None

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new creative design request."""
        return self.repo.create_record(data)

    def update(self, item_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update creative design request fields."""
        return self.repo.update_record(item_id, updates)

    def mutate(self, item_id: int, mutator: Callable[[DesignRequest], None]) -> Optional[Dict[str, Any]]:
        """Apply a workflow transition while holding the design request row lock."""
        return self.repo.mutate_record(item_id, mutator)

    def delete(self, item_id: int) -> bool:
        """Delete creative design request."""
        return self.repo.delete_record(item_id)

    def sync_sample_request(self, sample_req: Dict[str, Any], is_delete: bool = False):
        """Sync design request from sample request creation/deletion."""
        self.repo.sync_sample_request_design(sample_req, is_delete=is_delete)

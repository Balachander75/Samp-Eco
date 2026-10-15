"""Persistent APIs for downstream Creative, Studio, and Costing work queues."""

from typing import Any, Dict, List

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.permissions import filter_plant_records, require_admin, require_team
from app.auth.security import get_current_user
from app.database import get_db
from app.services.downstream_service import DownstreamService

router = APIRouter(tags=["Downstream Operations"])


def get_downstream_service(db: Session = Depends(get_db)) -> DownstreamService:
    return DownstreamService(db)


@router.get("/api/v1/creative/briefs", response_model=List[Dict[str, Any]])
def list_creative_briefs(
    service: DownstreamService = Depends(get_downstream_service),
    current_user=Depends(get_current_user),
):
    return filter_plant_records(current_user, service.list_creative_briefs(), service.db)


@router.patch("/api/v1/creative/briefs/{id}")
def update_creative_brief(
    id: str,
    body: Dict[str, Any] = Body(...),
    service: DownstreamService = Depends(get_downstream_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    updated = service.update_creative_brief(id, body)
    if updated is None:
        raise HTTPException(status_code=404, detail="Creative brief not found")
    return updated


@router.get("/api/v1/studio/dielines", response_model=List[Dict[str, Any]])
def list_studio_dielines(
    service: DownstreamService = Depends(get_downstream_service),
    current_user=Depends(get_current_user),
):
    return filter_plant_records(current_user, service.list_studio_dielines(), service.db)


@router.patch("/api/v1/studio/dielines/{id}")
def update_studio_dieline(
    id: str,
    body: Dict[str, Any] = Body(...),
    service: DownstreamService = Depends(get_downstream_service),
    current_user=Depends(get_current_user),
):
    require_team(current_user, "creative_studio")
    updated = service.update_studio_dieline(id, body)
    if updated is None:
        raise HTTPException(status_code=404, detail="Studio dieline not found")
    return updated


@router.get("/api/v1/costing/estimations", response_model=List[Dict[str, Any]])
def list_costing_estimations(
    service: DownstreamService = Depends(get_downstream_service),
    current_user=Depends(get_current_user),
):
    require_admin(current_user)
    return service.list_costing_estimations()


@router.patch("/api/v1/costing/estimations/{id}")
def update_costing_estimation(
    id: str,
    body: Dict[str, Any] = Body(...),
    service: DownstreamService = Depends(get_downstream_service),
    current_user=Depends(get_current_user),
):
    require_admin(current_user)
    updated = service.update_costing_estimation(id, body)
    if updated is None:
        raise HTTPException(status_code=404, detail="Costing estimation not found")
    return updated

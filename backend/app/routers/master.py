"""Customer, manufacturing plant, and enterprise user master-data endpoints."""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth.permissions import filter_plant_values, require_admin, require_smps_member
from app.auth.security import get_current_user
from app.database import get_db
from app.schemas.master import (
    CustomerCreate,
    CustomerOut,
    PlantOut,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.services.master_service import MasterService

router = APIRouter(tags=["Master Data"])


def get_master_service(db: Session = Depends(get_db)) -> MasterService:
    return MasterService(db)


@router.get("/api/master/health", summary="Master data router health check")
def master_health():
    return {"status": "ok", "customers": "ready", "plants": "ready", "users": "ready"}


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------
@router.get("/api/v1/customers", response_model=List[CustomerOut], summary="List customers", dependencies=[Depends(require_smps_member)])
def list_customers(
    search: Optional[str] = Query(default=None),
    service: MasterService = Depends(get_master_service),
):
    return service.list_customers(search)


@router.post(
    "/api/v1/customers",
    response_model=CustomerOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a customer",
    dependencies=[Depends(require_admin)],
)
def create_customer(
    payload: CustomerCreate,
    service: MasterService = Depends(get_master_service),
):
    return service.create_customer(payload)


# ---------------------------------------------------------------------------
# Manufacturing Plants (Read-Only Master Data)
# ---------------------------------------------------------------------------
@router.get("/api/v1/plants", response_model=List[PlantOut], summary="List plants")
def list_plants(
    service: MasterService = Depends(get_master_service),
    current_user=Depends(get_current_user),
):
    require_smps_member(current_user)
    plants = service.list_plants()
    visible_codes = set(filter_plant_values(current_user, (plant.code for plant in plants), service.repo.db))
    return [plant for plant in plants if plant.code in visible_codes]


# ---------------------------------------------------------------------------
# Users & Team Hierarchy
# ---------------------------------------------------------------------------
@router.get("/api/v1/users", response_model=List[UserOut], summary="List enterprise users", dependencies=[Depends(require_admin)])
def list_users(
    team: Optional[str] = Query(default=None, description="Filter by team department"),
    service: MasterService = Depends(get_master_service),
):
    return service.list_users(team)


@router.post(
    "/api/v1/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user with team and role",
    dependencies=[Depends(require_admin)],
)
def create_user(
    payload: UserCreate,
    service: MasterService = Depends(get_master_service),
):
    return service.create_user(payload)


@router.patch(
    "/api/v1/users/{id}",
    response_model=UserOut,
    summary="Update a user",
    dependencies=[Depends(require_admin)],
)
def update_user(
    id: int,
    payload: UserUpdate,
    service: MasterService = Depends(get_master_service),
):
    return service.update_user(id, payload)


@router.delete(
    "/api/v1/users/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a user",
    dependencies=[Depends(require_admin)],
)
def delete_user(
    id: int,
    service: MasterService = Depends(get_master_service),
):
    service.delete_user(id)
    return None


# ---------------------------------------------------------------------------
# Product Categories Merchandising Taxonomy
# ---------------------------------------------------------------------------
@router.get("/api/v1/master/product-categories", summary="List product categories hierarchy", dependencies=[Depends(require_smps_member)])
@router.get("/api/master/product-categories", summary="List product categories hierarchy (legacy alias)", dependencies=[Depends(require_smps_member)])
def get_product_categories(service: MasterService = Depends(get_master_service)):
    return service.get_product_categories()


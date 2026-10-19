"""Customer, manufacturing plant, and enterprise user master-data endpoints."""
from typing import Optional, List, Any
from sqlalchemy import Integer, case, cast, func
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth.permissions import filter_plant_values, require_admin, require_smps_member
from app.auth.security import get_current_user, get_optional_current_user
from app.database import get_db
from app.models.feasibility import FeasibilityRequest
from app.models.program_request import ProgramRequest
from app.models.sample_request import CreateSampleRequest
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
@router.get("/api/v1/customers", response_model=List[CustomerOut], summary="List customers")
def list_customers(
    search: Optional[str] = Query(default=None, description="Search by customer name"),
    service: MasterService = Depends(get_master_service),
    current_user=Depends(get_optional_current_user),
):
    return service.list_customers(search)


@router.post(
    "/api/v1/customers",
    response_model=CustomerOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a customer",
)
def create_customer(
    payload: CustomerCreate,
    service: MasterService = Depends(get_master_service),
    current_user=Depends(get_optional_current_user),
):
    return service.create_customer(payload)


# ---------------------------------------------------------------------------
# Manufacturing Plants (Used by Header Plant Scope Dropdown)
# ---------------------------------------------------------------------------
@router.get("/api/v1/plants", response_model=List[PlantOut], summary="List plants")
def list_plants(
    service: MasterService = Depends(get_master_service),
    current_user=Depends(get_optional_current_user),
):
    plants = [plant for plant in service.list_plants() if plant.is_active]
    if current_user:
        visible_codes = set(filter_plant_values(current_user, (plant.code for plant in plants), service.repo.db))
        return [plant for plant in plants if plant.code in visible_codes]
    return plants


from app.utils.business_year import get_current_business_year


import time

_BUSINESS_YEARS_CACHE: dict[str, Any] = {"timestamp": 0.0, "data": None}
_BUSINESS_YEARS_TTL_SECONDS = 60.0

# ---------------------------------------------------------------------------
# Business Years (Used by Header Business Year Dropdown)
# ---------------------------------------------------------------------------
@router.get("/api/v1/sample-requests/business-years", summary="Business years summary")
@router.get("/api/v1/business-years", summary="Business years summary alias")
def list_business_years(
    db: Session = Depends(get_db),
    current_user=Depends(get_optional_current_user),
):
    now_ts = time.time()
    if (
        _BUSINESS_YEARS_CACHE["data"] is not None
        and (now_ts - _BUSINESS_YEARS_CACHE["timestamp"]) < _BUSINESS_YEARS_TTL_SECONDS
    ):
        return _BUSINESS_YEARS_CACHE["data"]

    current_by = get_current_business_year()
    year_counts: dict[str, int] = {}

    raised_at = FeasibilityRequest.request_raised_at
    fiscal_start_year = cast(
        func.date_part("year", raised_at)
        - case((func.date_part("month", raised_at) < 10, 1), else_=0),
        Integer,
    )
    feasibility_year_counts = (
        db.query(fiscal_start_year, func.count(FeasibilityRequest.id))
        .filter(raised_at.isnot(None))
        .group_by(fiscal_start_year)
        .all()
    )
    for start_year, count in feasibility_year_counts:
        year = f"{start_year}-{start_year + 1}"
        year_counts[year] = year_counts.get(year, 0) + int(count)

    sample_year_counts = (
        db.query(CreateSampleRequest.year, func.count(CreateSampleRequest.id))
        .filter(CreateSampleRequest.year.isnot(None))
        .group_by(CreateSampleRequest.year)
        .all()
    )
    for raw_year, count in sample_year_counts:
        clean_year = str(raw_year or "").strip()
        if clean_year.isdigit() and len(clean_year) == 4:
            end_year = int(clean_year)
            year = f"{end_year - 1}-{end_year}"
        else:
            parts = clean_year.split("-", 1)
            if len(parts) != 2 or not all(part.isdigit() and len(part) == 4 for part in parts):
                continue
            start_year, end_year = map(int, parts)
            if end_year != start_year + 1:
                continue
            year = f"{start_year}-{end_year}"
        year_counts[year] = year_counts.get(year, 0) + int(count)

    program_year_counts = (
        db.query(ProgramRequest.program_year, func.count(ProgramRequest.id))
        .filter(ProgramRequest.program_year.isnot(None))
        .group_by(ProgramRequest.program_year)
        .all()
    )
    for program_year, count in program_year_counts:
        raw_year = str(program_year or "").strip()
        if raw_year.isdigit() and len(raw_year) == 4:
            # Program Planning stores season years (for example 2027). The
            # header groups those records under their Oct-Sep business year.
            end_year = int(raw_year)
            year = f"{end_year - 1}-{end_year}"
        else:
            parts = raw_year.split("-", 1)
            if len(parts) != 2 or not all(part.isdigit() and len(part) == 4 for part in parts):
                continue
            start_year, end_year = map(int, parts)
            if end_year != start_year + 1:
                continue
            year = f"{start_year}-{end_year}"
        year_counts[year] = year_counts.get(year, 0) + int(count)

    # Keep the current year selectable even when there are no requests in it yet.
    year_counts.setdefault(current_by, 0)

    def year_sort_key(year: str) -> tuple[int, str]:
        try:
            return int(year.split("-", 1)[0]), year
        except ValueError:
            return -1, year

    years = [
        {
            "year": year,
            "label": f"BY {year}",
            "is_current": year == current_by,
            "count": count,
        }
        for year, count in sorted(year_counts.items(), key=lambda item: year_sort_key(item[0]), reverse=True)
    ]
    result = {
        "current_business_year": current_by,
        "total_records": sum(year_counts.values()),
        "years": years,
    }
    _BUSINESS_YEARS_CACHE["timestamp"] = now_ts
    _BUSINESS_YEARS_CACHE["data"] = result
    return result


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
    summary="Create an enterprise user",
)
def create_user(
    payload: UserCreate,
    service: MasterService = Depends(get_master_service),
    current_user=Depends(require_admin),
):
    return service.create_user(payload)


@router.patch(
    "/api/v1/users/{id}",
    response_model=UserOut,
    summary="Update an enterprise user",
)
def update_user(
    id: int,
    payload: UserUpdate,
    service: MasterService = Depends(get_master_service),
    current_user=Depends(require_admin),
):
    return service.update_user(id, payload, actor_user_id=current_user.id)


@router.delete(
    "/api/v1/users/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Permanently delete an enterprise user while preserving request history",
)
def delete_user(
    id: int,
    service: MasterService = Depends(get_master_service),
    current_user=Depends(require_admin),
):
    service.delete_user(id, actor_user_id=current_user.id)
    return None


# ---------------------------------------------------------------------------
# Product Categories Merchandising Taxonomy
# ---------------------------------------------------------------------------
@router.get("/api/v1/master/product-categories", summary="List product categories hierarchy")
@router.get("/api/master/product-categories", summary="List product categories hierarchy (legacy alias)")
def get_product_categories(service: MasterService = Depends(get_master_service)):
    return service.get_product_categories()


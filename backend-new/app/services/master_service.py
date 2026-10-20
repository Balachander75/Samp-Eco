"""
Master Data Service.
Encapsulates business operations for Customer, Plant, and User master data.
"""
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.repositories.master_repo import MasterRepository
from app.models.master import Customer, Plant, User
from app.schemas.master import CustomerCreate, UserCreate, UserUpdate
from app.auth.security import hash_password


class MasterService:
    def __init__(self, db: Session):
        self.repo = MasterRepository(db)

    # ---------------------------------------------------------
    # Customers
    # ---------------------------------------------------------
    def list_customers(self, search: Optional[str] = None) -> List[Customer]:
        return self.repo.list_customers(search)

    def create_customer(self, payload: CustomerCreate) -> Customer:
        return self.repo.create_customer(name=payload.name, country=payload.country)

    # ---------------------------------------------------------
    # Plants
    # ---------------------------------------------------------
    def list_plants(self) -> List[Plant]:
        return self.repo.list_plants()

    # ---------------------------------------------------------
    # Users & Team Hierarchy
    # ---------------------------------------------------------
    def list_users(self, team: Optional[str] = None) -> List[User]:
        return self.repo.list_users(team)

    def create_user(self, payload: UserCreate) -> User:
        if self.repo.get_user_by_userid(payload.userid):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Username '{payload.userid}' is already in use.",
            )
        if self.repo.get_user_by_email(payload.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{payload.email}' is already registered.",
            )
        password_hash = hash_password(payload.password)
        is_active = payload.is_active if payload.is_active is not None else True
        role = self._canonical_account_role(payload.role)
        team = self._canonical_team(payload.team)
        is_costing_admin = bool(payload.is_costing_admin)
        if is_costing_admin and team != "costing":
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Costing administrator access requires the Costing team.")
        is_head = bool(payload.is_team_head) and role != "admin"
        if is_head and not team:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A team head must be assigned to a team.")
        requested_plants = payload.plant_codes or ([payload.plant_code] if payload.plant_code else [])
        plant_codes = self.repo.validate_plant_codes(requested_plants)
        if team == "plant" and not plant_codes:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Plant Operations users must be assigned to an active facility.")

        user = self.repo.create_user(
            name=payload.name,
            userid=payload.userid,
            email=payload.email,
            password_hash=password_hash,
            role=role,
            sub_role=payload.sub_role,
            team=team,
            is_team_head=is_head,
            is_costing_admin=is_costing_admin,
            plant_code=plant_codes[0] if plant_codes else None,
            is_active=is_active,
        )
        return self.repo.replace_user_plant_assignments(user, plant_codes)

    def update_user(self, user_id: int, payload: UserUpdate, actor_user_id: Optional[int] = None) -> User:
        user = self.repo.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        updates: Dict[str, Any] = {}
        next_role = self._canonical_account_role(payload.role if payload.role is not None else user.role)
        next_is_active = payload.is_active if payload.is_active is not None else user.is_active
        next_team = self._canonical_team(payload.team if payload.team is not None else user.team)
        if payload.is_costing_admin is True and next_team != "costing":
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Costing administrator access requires the Costing team.")
        if actor_user_id is not None and actor_user_id == user_id and user.is_active and not next_is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You cannot deactivate your own account.",
            )
        self._ensure_admin_survives(user, next_role, next_is_active)
        next_is_head = (
            bool(payload.is_team_head) if payload.is_team_head is not None else bool(user.is_team_head)
        ) and next_role != "admin"
        if next_is_head:
            if not next_team:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A team head must be assigned to a team.")
        if payload.name is not None:
            updates["name"] = payload.name.strip()
        if payload.userid is not None:
            clean_uid = payload.userid.strip()
            existing_uid = self.repo.get_user_by_userid(clean_uid)
            if existing_uid and existing_uid.id != user_id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already in use.")
            updates["userid"] = clean_uid
        if payload.email is not None:
            clean_email = payload.email.strip().lower()
            existing_email = self.repo.get_user_by_email(clean_email)
            if existing_email and existing_email.id != user_id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")
            updates["email"] = clean_email
        if payload.password is not None and payload.password.strip():
            updates["password_hash"] = hash_password(payload.password.strip())
        if payload.role is not None:
            updates["role"] = next_role
        elif user.role.strip().lower() in {"head", "team head", "department lead"}:
            updates["role"] = "user"
        if payload.sub_role is not None:
            updates["sub_role"] = payload.sub_role
        if payload.team is not None:
            updates["team"] = next_team
        if payload.is_team_head is not None:
            updates["is_team_head"] = next_is_head
        elif next_role == "admin" and user.is_team_head:
            updates["is_team_head"] = False
        if payload.is_costing_admin is not None:
            updates["is_costing_admin"] = bool(payload.is_costing_admin) and next_team == "costing"
        elif payload.team is not None and next_team != "costing" and user.is_costing_admin:
            updates["is_costing_admin"] = False
        plant_codes_to_set = None
        if payload.plant_codes is not None:
            plant_codes_to_set = self.repo.validate_plant_codes(payload.plant_codes)
        elif payload.plant_code is not None:
            plant_codes_to_set = self.repo.validate_plant_codes([payload.plant_code] if payload.plant_code else [])
        elif payload.team is not None and next_team != "plant":
            plant_codes_to_set = []
        if next_team == "plant":
            assigned_codes = plant_codes_to_set if plant_codes_to_set is not None else self.repo.validate_plant_codes([user.plant_code] if user.plant_code else [])
            if not assigned_codes:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Plant Operations users must be assigned to an active facility.")
            plant_codes_to_set = assigned_codes
        if payload.is_active is not None:
            updates["is_active"] = payload.is_active

        updated_user = self.repo.update_user(user, updates)
        if plant_codes_to_set is not None:
            return self.repo.replace_user_plant_assignments(updated_user, plant_codes_to_set)
        return updated_user

    @staticmethod
    def _canonical_account_role(role: str) -> str:
        normalized = (role or "user").strip().lower()
        if normalized in {"head", "team head", "department lead"}:
            return "user"
        if normalized in {"administrator", "admin"}:
            return "admin"
        return "user"

    @staticmethod
    def _canonical_team(team: Optional[str]) -> Optional[str]:
        value = (team or "").strip().lower().replace("_", " ").replace("-", " ")
        aliases = {
            "management": "admin",
            "administration": "admin",
            "sampling": "samp",
            "sampling team": "samp",
            "sampling lab": "samp",
            "plant operations": "plant",
            "structural cad studio": "studio",
            "studio cad": "studio",
            "commercial costing": "costing",
            "creative studio": "creative",
        }
        return aliases.get(value, value or None)

    def delete_user(self, user_id: int, actor_user_id: Optional[int] = None) -> bool:
        user = self.repo.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        if actor_user_id is not None and actor_user_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You cannot delete your own account.",
            )
        self._ensure_admin_survives(user, self._canonical_account_role(user.role), False)
        return self.repo.delete_user(user_id)

    def _ensure_admin_survives(self, user: User, next_role: str, next_is_active: bool) -> None:
        is_currently_active_admin = user.is_active and self._canonical_account_role(user.role) == "admin"
        remains_active_admin = next_is_active and next_role == "admin"
        if is_currently_active_admin and not remains_active_admin and self.repo.count_active_admins(user.id) == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="At least one active administrator account must remain.",
            )

    # ---------------------------------------------------------
    # Product Categories Merchandising Taxonomy
    # ---------------------------------------------------------
    def get_product_categories(self) -> Dict[str, Any]:
        """Return structured product category, sub-category, and third-category taxonomy hierarchy."""
        from app.models.sample_request import CreateSampleRequest
        rows = (
            self.repo.db.query(
                CreateSampleRequest.product_category,
                CreateSampleRequest.product_sub_category,
                CreateSampleRequest.product_third_category,
            )
            .filter(CreateSampleRequest.product_category.isnot(None))
            .distinct()
            .order_by(
                CreateSampleRequest.product_category.asc(),
                CreateSampleRequest.product_sub_category.asc(),
                CreateSampleRequest.product_third_category.asc(),
            )
            .all()
        )

        categories_map: Dict[str, Dict[str, set]] = {}
        for cat, sub, third in rows:
            c = (cat or "").strip()
            if not c:
                continue
            if c not in categories_map:
                categories_map[c] = {}
            s = (sub or "").strip()
            if s:
                if s not in categories_map[c]:
                    categories_map[c][s] = set()
                t = (third or "").strip()
                if t:
                    categories_map[c][s].add(t)

        result_categories = []
        for cat_name, sub_dict in categories_map.items():
            subs = []
            for sub_name, thirds_set in sub_dict.items():
                subs.append({
                    "name": sub_name,
                    "third_categories": sorted(list(thirds_set)),
                })
            result_categories.append({
                "name": cat_name,
                "subcategories": sorted(subs, key=lambda x: x["name"]),
            })

        return {
            "categories": sorted(result_categories, key=lambda x: x["name"]),
            "flat_categories": sorted(list(categories_map.keys())),
        }


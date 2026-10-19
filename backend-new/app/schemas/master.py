from datetime import datetime
import re
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Optional

class CustomerBase(BaseModel):
    name: str
    country: Optional[str] = "India"

class CustomerCreate(CustomerBase):
    pass

class CustomerOut(CustomerBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PlantBase(BaseModel):
    code: str
    name: str
    location: Optional[str] = None
    is_active: Optional[bool] = True
    created_by: Optional[str] = None

class PlantOut(PlantBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    userid: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1)
    role: str = "user"
    sub_role: Optional[str] = None
    team: Optional[str] = None
    is_team_head: Optional[bool] = False
    is_costing_admin: Optional[bool] = False
    plant_code: Optional[str] = None
    plant_codes: List[str] = Field(default_factory=list)
    is_active: Optional[bool] = True

    @field_validator("name", "userid")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Enter a valid email address.")
        return value


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    userid: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[str] = Field(default=None, min_length=3, max_length=255)
    password: Optional[str] = None
    role: Optional[str] = None
    sub_role: Optional[str] = None
    team: Optional[str] = None
    is_team_head: Optional[bool] = None
    is_costing_admin: Optional[bool] = None
    plant_code: Optional[str] = None
    plant_codes: Optional[List[str]] = None
    is_active: Optional[bool] = None

    @field_validator("name", "userid")
    @classmethod
    def strip_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("email")
    @classmethod
    def validate_optional_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Enter a valid email address.")
        return value


class UserOut(BaseModel):
    id: int
    name: str
    userid: str
    email: str
    role: str
    sub_role: Optional[str] = None
    team: Optional[str] = None
    is_team_head: bool = False
    is_costing_admin: bool = False
    plant_code: Optional[str] = None
    plant_codes: List[str] = Field(default_factory=list)
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
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
    name: str
    userid: str
    email: str
    password: str
    role: str = "user"
    sub_role: Optional[str] = None
    team: Optional[str] = None
    is_team_head: Optional[bool] = False
    plant_code: Optional[str] = None
    plant_codes: List[str] = Field(default_factory=list)
    is_active: Optional[bool] = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    userid: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    sub_role: Optional[str] = None
    team: Optional[str] = None
    is_team_head: Optional[bool] = None
    plant_code: Optional[str] = None
    plant_codes: Optional[List[str]] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    name: str
    userid: str
    email: str
    role: str
    sub_role: Optional[str] = None
    team: Optional[str] = None
    is_team_head: bool = False
    plant_code: Optional[str] = None
    plant_codes: List[str] = Field(default_factory=list)
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


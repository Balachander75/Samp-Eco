"""Pydantic schemas for Seasonal Program Planning and Material Specification Matrix."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class ProgramMaterialBase(BaseModel):
    material_type: Optional[str] = None
    supplier_name: Optional[str] = None
    grade: Optional[str] = None
    color_variant: Optional[str] = None
    caliper_wt: Optional[str] = None
    quantity: Optional[str] = None
    unit: Optional[str] = None
    remark: Optional[str] = None
    samp_remark: Optional[str] = None
    plant_remark: Optional[str] = None
    promoted_sample_request_id: Optional[int] = None
    promoted_sr_number: Optional[str] = None


class ProgramMaterialCreate(ProgramMaterialBase):
    pass


class ProgramMaterialOut(ProgramMaterialBase):
    id: int
    program_request_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


from app.utils.business_year import get_current_business_year


class ProgramRequestCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, description="Customer account name")
    target_plant: str = Field(default="Plant 1", description="Target manufacturing plant")
    program_campaign_title: str = Field(..., min_length=1, description="Program campaign title")
    program_year: str = Field(default_factory=get_current_business_year, description="Fiscal / program year")
    created_by: Optional[str] = None
    materials: Optional[List[ProgramMaterialCreate]] = Field(
        default_factory=list,
        description="Material Specification Matrix rows (all fields optional)",
    )


class ProgramRequestUpdate(BaseModel):
    customer_name: Optional[str] = None
    target_plant: Optional[str] = None
    program_campaign_title: Optional[str] = None
    program_year: Optional[str] = None
    status: Optional[str] = None
    sampling_verdict: Optional[str] = None
    sampling_remark: Optional[str] = None
    plant_verdict: Optional[str] = None
    plant_remark: Optional[str] = None


class ProgramOutputSubmit(BaseModel):
    department: Literal["sampling", "plant"]
    remark: str = Field(min_length=1, max_length=4000)
    verdict: Optional[str] = None


class ProgramClaimSubmit(BaseModel):
    department: Literal["sampling", "plant"]


class ProgramSeenSubmit(BaseModel):
    department: str = Field(..., description="'sampling' or 'plant'")
    actor_name: Optional[str] = None


class ProgramActivityPinSubmit(BaseModel):
    pinned: bool


class ProgramActivityReplySubmit(BaseModel):
    remark: str = Field(min_length=1, max_length=2000)


class ProgramMaterialRemarkUpdate(BaseModel):
    material_id: int
    samp_remark: Optional[str] = None


class ProgramBatchSampRemarksUpdate(BaseModel):
    remarks: List[ProgramMaterialRemarkUpdate]


class SingleSampRemarkUpdate(BaseModel):
    samp_remark: Optional[str] = None


class ProgramMaterialPlantRemarkUpdate(BaseModel):
    material_id: int
    plant_remark: Optional[str] = None


class ProgramBatchPlantRemarksUpdate(BaseModel):
    remarks: List[ProgramMaterialPlantRemarkUpdate]


class SinglePlantRemarkUpdate(BaseModel):
    plant_remark: Optional[str] = None


class ProgramPauseSubmit(BaseModel):
    """Payload to pause or resume a seasonal program plan."""

    paused: bool = True


class ProgramDismantleSubmit(BaseModel):
    """Payload to permanently dismantle a seasonal program plan."""

    reason: Optional[str] = Field(default=None, max_length=1000)


class ProgramPromoteSkuPayload(BaseModel):
    """Payload to promote a matrix SKU into a commercial Sample Request."""

    request_types: Optional[List[str]] = Field(
        default_factory=lambda: ["sample"],
        description="Deliverable scopes for the converted request (sample, costing)",
    )


class ProgramNoteCreate(BaseModel):
    """Payload for adding a note/comment to the program planning audit chatter."""

    note: str = Field(min_length=1, max_length=2000)
    material_id: Optional[int] = None


class ProgramActivityLogOut(BaseModel):
    id: int
    program_request_id: int
    actor_id: Optional[int] = None
    actor_name: str
    actor_department: str
    action: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    pinned_by_marketing: bool = False
    pinned_by: Optional[str] = None
    pinned_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProgramRequestOut(BaseModel):
    id: int
    request_code: str
    sr_number: Optional[str] = None
    customer_name: str
    target_plant: str
    program_campaign_title: str
    program_year: str
    status: str
    is_active: bool = True
    created_by: Optional[str] = None

    # Sampling Review & Seen
    sampling_seen_at: Optional[datetime] = None
    sampling_seen_by: Optional[str] = None
    sampling_verdict: Optional[str] = None
    sampling_remark: Optional[str] = None
    sampling_signed_at: Optional[datetime] = None
    sampling_signed_by: Optional[str] = None
    sampling_claimed_by_user_id: Optional[int] = None
    sampling_claimed_by: Optional[str] = None

    # Plant Review & Seen
    plant_seen_at: Optional[datetime] = None
    plant_seen_by: Optional[str] = None
    plant_verdict: Optional[str] = None
    plant_remark: Optional[str] = None
    plant_signed_at: Optional[datetime] = None
    plant_signed_by: Optional[str] = None
    plant_claimed_by_user_id: Optional[int] = None
    plant_claimed_by: Optional[str] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    materials: List[ProgramMaterialOut] = []
    activities: List[ProgramActivityLogOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)



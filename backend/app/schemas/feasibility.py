"""Pydantic schemas for feasibility-check requests, lab verdicts, marketing decisions, and activity logs."""

from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


FIXED_FEASIBILITY_TYPES = {
    "new_category",
    "new_format",
    "new_finish",
    "new_accessories",
}


class FeasibilityRequestCreate(BaseModel):
    customer: str = Field(min_length=1, max_length=255)
    feasibility_type: str = Field(min_length=1, max_length=64)
    custom_feasibility_type: Optional[str] = Field(default=None, max_length=25)
    description_notes: str = Field(min_length=1, max_length=75)
    required_date: date
    marketing_remarks: Optional[str] = Field(default=None, max_length=100)
    created_by: Optional[str] = None
    reference_images: list[str] = Field(default_factory=list, max_length=2)
    reference_image_names: list[str] = Field(default_factory=list, max_length=2)
    reference_links: list[str] = Field(default_factory=list, max_length=1)

    @model_validator(mode="after")
    def validate_type(self):
        if self.feasibility_type not in FIXED_FEASIBILITY_TYPES and self.feasibility_type != "other":
            raise ValueError("Invalid feasibility type")
        if self.feasibility_type == "other" and not (self.custom_feasibility_type or "").strip():
            raise ValueError("Custom feasibility type is required for other")
        if len(self.reference_images) + len(self.reference_links) > 3:
            raise ValueError("A maximum of 2 images and 1 link can be attached")
        if self.reference_image_names and len(self.reference_image_names) != len(self.reference_images):
            raise ValueError("Each reference image must include one matching filename")
        if any(len(image) > 20_000_000 for image in self.reference_images):
            raise ValueError("Reference image upload exceeds the 15 MB limit")
        return self


class FeasibilitySampVerdictPayload(BaseModel):
    """Payload for SAMP Team technical sign-off."""

    response: Literal["Yes", "No", "Maybe"]
    remark: Optional[str] = None
    conditions: Optional[str] = None
    lead_time_note: Optional[str] = None


class FeasibilityMarketingDecisionPayload(BaseModel):
    """Payload for Marketing final decision."""

    decision: Literal["Accepted", "Rejected"]
    decision_remark: Optional[str] = None


class FeasibilityCounterDateProposalPayload(BaseModel):
    proposed_date: date
    reason: str = Field(min_length=1, max_length=2000)


class FeasibilityCounterDateDecisionPayload(BaseModel):
    decision: Literal["accepted", "rejected"]
    decision_remark: Optional[str] = Field(default=None, max_length=2000)


class FeasibilityNoteCreate(BaseModel):
    """Payload for adding a note/comment to the feasibility audit chatter."""

    note: str = Field(min_length=1, max_length=2000)


class FeasibilityActivityLogOut(BaseModel):
    id: int
    feasibility_request_id: Optional[int] = None
    request_code: Optional[str] = None
    actor_id: Optional[int] = None
    actor_name: str
    actor_department: str
    action: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FeasibilityRequestOut(BaseModel):
    id: int
    request_code: str
    customer: str
    target_plant: Optional[str] = None
    feasibility_type: str
    custom_feasibility_type: Optional[str] = None
    description_notes: str
    required_date: date
    marketing_remarks: Optional[str] = None
    reference_images: list[str] = Field(default_factory=list)
    reference_image_names: list[str] = Field(default_factory=list)
    reference_links: list[str] = Field(default_factory=list)
    status: str
    created_by: Optional[str] = None
    request_created_by: Optional[str] = None
    created_by_user_id: Optional[int] = None
    request_raised_at: datetime
    updated_at: Optional[datetime] = None

    # SAMP Team response fields
    taken_by_samp: Optional[str] = None
    taken_by_samp_user_id: Optional[int] = None
    taken_at_samp: Optional[datetime] = None
    sampling_feasibility_response: Optional[str] = None
    sampling_feasibility_remark: Optional[str] = None
    feasibility_conditions: Optional[str] = None
    lead_time_note: Optional[str] = None
    sampling_feasibility_approved_by: Optional[str] = None
    feasibility_closed_at: Optional[datetime] = None
    feasibility_closed_by: Optional[str] = None
    is_responded_on_time: Optional[bool] = None

    samp_counter_date: Optional[date] = None
    samp_counter_date_reason: Optional[str] = None
    samp_counter_date_proposed_at: Optional[datetime] = None
    samp_counter_date_proposed_by: Optional[str] = None
    counter_date_decision: Optional[str] = None
    counter_date_decision_at: Optional[datetime] = None
    counter_date_decision_by: Optional[str] = None
    counter_date_decision_remark: Optional[str] = None
    counter_date_decision_due_at: Optional[datetime] = None
    counter_date_wait_workdays: Optional[int] = None
    samp_sla_paused_workdays: int = 0

    # Marketing final decision fields
    marketing_decision: Optional[str] = None
    marketing_decision_by: Optional[str] = None
    marketing_decision_at: Optional[datetime] = None
    marketing_decision_remark: Optional[str] = None

    # Sampling request conversion fields
    converted_sample_request_id: Optional[int] = None
    converted_sr_number: Optional[str] = None
    converted_request_types: List[str] = Field(default_factory=list)
    converted_at: Optional[datetime] = None
    converted_by: Optional[str] = None

    activities: List[FeasibilityActivityLogOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

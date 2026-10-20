"""Database models for Seasonal Program Planning and Material Specification Matrix."""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class ProgramRequest(Base):
    """
    Seasonal Program Planning Request raised by Marketing for SAMP execution.
    Contains customer name, target plant, program campaign title, and program year.
    Does NOT contain target required date per operational specifications.
    """

    __tablename__ = "program_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_code = Column(String(32), nullable=False, unique=True, index=True)
    sr_number = Column(String(32), nullable=True, unique=True, index=True)

    customer_name = Column(String(255), nullable=False, index=True)
    target_plant = Column(String(255), nullable=False)
    program_campaign_title = Column(String(255), nullable=False)
    program_year = Column(String(50), nullable=False, default="2026-2027", server_default="2026-2027", index=True)

    status = Column(String(64), nullable=False, default="Pending SAMP Review", server_default="Pending SAMP Review")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_by = Column(String(255), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Sampling Team Review & Seen status
    sampling_seen_at = Column(DateTime(timezone=True), nullable=True)
    sampling_seen_by = Column(String(255), nullable=True)
    sampling_verdict = Column(String(64), nullable=True)  # "Feasible", "Revisions Required", "Not Feasible", "Pending"
    sampling_remark = Column(Text, nullable=True)
    sampling_signed_at = Column(DateTime(timezone=True), nullable=True)
    sampling_signed_by = Column(String(255), nullable=True)
    sampling_claimed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    sampling_claimed_by = Column(String(255), nullable=True)

    # Plant Team Review & Seen status
    plant_seen_at = Column(DateTime(timezone=True), nullable=True)
    plant_seen_by = Column(String(255), nullable=True)
    plant_verdict = Column(String(64), nullable=True)  # "Capacity Confirmed", "Tooling Constrained", "Not Feasible", "Pending"
    plant_remark = Column(Text, nullable=True)
    plant_signed_at = Column(DateTime(timezone=True), nullable=True)
    plant_signed_by = Column(String(255), nullable=True)
    plant_claimed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    plant_claimed_by = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Material Specification Matrix rows
    materials = relationship(
        "ProgramMaterialSpecification",
        back_populates="program_request",
        cascade="all, delete-orphan",
        order_by="ProgramMaterialSpecification.id",
    )

    # Activity Audit Logs
    activities = relationship(
        "ProgramActivityLog",
        back_populates="program_request",
        cascade="all, delete-orphan",
        order_by="ProgramActivityLog.id.asc()",
    )


class ProgramMaterialSpecification(Base):
    """
    Individual row in the Material Specification Matrix for a Program Planning request.
    All fields are optional, allowing operators to enter any subset of fields.
    Includes `samp_remark` for SAMP team to add/update remarks in view mode.
    """

    __tablename__ = "program_material_specifications"

    id = Column(Integer, primary_key=True, index=True)
    program_request_id = Column(
        Integer,
        ForeignKey("program_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    material_type = Column(String(255), nullable=True)
    supplier_name = Column(String(255), nullable=True)
    grade = Column(String(255), nullable=True)
    color_variant = Column(String(255), nullable=True)
    caliper_wt = Column(String(255), nullable=True)
    quantity = Column(String(100), nullable=True)
    unit = Column(String(50), nullable=True, default="pcs", server_default="pcs")
    remark = Column(Text, nullable=True)

    # SAMP team evaluation remark (populated during view mode review)
    samp_remark = Column(Text, nullable=True)

    # Plant team evaluation / capacity remark (populated during view mode review)
    plant_remark = Column(Text, nullable=True)

    # Link to commercial Sample Request if promoted
    promoted_sample_request_id = Column(Integer, ForeignKey("create_sample_requests.id", ondelete="SET NULL"), nullable=True, index=True)
    promoted_sr_number = Column(String(50), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    program_request = relationship("ProgramRequest", back_populates="materials")
class ProgramActivityLog(Base):
    """Activity and chatter audit log entry for seasonal program requests."""

    __tablename__ = "program_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    program_request_id = Column(
        Integer,
        ForeignKey("program_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_name = Column(String(255), nullable=False)
    actor_department = Column(String(100), nullable=False)  # "Marketing", "SAMP Team", "System"
    action = Column(String(64), nullable=False)  # "CREATED", "NOTE_POSTED", "STATUS_UPDATED", "MATERIAL_ADDED", "MATERIAL_DELETED", "SAMP_REMARK_UPDATED"
    payload = Column(JSON, nullable=False, default=dict, server_default="{}")
    pinned_by_marketing = Column(Boolean, nullable=False, default=False, server_default="false")
    pinned_by = Column(String(255), nullable=True)
    pinned_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    program_request = relationship("ProgramRequest", back_populates="activities")

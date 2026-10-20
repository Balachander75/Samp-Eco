"""Database models for marketing feasibility-check requests, activity logs, and reference images."""
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, JSON, LargeBinary, String, Text, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class FeasibilityRequest(Base):
    """A feasibility request raised by Marketing for SAMP review."""

    __tablename__ = "feasibility_requests"
    __table_args__ = (
        Index(
            "uq_feasibility_requests_converted_sample_request_id",
            "converted_sample_request_id",
            unique=True,
            postgresql_where=text("converted_sample_request_id IS NOT NULL"),
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    request_code = Column(String(32), nullable=False, unique=True, index=True)

    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    target_plant = Column(String(100), nullable=True, index=True)

    feasibility_type = Column(String(64), nullable=False)
    custom_feasibility_type = Column(String(25), nullable=True)
    description_notes = Column(String(75), nullable=False)
    required_date = Column(Date, nullable=False)
    marketing_remarks = Column(String(100), nullable=True)

    reference_links = Column(JSON, nullable=False, default=list, server_default="[]")

    status = Column(String(64), nullable=False, default="Pending Feasibility", server_default="Pending Feasibility", index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_by = Column(String(255), nullable=True)
    request_raised_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Sampling Team response fields
    taken_by_samp = Column(String(255), nullable=True)
    taken_by_samp_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    taken_at_samp = Column(DateTime(timezone=True), nullable=True)
    sampling_feasibility_response = Column(String(32), nullable=True)  # Yes | No | Maybe
    sampling_feasibility_remark = Column(Text, nullable=True)
    feasibility_conditions = Column(Text, nullable=True)
    lead_time_note = Column(Text, nullable=True)
    sampling_feasibility_approved_by = Column(String(255), nullable=True)
    feasibility_closed_at = Column(DateTime(timezone=True), nullable=True)
    feasibility_closed_by = Column(String(32), nullable=True)
    is_responded_on_time = Column(Boolean, nullable=True)

    # SAMP counter-date proposal and Marketing decision audit fields.
    samp_counter_date = Column(Date, nullable=True)
    samp_counter_date_reason = Column(Text, nullable=True)
    samp_counter_date_proposed_at = Column(DateTime(timezone=True), nullable=True)
    samp_counter_date_proposed_by = Column(String(255), nullable=True)
    samp_counter_date_proposed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    counter_date_decision = Column(String(32), nullable=True)  # pending | accepted | rejected | auto_accepted
    counter_date_decision_at = Column(DateTime(timezone=True), nullable=True)
    counter_date_decision_by = Column(String(255), nullable=True)
    counter_date_decision_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    counter_date_decision_remark = Column(Text, nullable=True)
    counter_date_decision_due_at = Column(DateTime(timezone=True), nullable=True)
    counter_date_wait_workdays = Column(Integer, nullable=True)
    samp_sla_paused_workdays = Column(Integer, nullable=False, default=0, server_default="0")

    # Marketing final decision fields
    marketing_decision = Column(String(32), nullable=True)  # "Accepted" | "Rejected"
    marketing_decision_by = Column(String(255), nullable=True)
    marketing_decision_at = Column(DateTime(timezone=True), nullable=True)
    marketing_decision_remark = Column(Text, nullable=True)

    # Sampling request conversion fields
    converted_sample_request_id = Column(Integer, nullable=True, index=True)
    converted_sr_number = Column(String(50), nullable=True)
    converted_at = Column(DateTime(timezone=True), nullable=True)
    converted_by = Column(String(255), nullable=True)

    customer = relationship("Customer")
    activities = relationship(
        "FeasibilityActivityLog",
        back_populates="feasibility_request",
        passive_deletes=True,
        order_by="FeasibilityActivityLog.id.asc()",
    )
    reference_image_records = relationship(
        "FeasibilityReferenceImage",
        back_populates="feasibility_request",
        cascade="all, delete-orphan",
        order_by="FeasibilityReferenceImage.sort_order.asc()",
    )


class FeasibilityActivityLog(Base):
    """Immutable audit trail for feasibility request events and communications."""

    __tablename__ = "feasibility_activity_logs"
    __table_args__ = (
        Index("ix_feasibility_activity_request_code_created", "request_code", "created_at", "id"),
    )

    id = Column(Integer, primary_key=True)
    feasibility_request_id = Column(
        Integer,
        ForeignKey("feasibility_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    request_code = Column(String(32), nullable=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name = Column(String(255), nullable=False)
    actor_department = Column(String(100), nullable=False)  # "Marketing", "SAMP Team", "System"
    action = Column(String(64), nullable=False)  # "CREATED", "VIEWED", "SAMP_EVALUATED", "MARKETING_DECIDED", "NOTE_ADDED"
    payload = Column(JSON, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    feasibility_request = relationship("FeasibilityRequest", back_populates="activities")


class FeasibilityReferenceImage(Base):
    """Compressed reference image bytes stored in the database."""

    __tablename__ = "feasibility_reference_images"

    id = Column(Integer, primary_key=True, index=True)
    feasibility_request_id = Column(
        Integer,
        ForeignKey("feasibility_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    original_name = Column(String(255), nullable=False, default="Reference image")
    content_type = Column(String(64), nullable=False)
    image_data = Column(LargeBinary, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    feasibility_request = relationship(
        "FeasibilityRequest",
        back_populates="reference_image_records",
    )

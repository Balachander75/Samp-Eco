"""
SQLAlchemy database models for Marketing Sample Requests, Product Characteristics, and Product Details.
Tables copied from samp_eco_db into navneet_samp with full schema fidelity and data.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class CreateSampleRequest(Base):
    """
    Core marketing sample request entity (table: create_sample_requests).
    Contains sample request metadata, scheduling dates, deliverable scopes, and workflow status.
    """

    __tablename__ = "create_sample_requests"
    __table_args__ = (
        Index(
            "ix_create_sample_requests_request_types_gin",
            "request_types",
            postgresql_using="gin",
            postgresql_ops={"request_types": "jsonb_path_ops"},
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    sr_number = Column(String(50), nullable=False, unique=True, index=True)
    # Stable client key used to make Marketing draft autosaves safe to retry.
    client_draft_key = Column(String(160), nullable=True, unique=True, index=True)
    year = Column(String(50), nullable=False, index=True)
    product_description = Column(Text, nullable=False)
    customer = Column(String(150), nullable=False, index=True)
    target_plant = Column(String(100), nullable=True, index=True)
    date_request_created = Column(String(50), nullable=False)
    created_by = Column(String(100), nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    material_code = Column(String(100), nullable=False, index=True)
    status = Column(String(50), nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now(), onupdate=lambda: datetime.now(timezone.utc))

    program_year = Column(String(50), nullable=True, index=True)
    program_name = Column(String(150), nullable=True)
    source_sample_code = Column(String(100), nullable=True, index=True)
    creation_mode = Column(String(30), nullable=False, default="material_code", server_default="material_code")
    barcode = Column(String(100), nullable=True)
    sample_required_date = Column(Date, nullable=True)
    product_type = Column(String(100), nullable=True)
    customer_product_code = Column(String(100), nullable=True)
    brand_name = Column(String(150), nullable=True)
    product_type_navneet = Column(String(150), nullable=True)
    product_type_new_customer = Column(String(150), nullable=True)
    unit_pc_pack = Column(String(50), nullable=True)
    qty_per_pack = Column(String(50), nullable=True)
    qty_for_sampling = Column(String(50), nullable=True)
    qty_design_costing = Column(String(50), nullable=True)
    costing_required_date = Column(String(50), nullable=True)
    costing_counter_date = Column(String(50), nullable=True)
    costing_output_path = Column(Text, nullable=True)
    mockup_required = Column(String(50), nullable=True)
    designs_customer_creative = Column(String(100), nullable=True)
    product_artwork_nos = Column(String(100), nullable=True)
    product_image_path = Column(Text, nullable=True)
    reference_images = Column(JSONB, nullable=False, default=list, server_default="[]")
    reference_links = Column(JSONB, nullable=False, default=list, server_default="[]")
    target_artwork_date_creative = Column(String(50), nullable=True)
    target_artwork_date_studio = Column(String(50), nullable=True)
    request_types = Column(JSONB, nullable=False, default=list, server_default="[]")
    mockup_workflow_state = Column(JSONB, nullable=False, default=dict, server_default="{}")

    # Product Merchandising Category & Hierarchy (Commercial taxonomy, distinct from technical SAP specs)
    product_category = Column(String(150), nullable=True, index=True)
    product_sub_category = Column(String(150), nullable=True, index=True)
    product_third_category = Column(String(150), nullable=True)

    # Relationship to product characteristics details
    product_details = relationship(
        "ProductDetail",
        back_populates="sample_request",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ProductDetail.id",
    )
    activity_logs = relationship(
        "SampleRequestActivityLog",
        back_populates="sample_request",
        passive_deletes=True,
        order_by="SampleRequestActivityLog.id",
    )

    # Relationship to normalized request types & selection timestamps audit
    request_type_audit = relationship(
        "SampleRequestType",
        back_populates="sample_request",
        uselist=False,
        cascade="all, delete-orphan",
    )


class ProductCharacteristic(Base):
    """
    Master catalog of product characteristic definitions (classes, names, sequences, UOMs, and options).
    """

    __tablename__ = "product_characteristics"

    id = Column(Integer, primary_key=True, index=True)
    class_name = Column(String(100), nullable=False, index=True)
    characteristic_name = Column(String(150), nullable=False, index=True)
    sequence = Column(Integer, nullable=False)
    uom = Column(String(50), nullable=True)
    options = Column(JSONB, nullable=False, default=list, server_default="[]")
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ProductDetail(Base):
    """
    EAV (Entity-Attribute-Value) detail row specifying a product characteristic value for a sample request.
    """

    __tablename__ = "product_details"

    id = Column(Integer, primary_key=True, index=True)
    sample_request_id = Column(
        Integer,
        ForeignKey("create_sample_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    class_name = Column(String(100), nullable=False, index=True)
    characteristic_name = Column(String(150), nullable=False, index=True)
    value = Column(Text, nullable=True)
    uom = Column(String(50), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now(), onupdate=lambda: datetime.now(timezone.utc))

    sample_request = relationship("CreateSampleRequest", back_populates="product_details")


class DesignRequest(Base):
    """
    Creative Design Request entity (table: design_requests).
    Manages creative brief, trend, audience, artwork variants, reference moodboards, and design schedules.
    """

    __tablename__ = "design_requests"
    __table_args__ = (
        Index("ix_design_requests_program_year_status", "program_year", "status"),
        Index("ix_design_requests_status_created_at", "status", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    request_code = Column(String(50), nullable=False, unique=True, index=True)
    sr_number = Column(String(50), nullable=True, index=True)
    customer_name = Column(String(150), nullable=False, index=True)
    program_name = Column(String(150), nullable=True)
    program_year = Column(String(50), nullable=True, index=True)
    status = Column(String(50), nullable=False, default="Draft (Pre-SMT)", index=True)
    number_of_designs = Column(Integer, nullable=False, default=1)
    trend = Column(String(200), nullable=True)
    target_audience = Column(String(200), nullable=True)
    reference_image = Column(Text, nullable=True)
    product_description = Column(Text, nullable=False, default="")
    design_required_date = Column(String(50), nullable=True)
    created_by = Column(String(100), nullable=False, default="")
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    design_remarks = Column(Text, nullable=True)
    reference_images = Column(JSONB, nullable=False, default=list, server_default="[]")
    reference_links = Column(JSONB, nullable=False, default=list, server_default="[]")
    creative_submissions = Column(JSONB, nullable=False, default=list, server_default="[]")
    marketing_decision = Column(String(40), nullable=True)
    remaining_design_count = Column(Integer, nullable=False, default=0, server_default="0")
    workflow_state = Column(JSONB, nullable=False, default=dict, server_default="{}")

    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now(), onupdate=lambda: datetime.now(timezone.utc))


class SampleRequestType(Base):
    """
    Normalized scope selection flags and audit timestamps per sample request.
    Table: sample_request_types
    """

    __tablename__ = "sample_request_types"

    id = Column(Integer, primary_key=True, index=True)
    sample_request_id = Column(
        Integer,
        ForeignKey("create_sample_requests.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    design = Column(Boolean, nullable=False, default=False, server_default="false")
    mockup = Column(Boolean, nullable=False, default=False, server_default="false")
    sample = Column(Boolean, nullable=False, default=False, server_default="false")
    costing = Column(Boolean, nullable=False, default=False, server_default="false")

    design_selected_at = Column(DateTime(timezone=True), nullable=True)
    mockup_selected_at = Column(DateTime(timezone=True), nullable=True)
    sample_selected_at = Column(DateTime(timezone=True), nullable=True)
    costing_selected_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now(), onupdate=lambda: datetime.now(timezone.utc))

    sample_request = relationship("CreateSampleRequest", back_populates="request_type_audit")


class SampleRequestActivityLog(Base):
    """Durable, queryable history for request creation and workflow changes."""

    __tablename__ = "sample_request_activity_logs"
    __table_args__ = (
        Index("ix_sample_request_activity_request_created", "sample_request_id", "created_at"),
        Index("ix_sample_request_activity_action_created", "action", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    sample_request_id = Column(
        Integer,
        ForeignKey("create_sample_requests.id", ondelete="SET NULL"),
        nullable=True,
    )
    request_sr_number = Column(String(50), nullable=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_name = Column(String(255), nullable=False)
    actor_department = Column(String(100), nullable=True)
    action = Column(String(64), nullable=False)
    from_status = Column(String(64), nullable=True)
    to_status = Column(String(64), nullable=True)
    payload = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    sample_request = relationship("CreateSampleRequest", back_populates="activity_logs")

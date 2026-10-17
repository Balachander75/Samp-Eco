"""Dedicated operational records and immutable activity history for costing and mockups."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.database import Base


class MockupWorkflow(Base):
    __tablename__ = "mockup_workflows"
    __table_args__ = (
        Index("ix_mockup_workflows_stage_updated", "current_stage", "updated_at"),
        Index("ix_mockup_workflows_status_updated", "status", "updated_at"),
    )

    id = Column(Integer, primary_key=True)
    sample_request_id = Column(Integer, ForeignKey("create_sample_requests.id", ondelete="CASCADE"), nullable=False, unique=True)
    request_code = Column(String(50), nullable=True, unique=True, index=True)
    sr_number = Column(String(50), nullable=True, index=True)
    status = Column(String(64), nullable=False, default="In Progress", server_default="In Progress")
    current_stage = Column(String(32), nullable=False, default="creative", server_default="creative")
    workflow_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    reviewer_status = Column(String(32), nullable=False, default="not_started", server_default="not_started")
    reviewer_notes = Column(Text, nullable=True)
    reviewer_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewer_name = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    marketing_decision = Column(String(32), nullable=True)
    marketing_decided_at = Column(DateTime(timezone=True), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now(), onupdate=func.now())


class MockupWorkflowLog(Base):
    __tablename__ = "mockup_workflow_logs"
    __table_args__ = (
        Index("ix_mockup_workflow_logs_workflow_created", "workflow_id", "created_at"),
        Index("ix_mockup_workflow_logs_request_created", "sample_request_id", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    workflow_id = Column(Integer, ForeignKey("mockup_workflows.id", ondelete="CASCADE"), nullable=False)
    sample_request_id = Column(Integer, ForeignKey("create_sample_requests.id", ondelete="SET NULL"), nullable=True)
    sr_number = Column(String(50), nullable=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name = Column(String(255), nullable=False)
    actor_team = Column(String(64), nullable=False)
    action = Column(String(64), nullable=False)
    from_stage = Column(String(32), nullable=True)
    to_stage = Column(String(32), nullable=True)
    from_status = Column(String(64), nullable=True)
    to_status = Column(String(64), nullable=True)
    details = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CostingWorkflow(Base):
    __tablename__ = "costing_workflows"
    __table_args__ = (
        Index("ix_costing_workflows_stage_updated", "current_stage", "updated_at"),
        Index("ix_costing_workflows_status_updated", "status", "updated_at"),
    )

    id = Column(Integer, primary_key=True)
    sample_request_id = Column(Integer, ForeignKey("create_sample_requests.id", ondelete="CASCADE"), nullable=False, unique=True)
    request_code = Column(String(50), nullable=True, unique=True, index=True)
    sr_number = Column(String(50), nullable=True, index=True)
    status = Column(String(64), nullable=False, default="In Progress", server_default="In Progress")
    current_stage = Column(String(32), nullable=False, default="creative", server_default="creative")
    request_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    creative_due_at = Column(DateTime(timezone=True), nullable=True)
    costing_output_path = Column(Text, nullable=True)
    costing_notes = Column(Text, nullable=True)
    reviewer_status = Column(String(32), nullable=False, default="not_started", server_default="not_started")
    reviewer_notes = Column(Text, nullable=True)
    reviewer_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewer_name = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now(), onupdate=func.now())


class CostingWorkflowLog(Base):
    __tablename__ = "costing_workflow_logs"
    __table_args__ = (
        Index("ix_costing_workflow_logs_workflow_created", "workflow_id", "created_at"),
        Index("ix_costing_workflow_logs_request_created", "sample_request_id", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    workflow_id = Column(Integer, ForeignKey("costing_workflows.id", ondelete="CASCADE"), nullable=False)
    sample_request_id = Column(Integer, ForeignKey("create_sample_requests.id", ondelete="SET NULL"), nullable=True)
    sr_number = Column(String(50), nullable=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name = Column(String(255), nullable=False)
    actor_team = Column(String(64), nullable=False)
    action = Column(String(64), nullable=False)
    from_stage = Column(String(32), nullable=True)
    to_stage = Column(String(32), nullable=True)
    from_status = Column(String(64), nullable=True)
    to_status = Column(String(64), nullable=True)
    details = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

"""Audit record for a Marketing or operations user closing a workflow request."""

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class RequestClosure(Base):
    __tablename__ = "request_closures"
    __table_args__ = (
        UniqueConstraint("request_type", "request_id", name="uq_request_closures_type_id"),
        CheckConstraint(
            "request_type IN ('design', 'mockup', 'sample', 'costing', 'feasibility')",
            name="ck_request_closures_supported_type",
        ),
        Index("ix_request_closures_closed_at", "closed_at"),
    )

    id = Column(Integer, primary_key=True)
    request_type = Column(String(16), nullable=False)
    request_id = Column(Integer, nullable=False)
    request_code = Column(String(64), nullable=True)
    closed_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    closed_by = Column(String(255), nullable=False)
    closed_by_team = Column(String(100), nullable=True)
    reason = Column(Text, nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

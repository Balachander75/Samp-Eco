"""Reference and identity data models for the Navneet SAMP ERP."""
from sqlalchemy import CheckConstraint, Column, ForeignKey, Index, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "NOT is_team_head OR NULLIF(trim(team), '') IS NOT NULL",
            name="ck_users_team_head_requires_team",
        ),
        Index("ix_users_team_head", "team", "is_team_head"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    userid = Column(String(100), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user", server_default="user", nullable=False)
    sub_role = Column(String(100), nullable=True)
    team = Column(String(100), nullable=True, index=True)
    is_team_head = Column(Boolean, default=False, nullable=False)
    plant_code = Column(String(50), nullable=True)
    theme_id = Column(String(20), nullable=False, default="emerald", server_default="emerald")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @property
    def plant_codes(self):
        return [self.plant_code] if self.plant_code else []


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    country = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Plant(Base):
    __tablename__ = "plants"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    token_hash = Column(String(255), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class LoginAuditLog(Base):
    __tablename__ = "login_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    identifier = Column(String(255), nullable=False, index=True)
    ip_address = Column(String(100), nullable=True)
    user_agent = Column(String(500), nullable=True)
    status = Column(String(50), nullable=False, index=True)
    failure_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

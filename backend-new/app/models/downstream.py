"""
SQLAlchemy database models for cross-desk downstream operational entities:
- Studio Dielines (CAD dieline drafting & simulation desk)
- Creative Briefs (Packaging & cover artwork design desk)
- Costing Estimations (B2B commercial estimation & pricing desk)
"""

from datetime import datetime, timezone
from typing import Any, Dict
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.database import Base


class StudioDieline(Base):
    """
    Studio CAD & Dieline entity (table: studio_dielines).
    Tracks dielines, dimensions, substrate calipers, machine compatibility, and CAD workflow.
    """

    __tablename__ = "studio_dielines"

    id = Column(String(50), primary_key=True, index=True)
    dieline_code = Column(String(50), nullable=False, unique=True, index=True)
    sr_number = Column(String(50), nullable=True, index=True)
    box_format = Column(String(100), nullable=False, default="Rigid Box")
    title = Column(String(255), nullable=False)
    client = Column(String(150), nullable=False)
    dimensions = Column(String(100), nullable=False)
    substrate = Column(String(100), nullable=False)
    caliper_microns = Column(Integer, nullable=False, default=450)
    machine_compatibility = Column(String(150), nullable=False, default="Bobst NovaCut 106")
    status = Column(String(50), nullable=False, default="CAD Intake")
    due_date = Column(String(50), nullable=False)
    target_plant = Column(String(100), nullable=False)
    flute_grade = Column(String(50), nullable=True)
    grain_direction = Column(String(50), nullable=False, default="Parallel to Spine")
    file_formats = Column(JSONB, nullable=False, default=list, server_default="[]")

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "dielineCode": self.dieline_code,
            "srNumber": self.sr_number or "",
            "boxFormat": self.box_format,
            "title": self.title,
            "client": self.client,
            "dimensions": self.dimensions,
            "substrate": self.substrate,
            "caliperMicrons": self.caliper_microns,
            "machineCompatibility": self.machine_compatibility,
            "status": self.status,
            "dueDate": self.due_date,
            "targetPlant": self.target_plant,
            "fluteGrade": self.flute_grade or "",
            "grainDirection": self.grain_direction,
            "fileFormats": self.file_formats or [],
        }


class CreativeBrief(Base):
    """
    Creative Design Brief entity (table: creative_briefs).
    Tracks creative briefs, artwork proofs, Pantone/CMYK specs, and approvals.
    """

    __tablename__ = "creative_briefs"

    id = Column(String(50), primary_key=True, index=True)
    art_code = Column(String(50), nullable=False, unique=True, index=True)
    sr_number = Column(String(50), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    brand = Column(String(150), nullable=False)
    category = Column(String(100), nullable=False, default="Notebook Covers")
    variants_count = Column(Integer, nullable=False, default=1)
    designer = Column(String(150), nullable=False, default="Lead Designer")
    color_specs = Column(String(150), nullable=False, default="4C CMYK + Spot Gold")
    proof_version = Column(String(20), nullable=False, default="v1.0")
    proof_status = Column(String(50), nullable=False, default="Brief Intake")
    due_date = Column(String(50), nullable=False)
    dimensions = Column(String(100), nullable=False)
    finishing_notes = Column(Text, nullable=True)
    cmyk_check_passed = Column(Boolean, nullable=False, default=True)
    resolution_dpi = Column(Integer, nullable=False, default=300)
    bleed_mm = Column(Float, nullable=False, default=3.0)
    client_feedback = Column(Text, nullable=True)
    accent_color = Column(String(50), nullable=False, default="#4F46E5")

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "artCode": self.art_code,
            "srNumber": self.sr_number or "",
            "title": self.title,
            "brand": self.brand,
            "category": self.category,
            "variantsCount": self.variants_count,
            "designer": self.designer,
            "colorSpecs": self.color_specs,
            "proofVersion": self.proof_version,
            "proofStatus": self.proof_status,
            "dueDate": self.due_date,
            "dimensions": self.dimensions,
            "finishingNotes": self.finishing_notes or "",
            "cmykCheckPassed": self.cmyk_check_passed,
            "resolutionDpi": self.resolution_dpi,
            "bleedMm": self.bleed_mm,
            "clientFeedback": self.client_feedback or "",
            "accentColor": self.accent_color,
        }


class CostingEstimation(Base):
    """
    Costing Estimation entity (table: costing_estimations).
    Tracks commercial B2B bill of materials, substrate costs, margin simulations, and quotes.
    """

    __tablename__ = "costing_estimations"

    id = Column(String(50), primary_key=True, index=True)
    costing_code = Column(String(50), nullable=False, unique=True, index=True)
    sr_number = Column(String(50), nullable=True, index=True)
    customer = Column(String(150), nullable=False)
    product_title = Column(String(255), nullable=False)
    target_volume = Column(Integer, nullable=False, default=1000)
    substrate_unit_cost = Column(Float, nullable=False, default=0.0)
    conversion_unit_cost = Column(Float, nullable=False, default=0.0)
    net_unit_cost = Column(Float, nullable=False, default=0.0)
    margin_pct = Column(Float, nullable=False, default=24.0)
    quoted_unit_price = Column(Float, nullable=False, default=0.0)
    total_project_value = Column(Float, nullable=False, default=0.0)
    status = Column(String(50), nullable=False, default="Spec Review")
    due_date = Column(String(50), nullable=False)
    target_plant = Column(String(100), nullable=False)
    substrate_spec = Column(String(255), nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "costingCode": self.costing_code,
            "srNumber": self.sr_number or "",
            "customer": self.customer,
            "productTitle": self.product_title,
            "targetVolume": self.target_volume,
            "substrateUnitCost": self.substrate_unit_cost,
            "conversionUnitCost": self.conversion_unit_cost,
            "netUnitCost": self.net_unit_cost,
            "marginPct": self.margin_pct,
            "quotedUnitPrice": self.quoted_unit_price,
            "totalProjectValue": self.total_project_value,
            "status": self.status,
            "dueDate": self.due_date,
            "targetPlant": self.target_plant,
            "substrateSpec": self.substrate_spec,
        }

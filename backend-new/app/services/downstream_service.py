"""
Downstream Operational Service.
Manages database operations for Studio Dielines, Creative Briefs, and Costing Estimations.
Handles schema conversions between Frontend camelCase contracts and Database models.
"""

import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.downstream import CostingEstimation, CreativeBrief, StudioDieline

logger = logging.getLogger("uvicorn.error")

SEED_STUDIO_DIELINES: List[Dict[str, Any]] = []
SEED_CREATIVE_BRIEFS: List[Dict[str, Any]] = []
SEED_COSTING_ESTIMATIONS: List[Dict[str, Any]] = []


class DownstreamService:
    def __init__(self, db: Session):
        self.db = db

    def seed_if_empty(self) -> None:
        """No-op. Starter dummy data has been removed."""
        pass

    # -------------------------------------------------------------------------
    # Studio Dielines
    # -------------------------------------------------------------------------
    def list_studio_dielines(self) -> List[Dict[str, Any]]:
        self.seed_if_empty()
        dielines = self.db.query(StudioDieline).order_by(StudioDieline.id.asc()).all()
        return [d.to_dict() for d in dielines]

    def update_studio_dieline(self, dieline_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        dieline = self.db.query(StudioDieline).filter(StudioDieline.id == dieline_id).first()
        if not dieline:
            return None

        key_mapping = {
            "dielineCode": "dieline_code",
            "srNumber": "sr_number",
            "boxFormat": "box_format",
            "title": "title",
            "client": "client",
            "dimensions": "dimensions",
            "substrate": "substrate",
            "caliperMicrons": "caliper_microns",
            "machineCompatibility": "machine_compatibility",
            "status": "status",
            "dueDate": "due_date",
            "targetPlant": "target_plant",
            "fluteGrade": "flute_grade",
            "grainDirection": "grain_direction",
            "fileFormats": "file_formats",
        }

        for key, value in updates.items():
            attr = key_mapping.get(key, key)
            if hasattr(dieline, attr):
                setattr(dieline, attr, value)

        self.db.commit()
        self.db.refresh(dieline)
        return dieline.to_dict()

    # -------------------------------------------------------------------------
    # Creative Briefs
    # -------------------------------------------------------------------------
    def list_creative_briefs(self) -> List[Dict[str, Any]]:
        self.seed_if_empty()
        briefs = self.db.query(CreativeBrief).order_by(CreativeBrief.id.asc()).all()
        return [b.to_dict() for b in briefs]

    def update_creative_brief(self, brief_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        brief = self.db.query(CreativeBrief).filter(CreativeBrief.id == brief_id).first()
        if not brief:
            return None

        key_mapping = {
            "artCode": "art_code",
            "srNumber": "sr_number",
            "title": "title",
            "brand": "brand",
            "category": "category",
            "variantsCount": "variants_count",
            "designer": "designer",
            "colorSpecs": "color_specs",
            "proofVersion": "proof_version",
            "proofStatus": "proof_status",
            "dueDate": "due_date",
            "dimensions": "dimensions",
            "finishingNotes": "finishing_notes",
            "cmykCheckPassed": "cmyk_check_passed",
            "resolutionDpi": "resolution_dpi",
            "bleedMm": "bleed_mm",
            "clientFeedback": "client_feedback",
            "accentColor": "accent_color",
        }

        for key, value in updates.items():
            attr = key_mapping.get(key, key)
            if hasattr(brief, attr):
                setattr(brief, attr, value)

        self.db.commit()
        self.db.refresh(brief)
        return brief.to_dict()

    # -------------------------------------------------------------------------
    # Costing Estimations
    # -------------------------------------------------------------------------
    def list_costing_estimations(self) -> List[Dict[str, Any]]:
        self.seed_if_empty()
        costings = self.db.query(CostingEstimation).order_by(CostingEstimation.id.asc()).all()
        return [c.to_dict() for c in costings]

    def update_costing_estimation(self, costing_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        costing = self.db.query(CostingEstimation).filter(CostingEstimation.id == costing_id).first()
        if not costing:
            return None

        key_mapping = {
            "costingCode": "costing_code",
            "srNumber": "sr_number",
            "customer": "customer",
            "productTitle": "product_title",
            "targetVolume": "target_volume",
            "substrateUnitCost": "substrate_unit_cost",
            "conversionUnitCost": "conversion_unit_cost",
            "netUnitCost": "net_unit_cost",
            "marginPct": "margin_pct",
            "quotedUnitPrice": "quoted_unit_price",
            "totalProjectValue": "total_project_value",
            "status": "status",
            "dueDate": "due_date",
            "targetPlant": "target_plant",
            "substrateSpec": "substrate_spec",
        }

        for key, value in updates.items():
            attr = key_mapping.get(key, key)
            if hasattr(costing, attr):
                setattr(costing, attr, value)

        # Recalculate financial formulas if unit costs or margin were updated
        sub_cost = float(costing.substrate_unit_cost or 0.0)
        conv_cost = float(costing.conversion_unit_cost or 0.0)
        net_cost = round(sub_cost + conv_cost, 2)
        costing.net_unit_cost = net_cost

        margin = float(costing.margin_pct or 0.0)
        if margin < 100.0:
            quoted_price = round(net_cost / (1.0 - (margin / 100.0)), 2)
        else:
            quoted_price = net_cost
        costing.quoted_unit_price = quoted_price

        vol = int(costing.target_volume or 0)
        costing.total_project_value = round(vol * quoted_price, 2)

        self.db.commit()
        self.db.refresh(costing)
        return costing.to_dict()

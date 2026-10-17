"""
Sample Request Service in backend-new.
Encapsulates business operations for Sample Requests lifecycle, business year calculations,
batch creation, and material searches.
"""
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone, date
import base64
import binascii
import re
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.repositories.sample_request_repo import SampleRequestRepository
from app.models.sample_request import (
    CreateSampleRequest,
    ProductCharacteristic,
    ProductDetail,
    SampleRequestActivityLog,
    SampleRequestType,
    SampleRequestReferenceImage,
)
from app.models.master import Plant
from app.utils.business_year import (
    get_business_year_for_date_str,
    get_current_business_year,
)
from app.utils.request_codes import REQUEST_CODE_PREFIX_BY_SCOPE, next_request_code

MAX_SCOPE_REFERENCE_IMAGE_BYTES = 524_288
MAX_SCOPE_REFERENCE_IMAGE_SOURCE_BYTES = 15 * 1024 * 1024
SCOPE_REFERENCE_IMAGE_DATA_URL_RE = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$")


class SampleRequestService:
    """Application service for Sample Requests."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = SampleRequestRepository(db)

    def get_default_plant(self) -> str:
        """Use the Khaniwade intake plant configured for Marketing sample requests."""
        try:
            p = self.db.query(Plant).filter(Plant.code == "1505", Plant.is_active.is_(True)).first()
            return p.name if p else ""
        except Exception:
            return ""

    def serialize(
        self,
        r: CreateSampleRequest,
        *,
        list_detail_summary: Optional[Dict[str, Optional[str]]] = None,
        include_scope_reference_data: bool = False,
    ) -> Dict[str, Any]:
        """Serialize a sample request database record."""
        created_date = r.date_request_created or (r.created_at.strftime("%Y-%m-%d") if r.created_at else "")
        by_val = get_business_year_for_date_str(created_date) if created_date else (r.year or get_current_business_year())
        py_val = r.program_year or ""
        details = r.product_details if list_detail_summary is None else []
        binding_values = (
            self._get_binding_values(r)
            if list_detail_summary is None
            else (list_detail_summary.get("binding_type_1"), list_detail_summary.get("binding_type_2"))
        )
        mockup_workflow_state = r.mockup_workflow_state if isinstance(r.mockup_workflow_state, dict) else {}
        valid_scopes = ("design", "mockup", "sample", "costing")
        request_types = [scope for scope in r.request_types if scope in valid_scopes] if isinstance(r.request_types, list) else []
        request_codes = r.request_codes if isinstance(r.request_codes, dict) else {}
        audit = getattr(r, "request_type_audit", None)
        if audit:
            audited_scopes = [scope for scope in valid_scopes if getattr(audit, scope, False)]
            if audited_scopes:
                request_types = audited_scopes
        if not request_types:
            request_types = [scope for scope in valid_scopes if request_codes.get(scope)]
        mockup_requested = str(r.mockup_required or "").strip().casefold() in {"yes", "true", "y"} or bool(mockup_workflow_state)
        if not request_types:
            code_prefixes = {"DR": "design", "MR": "mockup", "SR": "sample", "CR": "costing"}
            for code in (getattr(r, "request_code", None), r.material_code):
                prefix = str(code or "").strip().upper().split("-", 1)[0]
                if prefix in code_prefixes:
                    if prefix == "SR" and mockup_requested:
                        continue
                    request_types = [code_prefixes[prefix]]
                    break
        if not request_types and mockup_requested:
            request_types = ["mockup"]
        if not request_types and r.sr_number and str(r.sr_number).upper().startswith("SR-"):
            request_types = ["sample"]
        if not request_types:
            request_types = ["sample"]
        if not mockup_workflow_state and ("mockup" in request_types or str(r.mockup_required or "").casefold() == "yes"):
            current_status = str(r.status or "").strip().casefold()
            stage = "studio" if current_status.startswith("studio") else "creative" if current_status.startswith("creative") else "marketing"
            mockup_workflow_state = {"stage": stage, "events": []}

        audit_data = None
        if getattr(r, "request_type_audit", None):
            audit = r.request_type_audit
            audit_data = {
                "design": audit.design,
                "mockup": audit.mockup,
                "sample": audit.sample,
                "costing": audit.costing,
                "design_selected_at": audit.design_selected_at.isoformat() if audit.design_selected_at else None,
                "mockup_selected_at": audit.mockup_selected_at.isoformat() if audit.mockup_selected_at else None,
                "sample_selected_at": audit.sample_selected_at.isoformat() if audit.sample_selected_at else None,
                "costing_selected_at": audit.costing_selected_at.isoformat() if audit.costing_selected_at else None,
            }

        scope_reference_images: Dict[str, List[Dict[str, Any]]] = {scope: [] for scope in ("sample", "mockup", "costing")}
        if include_scope_reference_data:
            image_records = (
                self.db.query(SampleRequestReferenceImage)
                .filter(SampleRequestReferenceImage.sample_request_id == r.id)
                .order_by(SampleRequestReferenceImage.scope, SampleRequestReferenceImage.sort_order)
                .all()
            )
            for image in image_records:
                encoded = base64.b64encode(image.image_data or b"").decode("ascii")
                scope_reference_images.setdefault(image.scope, []).append({
                    "id": image.id,
                    "name": image.original_name,
                    "content_type": image.content_type,
                    "original_size_bytes": image.original_size_bytes,
                    "size_bytes": len(image.image_data or b""),
                    "sort_order": image.sort_order,
                    "url": f"data:{image.content_type};base64,{encoded}",
                })

        trend_val = list_detail_summary.get("trend") if list_detail_summary is not None else None
        target_audience_val = (
            list_detail_summary.get("target_audience") if list_detail_summary is not None else None
        )
        remarks_val = list_detail_summary.get("design_remarks") if list_detail_summary is not None else None
        if details:
            for d in details:
                norm_char = self._normalize_characteristic_name(d.characteristic_name)
                if norm_char in {"TREND", "THEME", "DESIGNTREND", "DESIGNTHEME"}:
                    trend_val = d.value
                elif norm_char in {"TARGETAUDIENCE", "AUDIENCE"}:
                    target_audience_val = d.value
                elif norm_char == "DESIGNREMARKS":
                    remarks_val = d.value

        return {
            "id": r.id,
            "sr_number": r.sr_number if "sample" in request_types else None,
            "request_code": r.sr_number if "sample" in request_types else next((
                request_codes.get(key)
                for key in ("design", "mockup", "costing")
                if key in request_types and request_codes.get(key)
            ), None),
            "request_codes": request_codes,
            "year": by_val,
            "program_year": py_val,
            "program_name": r.program_name or "",
            "product_description": r.product_description or "",
            "customer": r.customer or "",
            "target_plant": r.target_plant or "",
            "date_request_created": created_date,
            "created_by": r.created_by or "",
            "created_by_user_id": r.created_by_user_id,
            "material_code": (
                next((request_codes.get(key) for key in ("design", "mockup", "costing") if key in request_types and request_codes.get(key)), r.material_code or "")
                if "sample" not in request_types else r.material_code or ""
            ),
            "barcode": r.barcode or "",
            "customer_product_code": r.customer_product_code or "",
            "source_sample_code": r.source_sample_code or "",
            "binding_type_1": binding_values[0],
            "binding_type_2": binding_values[1],
            "sample_required_date": r.sample_required_date.isoformat() if r.sample_required_date else None,
            "product_type": r.product_type,
            "product_type_navneet": r.product_type_navneet,
            "product_type_new_customer": r.product_type_new_customer,
            "brand_name": r.brand_name,
            "unit_pc_pack": r.unit_pc_pack,
            "qty_per_pack": r.qty_per_pack,
            "qty_for_sampling": r.qty_for_sampling,
            "qty_design_costing": r.qty_design_costing,
            "costing_required_date": r.costing_required_date,
            "costing_creative_input_needed": bool(r.costing_creative_input_needed),
            "costing_creative_input_remark": r.costing_creative_input_remark,
            "costing_counter_date": r.costing_counter_date,
            "costing_output_path": r.costing_output_path,
            "mockup_required": r.mockup_required,
            "designs_customer_creative": r.designs_customer_creative,
            "product_artwork_nos": r.product_artwork_nos,
            "product_image_path": r.product_image_path,
            "reference_images": r.reference_images if isinstance(r.reference_images, list) else [],
            "reference_links": r.reference_links if isinstance(r.reference_links, list) else [],
            "scope_reference_images": scope_reference_images,
            "target_artwork_date_creative": r.target_artwork_date_creative,
            "target_artwork_date_studio": r.target_artwork_date_studio,
            "status": r.status or "Draft (Pre-SMT)",
            "creation_mode": r.creation_mode or "material_code",
            "request_types": request_types,
            "mockup_workflow_state": mockup_workflow_state,
            "request_type_audit": audit_data,
            "custom_details": [
                {
                    "id": d.id,
                    "class_name": d.class_name,
                    "characteristic_name": d.characteristic_name,
                    "value": d.value,
                    "uom": d.uom,
                }
                for d in (details or [])
            ],
            "product_category": r.product_category,
            "product_sub_category": r.product_sub_category,
            "product_third_category": r.product_third_category,
            "trend": trend_val,
            "target_audience": target_audience_val,
            "design_remarks": remarks_val,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }

    @staticmethod
    def _normalize_characteristic_name(name: Any) -> str:
        return "".join(character for character in str(name or "").upper() if character.isalnum())

    def _apply_product_details(self, request: CreateSampleRequest, payload: Dict[str, Any]) -> None:
        details = payload.get("custom_details") or payload.get("customDetails") or []
        if isinstance(details, list):
            for detail in details:
                if not isinstance(detail, dict):
                    continue
                characteristic = detail.get("characteristic_name") or detail.get("characteristicName")
                value = detail.get("value")
                if not characteristic:
                    continue
                class_name = detail.get("class_name") or detail.get("className") or "Product"
                normalized_class = self._normalize_characteristic_name(class_name)
                normalized_name = self._normalize_characteristic_name(characteristic)
                existing = next(
                    (
                        item
                        for item in request.product_details
                        if self._normalize_characteristic_name(item.class_name) == normalized_class
                        and self._normalize_characteristic_name(item.characteristic_name) == normalized_name
                    ),
                    None,
                )
                if existing:
                    existing.value = str(value).strip() if value is not None and str(value).strip() else None
                    existing.uom = detail.get("uom") or existing.uom
                elif value is not None and str(value).strip():
                    request.product_details.append(
                        ProductDetail(
                            class_name=class_name,
                            characteristic_name=str(characteristic),
                            value=str(value).strip(),
                            uom=detail.get("uom"),
                        )
                    )

        for snake_key, camel_key, characteristic in (
            ("custom_binding_1", "customBinding1", "BINDINGTYPE1"),
            ("custom_binding_2", "customBinding2", "BINDINGTYPE2"),
        ):
            value = payload.get(snake_key) or payload.get(camel_key)
            if not value:
                continue
            normalized_name = self._normalize_characteristic_name(characteristic)
            existing = next(
                (
                    item
                    for item in request.product_details
                    if self._normalize_characteristic_name(item.class_name) == "NBBINDING"
                    and self._normalize_characteristic_name(item.characteristic_name) in {
                        normalized_name,
                        "BINDING1" if characteristic.endswith("1") else "BINDING2",
                    }
                ),
                None,
            )
            if existing:
                existing.value = str(value).strip()
            else:
                request.product_details.append(
                    ProductDetail(
                        class_name="NB_BINDING",
                        characteristic_name=characteristic,
                        value=str(value).strip(),
                    )
                )

        for k, c_name in (
            ("trend", "TREND"),
            ("target_audience", "TARGET_AUDIENCE"),
            ("targetAudience", "TARGET_AUDIENCE"),
            ("design_remarks", "DESIGN_REMARKS"),
            ("designRemarks", "DESIGN_REMARKS"),
        ):
            v = payload.get(k)
            if v is not None and str(v).strip():
                norm_c = self._normalize_characteristic_name(c_name)
                existing = next(
                    (
                        item
                        for item in request.product_details
                        if self._normalize_characteristic_name(item.characteristic_name) == norm_c
                    ),
                    None,
                )
                if existing:
                    existing.value = str(v).strip()
                else:
                    request.product_details.append(
                        ProductDetail(
                            class_name="Design",
                            characteristic_name=c_name,
                            value=str(v).strip(),
                        )
                    )

    def _clone_source_product_details(self, request: CreateSampleRequest, source_id: int) -> None:
        source_details = (
            self.db.query(ProductDetail)
            .filter(ProductDetail.sample_request_id == source_id)
            .all()
        )
        for detail in source_details:
            request.product_details.append(
                ProductDetail(
                    class_name=detail.class_name,
                    characteristic_name=detail.characteristic_name,
                    value=detail.value,
                    uom=detail.uom,
                )
            )

    def _apply_request_type_audit(
        self,
        request: CreateSampleRequest,
        payload: Dict[str, Any],
        stamp_new: bool = False,
    ) -> None:
        req_types = payload.get("request_types") or payload.get("requestTypes") or []
        if isinstance(req_types, str):
            req_types = [t.strip().lower() for t in req_types.split(",")]
        else:
            req_types = [str(t).strip().lower() for t in req_types]

        timestamps = payload.get("request_type_timestamps") or payload.get("requestTypeTimestamps") or {}
        if not isinstance(timestamps, dict):
            timestamps = {}

        def parse_dt(val: Any) -> Optional[datetime]:
            if not val:
                return None
            if isinstance(val, datetime):
                return val
            try:
                clean = str(val).replace("Z", "+00:00")
                return datetime.fromisoformat(clean)
            except Exception:
                return None

        audit = request.request_type_audit or SampleRequestType()
        now = datetime.now(timezone.utc) if stamp_new else None
        for scope in ("design", "mockup", "sample", "costing"):
            is_selected = scope in req_types
            selected_at_field = f"{scope}_selected_at"
            prior_selected = bool(getattr(audit, scope, False))
            prior_selected_at = getattr(audit, selected_at_field, None)
            selected_at = parse_dt(timestamps.get(scope))
            if is_selected and selected_at is None:
                selected_at = prior_selected_at or (now if stamp_new and not prior_selected else None)
            setattr(audit, scope, is_selected)
            setattr(audit, selected_at_field, selected_at if is_selected else None)
        request.request_type_audit = audit

    @classmethod
    def _get_binding_values(cls, request: CreateSampleRequest) -> Tuple[Optional[str], Optional[str]]:
        if not request.product_details:
            return None, None
        binding1 = None
        binding2 = None
        for detail in request.product_details:
            if cls._normalize_characteristic_name(detail.class_name) != "NBBINDING":
                continue
            name = cls._normalize_characteristic_name(detail.characteristic_name)
            if name in {"BINDINGTYPE1", "BINDING1"} and detail.value:
                binding1 = binding1 or detail.value
            elif name in {"BINDINGTYPE2", "BINDING2"} and detail.value:
                binding2 = binding2 or detail.value
        return binding1, binding2

    def list_requests(
        self,
        year: Optional[str] = None,
        customer: Optional[str] = None,
        status: Optional[str] = None,
        draft_only: bool = False,
        created_by: Optional[str] = None,
        created_by_user_id: Optional[int] = None,
        request_type: Optional[str] = None,
        skip: int = 0,
        limit: Optional[int] = None,
        before_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        records = self.repo.list_by_filters(
            year=year,
            customer=customer,
            status=status,
            draft_only=draft_only,
            created_by=created_by,
            created_by_user_id=created_by_user_id,
            request_type=request_type,
            skip=skip,
            limit=limit,
            before_id=before_id,
        )
        detail_summaries = self.repo.get_list_detail_summaries([r.id for r in records])
        return [
            self.serialize(r, list_detail_summary=detail_summaries.get(r.id, {}))
            for r in records
        ]

    def get_by_id(self, id: int) -> Optional[Dict[str, Any]]:
        r = self.repo.get_by_id(id)
        if not r:
            return None
        return self.serialize(r, include_scope_reference_data=True)

    @staticmethod
    def _decode_scope_reference_image(value: Any) -> Tuple[str, bytes, str, Optional[int]]:
        if isinstance(value, str):
            data_url = value
            name = "Reference image"
            original_size = None
        elif isinstance(value, dict):
            data_url = value.get("url") or value.get("data_url") or value.get("dataUrl") or ""
            name = str(value.get("name") or value.get("original_name") or "Reference image").strip()
            raw_original_size = value.get("original_size_bytes", value.get("originalSizeBytes"))
            try:
                original_size = int(raw_original_size) if raw_original_size is not None else None
            except (TypeError, ValueError):
                original_size = None
        else:
            raise HTTPException(status_code=422, detail="Reference image entries must include image data.")

        match = SCOPE_REFERENCE_IMAGE_DATA_URL_RE.fullmatch(str(data_url or ""))
        if not match:
            raise HTTPException(status_code=422, detail="Reference images must be JPEG, PNG, or WebP data URLs.")
        content_type, encoded = match.groups()
        try:
            image_data = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(status_code=422, detail="Reference image data is invalid.")
        if not image_data:
            raise HTTPException(status_code=422, detail="Reference image data is empty.")
        if len(image_data) > MAX_SCOPE_REFERENCE_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Each compressed reference image must be at most 512 KB.")
        signatures = {
            "image/jpeg": image_data.startswith(b"\xff\xd8\xff"),
            "image/png": image_data.startswith(b"\x89PNG\r\n\x1a\n"),
            "image/webp": image_data.startswith(b"RIFF") and image_data[8:12] == b"WEBP",
        }
        if not signatures.get(content_type, False):
            raise HTTPException(status_code=422, detail="Reference image content does not match its file type.")
        if original_size is not None and (original_size < 0 or original_size > MAX_SCOPE_REFERENCE_IMAGE_SOURCE_BYTES):
            raise HTTPException(status_code=422, detail="Original reference images must be at most 15 MB.")
        return content_type, image_data, (name or "Reference image")[:255], original_size

    def _sync_scope_reference_images(self, request: CreateSampleRequest, payload: Dict[str, Any]) -> bool:
        raw = payload.get("scope_reference_images", payload.get("scopeReferenceImages"))
        if raw is None:
            return False
        if not isinstance(raw, dict):
            raise HTTPException(status_code=422, detail="Scope reference images must be grouped by request type.")

        allowed_scopes = {"sample", "mockup", "costing"}
        selected_scopes = set(request.request_types or [])
        unknown = set(raw.keys()) - allowed_scopes
        if unknown:
            raise HTTPException(status_code=422, detail="Reference images are supported only for Sample, Mockup, and Costing.")

        prepared: List[SampleRequestReferenceImage] = []
        for scope in ("sample", "mockup", "costing"):
            entries = raw.get(scope, [])
            if entries is None:
                entries = []
            if not isinstance(entries, list):
                raise HTTPException(status_code=422, detail=f"{scope.title()} reference images must be a list.")
            if len(entries) > 2:
                raise HTTPException(status_code=422, detail=f"A maximum of 2 {scope} reference images is allowed.")
            if entries and scope not in selected_scopes:
                raise HTTPException(status_code=422, detail=f"{scope.title()} reference images need a matching request scope.")
            for order, entry in enumerate(entries):
                content_type, image_data, original_name, original_size = self._decode_scope_reference_image(entry)
                prepared.append(SampleRequestReferenceImage(
                    scope=scope,
                    original_name=original_name,
                    content_type=content_type,
                    original_size_bytes=original_size,
                    image_data=image_data,
                    sort_order=order,
                ))

        current_records = list(request.scope_reference_image_records or [])
        existing_signature = [
            (image.scope, image.original_name, image.content_type, image.original_size_bytes, image.image_data, image.sort_order)
            for image in current_records
        ]
        prepared_signature = [
            (image.scope, image.original_name, image.content_type, image.original_size_bytes, image.image_data, image.sort_order)
            for image in prepared
        ]
        if existing_signature == prepared_signature:
            return False

        for current in current_records:
            request.scope_reference_image_records.remove(current)
            self.db.delete(current)
        if current_records:
            self.db.flush()
        for image in prepared:
            request.scope_reference_image_records.append(image)
        return True

    def _build_entity(self, payload: Any) -> CreateSampleRequest:
        if hasattr(payload, "model_dump"):
            payload = payload.model_dump(by_alias=False)
        elif hasattr(payload, "dict"):
            payload = payload.dict()

        created_date_str = payload.get("date_request_created") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        calc_year = get_business_year_for_date_str(created_date_str)
        item_year = payload.get("year")
        if not item_year or "-" not in str(item_year):
            item_year = calc_year

        raw_program_year = payload.get("program_year")
        prog_year = str(raw_program_year).replace("BTS", "").strip() if raw_program_year is not None else None

        target_plant = payload.get("target_plant")
        if not target_plant or not str(target_plant).strip():
            target_plant = self.get_default_plant()
        else:
            target_plant = str(target_plant).strip()

        raw_types = payload.get("request_types") or payload.get("requestTypes") or []
        request_types = (
            [value.strip().lower() for value in raw_types.split(",") if value.strip()]
            if isinstance(raw_types, str)
            else [str(value).strip().lower() for value in raw_types if str(value).strip()]
        )
        if not request_types:
            raw_codes = payload.get("request_codes") or payload.get("requestCodes") or {}
            if isinstance(raw_codes, dict):
                request_types = [scope for scope in ("design", "mockup", "sample", "costing") if raw_codes.get(scope)]
        if not request_types:
            raw_mockup_state = payload.get("mockup_workflow_state") or payload.get("mockupWorkflowState") or {}
            mockup_requested = str(payload.get("mockup_required") or payload.get("mockupRequired") or "").strip().casefold() in {"yes", "true", "y"}
            if mockup_requested or (isinstance(raw_mockup_state, dict) and bool(raw_mockup_state)):
                request_types = ["mockup"]
            else:
                request_types = ["sample"]
        source_request_code = str(
            payload.get("source_request_code") or payload.get("sourceRequestCode") or ""
        ).strip().upper()
        if not re.fullmatch(r"(?:FC|DR|MR)-\d{2}-\d{3,}", source_request_code):
            source_request_code = ""
        reference_images = payload.get("reference_images", payload.get("referenceImages", []))
        reference_links = payload.get("reference_links", payload.get("referenceLinks", []))
        if not isinstance(reference_images, list):
            reference_images = []
        if not isinstance(reference_links, list):
            reference_links = []

        sample_req_date = None
        s_date_val = payload.get("sample_required_date")
        if s_date_val:
            try:
                sample_req_date = date.fromisoformat(str(s_date_val).split("T")[0])
            except (ValueError, TypeError):
                sample_req_date = None

        req = CreateSampleRequest(
            sr_number=None,
            client_draft_key=(str(payload.get("client_draft_key") or "").strip() or None),
            year=item_year,
            program_year=prog_year,
            program_name=payload.get("program_name") or None,
            product_description=payload.get("product_description") or "",
            customer=payload.get("customer") or "",
            target_plant=target_plant,
            date_request_created=created_date_str,
            created_by=payload.get("created_by") or "",
            created_by_user_id=payload.get("created_by_user_id"),
            material_code=source_request_code if "sample" in request_types else "",
            barcode=payload.get("barcode") or None,
            customer_product_code=payload.get("customer_product_code") or None,
            source_sample_code=payload.get("source_sample_code") or None,
            sample_required_date=sample_req_date,
            product_type=payload.get("product_type") or None,
            product_type_navneet=payload.get("product_type_navneet") or None,
            product_type_new_customer=payload.get("product_type_new_customer") or None,
            brand_name=payload.get("brand_name") or None,
            unit_pc_pack=str(payload.get("unit_pc_pack")) if payload.get("unit_pc_pack") is not None else None,
            qty_per_pack=str(payload.get("qty_per_pack")) if payload.get("qty_per_pack") is not None else None,
            qty_for_sampling=str(payload.get("qty_for_sampling")) if payload.get("qty_for_sampling") is not None else None,
            qty_design_costing=str(payload.get("qty_design_costing")) if payload.get("qty_design_costing") is not None else None,
            costing_required_date=payload.get("costing_required_date") or None,
            costing_creative_input_needed=(
                payload.get("costing_creative_input_needed", payload.get("costingCreativeInputNeeded")) is True
                or str(payload.get("costing_creative_input_needed", payload.get("costingCreativeInputNeeded", ""))).strip().casefold()
                in {"yes", "true", "1"}
            ),
            costing_creative_input_remark=(
                str(payload.get("costing_creative_input_remark", payload.get("costingCreativeInputRemark")) or "").strip() or None
            ),
            costing_counter_date=payload.get("costing_counter_date") or None,
            costing_output_path=payload.get("costing_output_path") or None,
            mockup_required=payload.get("mockup_required") or None,
            designs_customer_creative=payload.get("designs_customer_creative") or None,
            product_artwork_nos=str(payload.get("product_artwork_nos")) if payload.get("product_artwork_nos") is not None else None,
            product_image_path=payload.get("product_image_path") or None,
            reference_images=reference_images,
            reference_links=reference_links,
            target_artwork_date_creative=payload.get("target_artwork_date_creative") or None,
            target_artwork_date_studio=payload.get("target_artwork_date_studio") or None,
            product_category=payload.get("product_category") or payload.get("productCategory") or None,
            product_sub_category=payload.get("product_sub_category") or payload.get("productSubCategory") or None,
            product_third_category=payload.get("product_third_category") or payload.get("productThirdCategory") or None,
            status=payload.get("status") or "Draft (Pre-SMT)",
            creation_mode=payload.get("creation_mode") or "material_code",
            request_types=request_types,
            request_codes={},
            mockup_workflow_state=payload.get("mockup_workflow_state") or payload.get("mockupWorkflowState") or {},
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        source_id = payload.get("source_sample_request_id") or payload.get("sourceSampleRequestId")
        if not source_id and payload.get("source_sample_code"):
            src_code = str(payload.get("source_sample_code")).strip()
            src_match = self.repo.get_by_sr_number(src_code)
            if not src_match:
                matches = self.repo.search_materials(src_code, limit=1)
                if matches:
                    src_match = matches[0]
            if src_match:
                source_id = src_match.id

        if source_id:
            try:
                self._clone_source_product_details(req, int(source_id))
            except Exception:
                pass

        self._apply_product_details(req, payload)
        self._apply_request_type_audit(req, payload)
        return req

    def _reserve_sr_number(self, request: CreateSampleRequest) -> None:
        if "sample" not in (request.request_types or []):
            request.sr_number = None
            return
        if request.sr_number and request.sr_number.startswith("SR-"):
            return
        created_date = request.date_request_created or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        try:
            created_at = date.fromisoformat(str(created_date).split("T")[0])
        except (TypeError, ValueError):
            created_at = datetime.now(timezone.utc).date()
        request.sr_number = next_request_code(self.db, REQUEST_CODE_PREFIX_BY_SCOPE["sample"], created_at)

    def _reserve_request_codes(self, request: CreateSampleRequest) -> None:
        request_types = set(request.request_types or [])
        codes = dict(request.request_codes or {})
        for request_type in ("design", "costing", "mockup"):
            if request_type in request_types and not codes.get(request_type):
                codes[request_type] = self._reserve_scope_code(request, request_type)
        codes = dict(request.request_codes or {})
        request.request_codes = codes
        self._reserve_sr_number(request)
        if "sample" not in request_types and codes:
            request.material_code = next(
                (codes[key] for key in ("design", "mockup", "costing") if codes.get(key)),
                "",
            )

    def _reserve_scope_code(self, request: CreateSampleRequest, request_type: str) -> str:
        prefix = REQUEST_CODE_PREFIX_BY_SCOPE.get(request_type)
        if not prefix:
            raise ValueError(f"Unsupported request type for code allocation: {request_type}")
        codes = dict(request.request_codes or {})
        if codes.get(request_type):
            return str(codes[request_type])
        created_date = request.date_request_created or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        try:
            created_at = date.fromisoformat(str(created_date).split("T")[0])
        except (TypeError, ValueError):
            created_at = datetime.now(timezone.utc).date()
        code = next_request_code(self.db, prefix, created_at)
        codes[request_type] = code
        request.request_codes = codes
        return code

    def _find_by_draft_key(self, draft_key: Optional[str]) -> Optional[CreateSampleRequest]:
        if not draft_key:
            return None
        return self.db.query(CreateSampleRequest).filter(
            CreateSampleRequest.client_draft_key == draft_key
        ).with_for_update().first()

    def _refresh_draft_snapshot(self, request: CreateSampleRequest, payload: Dict[str, Any]) -> None:
        previous_status = request.status
        previous_types = list(request.request_types or [])
        candidate = self._build_entity(payload)
        protected = {"id", "sr_number", "request_codes", "created_at", "date_request_created", "year", "created_by"}
        changed_fields: List[str] = []
        for column in CreateSampleRequest.__table__.columns:
            if column.key not in protected:
                new_value = getattr(candidate, column.key)
                if getattr(request, column.key) != new_value:
                    setattr(request, column.key, new_value)
                    changed_fields.append(column.key)

        def details_signature(rows):
            return [
                (row.class_name, row.characteristic_name, row.value, row.uom)
                for row in rows
            ]

        if details_signature(request.product_details) != details_signature(candidate.product_details):
            request.product_details.clear()
            for detail in candidate.product_details:
                request.product_details.append(
                    ProductDetail(
                        class_name=detail.class_name,
                        characteristic_name=detail.characteristic_name,
                        value=detail.value,
                        uom=detail.uom,
                    )
                )
            changed_fields.append("product_details")

        audit = candidate.request_type_audit
        if audit:
            existing_audit = request.request_type_audit
            if existing_audit is None:
                existing_audit = SampleRequestType()
                request.request_type_audit = existing_audit
                changed_fields.append("request_type_audit")
            for scope in ("design", "mockup", "sample", "costing"):
                is_selected = bool(getattr(audit, scope))
                selected_at_field = f"{scope}_selected_at"
                new_selected_at = getattr(audit, selected_at_field)
                if is_selected and new_selected_at is None:
                    was_selected = bool(getattr(existing_audit, scope, False))
                    new_selected_at = getattr(existing_audit, selected_at_field, None)
                    if not was_selected:
                        new_selected_at = datetime.now(timezone.utc)
                new_values = {scope: is_selected, selected_at_field: new_selected_at if is_selected else None}
                for field, new_value in new_values.items():
                    if getattr(existing_audit, field) != new_value:
                        setattr(existing_audit, field, new_value)
                        if "request_type_audit" not in changed_fields:
                            changed_fields.append("request_type_audit")
        else:
            if request.request_type_audit is not None:
                request.request_type_audit = None
                changed_fields.append("request_type_audit")

        if self._sync_scope_reference_images(request, payload):
            changed_fields.append("scope_reference_images")

        old_identifiers = (request.sr_number, dict(request.request_codes or {}), request.material_code)
        self._reserve_request_codes(request)
        if old_identifiers != (request.sr_number, dict(request.request_codes or {}), request.material_code):
            changed_fields.append("request_identifiers")

        if changed_fields:
            request.updated_at = datetime.now(timezone.utc)
            self.add_activity_log(
                request,
                action="DRAFT_UPDATED",
                actor_id=payload.get("actor_user_id", request.created_by_user_id),
                actor_name=payload.get("actor_name") or payload.get("created_by") or request.created_by or "Marketing",
                actor_department="Marketing",
                from_status=previous_status,
                to_status=request.status,
                payload={
                    "changed_fields": sorted(changed_fields),
                    "previous_request_types": previous_types,
                    "request_types": list(request.request_types or []),
                },
            )

    @staticmethod
    def _is_draft(request: CreateSampleRequest) -> bool:
        return str(request.status or "").strip().casefold().startswith("draft")

    def add_activity_log(
        self,
        request: CreateSampleRequest,
        action: str,
        actor_id: Optional[int] = None,
        actor_name: Optional[str] = None,
        actor_department: Optional[str] = None,
        from_status: Optional[str] = None,
        to_status: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> SampleRequestActivityLog:
        entry = SampleRequestActivityLog(
            sample_request=request,
            request_sr_number=request.sr_number,
            actor_user_id=actor_id,
            actor_name=str(actor_name or request.created_by or "System")[:255],
            actor_department=str(actor_department)[:100] if actor_department else None,
            action=action[:64],
            from_status=from_status,
            to_status=to_status,
            payload=payload or {},
        )
        self.db.add(entry)
        return entry

    def create(self, payload: Dict[str, Any], *, commit: bool = True) -> Dict[str, Any]:
        """Create single sample request entity."""
        try:
            draft_key = str(payload.get("client_draft_key") or "").strip() or None
            existing = self._find_by_draft_key(draft_key)
            if existing:
                if self._is_draft(existing):
                    self._refresh_draft_snapshot(existing, payload)
                    if commit:
                        self.db.commit()
                        self.db.refresh(existing)
                return self.serialize(existing)

            req = self._build_entity(payload)
            self._apply_request_type_audit(req, payload, stamp_new=True)
            req.sr_number = f"TMP-SR-{uuid4().hex}"
            self.db.add(req)
            self.db.flush()
            self._sync_scope_reference_images(req, payload)
            self._reserve_request_codes(req)
            self.add_activity_log(
                req,
                action="DRAFT_CREATED" if self._is_draft(req) else "REQUEST_CREATED",
                actor_id=req.created_by_user_id,
                actor_name=req.created_by,
                actor_department="Marketing",
                to_status=req.status,
                payload={"request_types": list(req.request_types or []), "creation_mode": req.creation_mode},
            )

            if commit:
                self.db.commit()
                self.db.refresh(req)
            return self.serialize(req)
        except IntegrityError:
            self.db.rollback()
            existing = self._find_by_draft_key(str(payload.get("client_draft_key") or "").strip() or None)
            if existing:
                if self._is_draft(existing):
                    self._refresh_draft_snapshot(existing, payload)
                    if commit:
                        self.db.commit()
                        self.db.refresh(existing)
                return self.serialize(existing)
            raise
        except Exception as e:
            self.db.rollback()
            raise e

    def batch_create(self, items: List[Dict[str, Any]], *, commit: bool = True) -> List[Dict[str, Any]]:
        """Atomically create each staged product payload supplied by the batch endpoint."""
        if not items:
            return []

        for attempt in range(2):
            created_records = []
            try:
                for item in items:
                    draft_key = str(item.get("client_draft_key") or "").strip() or None
                    existing = self._find_by_draft_key(draft_key)
                    if existing:
                        if self._is_draft(existing):
                            self._refresh_draft_snapshot(existing, item)
                        created_records.append(existing)
                        continue

                    req = self._build_entity(item)
                    self._apply_request_type_audit(req, item, stamp_new=True)
                    req.sr_number = f"TMP-SR-{uuid4().hex}"
                    self.db.add(req)
                    self.db.flush()
                    self._sync_scope_reference_images(req, item)
                    self._reserve_request_codes(req)
                    self.add_activity_log(
                        req,
                        action="DRAFT_CREATED" if self._is_draft(req) else "REQUEST_CREATED",
                        actor_id=req.created_by_user_id,
                        actor_name=req.created_by,
                        actor_department="Marketing",
                        to_status=req.status,
                        payload={"request_types": list(req.request_types or []), "creation_mode": req.creation_mode},
                    )
                    created_records.append(req)

                if commit:
                    self.db.commit()
                    for rec in created_records:
                        self.db.refresh(rec)
                return [self.serialize(r) for r in created_records]
            except IntegrityError:
                self.db.rollback()
                if attempt == 1:
                    raise
            except Exception:
                self.db.rollback()
                raise
        return []

    def update(self, id: int, payload: Dict[str, Any], *, commit: bool = True) -> Optional[Dict[str, Any]]:
        record = self.repo.get_for_update(id)
        if not record:
            return None

        previous_status = record.status
        previous_request_types = list(record.request_types or [])
        update_fields: Dict[str, Any] = {}
        changed_fields: List[str] = []
        for key, val in payload.items():
            if hasattr(record, key) and val is not None:
                if key == "sample_required_date" and val:
                    try:
                        normalized_value = date.fromisoformat(str(val).split("T")[0])
                    except (ValueError, TypeError):
                        continue
                else:
                    normalized_value = val
                if getattr(record, key) != normalized_value:
                    update_fields[key] = normalized_value
                    changed_fields.append(key)

        if "request_types" in payload or "requestTypes" in payload:
            raw_types = payload.get("request_types", payload.get("requestTypes")) or []
            normalized_types = (
                [value.strip().lower() for value in raw_types.split(",") if value.strip()]
                if isinstance(raw_types, str)
                else [str(value).strip().lower() for value in raw_types if str(value).strip()]
            )
            if record.request_types != normalized_types:
                record.request_types = normalized_types
                update_fields["request_types"] = normalized_types
                if "request_types" not in changed_fields:
                    changed_fields.append("request_types")

        details_before = [
            (detail.class_name, detail.characteristic_name, detail.value, detail.uom)
            for detail in record.product_details
        ]
        self._apply_product_details(record, payload)
        if self._sync_scope_reference_images(record, payload):
            changed_fields.append("scope_reference_images")
        if "request_types" in payload or "requestTypes" in payload:
            self._apply_request_type_audit(record, payload, stamp_new=True)
        details_after = [
            (detail.class_name, detail.characteristic_name, detail.value, detail.uom)
            for detail in record.product_details
        ]
        if details_before != details_after:
            changed_fields.append("product_details")
        if not changed_fields:
            return self.serialize(record)

        old_identifiers = (record.sr_number, dict(record.request_codes or {}), record.material_code)
        self._reserve_request_codes(record)
        if old_identifiers != (record.sr_number, dict(record.request_codes or {}), record.material_code):
            changed_fields.append("request_identifiers")
            update_fields["sr_number"] = record.sr_number
            update_fields["request_codes"] = record.request_codes
            update_fields["material_code"] = record.material_code

        update_fields["updated_at"] = datetime.now(timezone.utc)
        self.add_activity_log(
            record,
            action="REQUEST_UPDATED",
            actor_id=payload.get("actor_user_id"),
            actor_name=payload.get("actor_name") or record.created_by or "Marketing",
            actor_department=payload.get("actor_department") or "Marketing",
            from_status=previous_status,
            to_status=update_fields.get("status", previous_status),
            payload={
                "changed_fields": sorted(changed_fields),
                **({
                    "previous_request_types": previous_request_types,
                    "request_types": list(record.request_types or []),
                } if "request_types" in changed_fields else {}),
            },
        )
        updated = self.repo.update(record, update_fields, commit=commit)
        return self.serialize(updated)

    def batch_update_status(self, ids: List[int], status: str) -> int:
        return self.repo.batch_update_status(ids, status)

    def delete(self, id: int) -> bool:
        return self.repo.delete(id)

    def search_materials(self, code: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search products by material code or description."""
        records = self.repo.search_materials(code=code)
        return [
            {
                "id": r.id,
                "created_by_user_id": r.created_by_user_id,
                "sr_number": r.sr_number,
                "request_code": r.sr_number if "sample" in (r.request_types or []) and r.sr_number else next((
                    (r.request_codes or {}).get(key)
                    for key in ("design", "mockup", "costing")
                    if (r.request_codes or {}).get(key)
                ), None),
                "request_codes": r.request_codes if isinstance(r.request_codes, dict) else {},
                "material_code": r.material_code,
                "product_description": r.product_description,
                "customer": r.customer,
                "target_plant": r.target_plant,
                "source_sample_code": r.source_sample_code,
                "binding_type_1": self._get_binding_values(r)[0],
                "binding_type_2": self._get_binding_values(r)[1],
                "product_category": r.product_category,
                "product_sub_category": r.product_sub_category,
                "product_third_category": r.product_third_category,
            }
            for r in records
        ]

    def search_products_by_binding(
        self,
        binding1: Optional[str] = None,
        binding2: Optional[str] = None,
        category: Optional[str] = None,
        sub_category: Optional[str] = None,
        third_category: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        records = self.repo.search_by_binding(
            binding1=binding1,
            binding2=binding2,
            category=category,
            sub_category=sub_category,
            third_category=third_category,
            limit=limit,
        )
        return [
            {
                "id": record.id,
                "created_by_user_id": record.created_by_user_id,
                "sr_number": record.sr_number,
                "material_code": record.material_code,
                "product_description": record.product_description,
                "customer": record.customer,
                "target_plant": record.target_plant,
                "source_sample_code": record.source_sample_code,
                "binding_type_1": binding1_value,
                "binding_type_2": binding2_value,
                "product_category": record.product_category,
                "product_sub_category": record.product_sub_category,
                "product_third_category": record.product_third_category,
            }
            for record, binding1_value, binding2_value in records
        ]

    def catalog_filter_counts(
        self,
        *,
        category: Optional[str] = None,
        sub_category: Optional[str] = None,
        third_category: Optional[str] = None,
        binding1: Optional[str] = None,
        created_by_user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        return self.repo.catalog_filter_counts(
            category=category,
            sub_category=sub_category,
            third_category=third_category,
            binding1=binding1,
            created_by_user_id=created_by_user_id,
        )

    def get_all_characteristics(self, class_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Return active master product characteristics sorted by sequence."""
        query = (
            self.db.query(ProductCharacteristic)
            .filter(ProductCharacteristic.is_active == True)
        )
        if class_name:
            query = query.filter(ProductCharacteristic.class_name == class_name)
        rows = query.order_by(ProductCharacteristic.class_name, ProductCharacteristic.sequence).all()
        return [
            {
                "id": c.id,
                "class_name": c.class_name,
                "characteristic_name": c.characteristic_name,
                "sequence": c.sequence,
                "uom": c.uom,
                "options": c.options or [],
                "is_active": c.is_active,
            }
            for c in rows
        ]

    def get_characteristic_classes(self) -> List[Dict[str, Any]]:
        """Return distinct characteristic classes and their characteristics."""
        rows = (
            self.db.query(ProductCharacteristic)
            .filter(ProductCharacteristic.is_active == True)
            .order_by(ProductCharacteristic.class_name, ProductCharacteristic.sequence)
            .all()
        )
        classes_map: Dict[str, List[Dict[str, Any]]] = {}
        for c in rows:
            classes_map.setdefault(c.class_name, []).append({
                "id": c.id,
                "characteristic_name": c.characteristic_name,
                "sequence": c.sequence,
                "uom": c.uom,
                "options": c.options or [],
            })
        return [
            {"class_name": cls_name, "characteristics": chars}
            for cls_name, chars in classes_map.items()
        ]

    def get_product_details(self, sample_request_id: int) -> List[Dict[str, Any]]:
        """Return product details for a given sample request."""
        rows = (
            self.db.query(ProductDetail)
            .filter(ProductDetail.sample_request_id == sample_request_id)
            .order_by(ProductDetail.id)
            .all()
        )
        return [
            {
                "id": d.id,
                "sample_request_id": d.sample_request_id,
                "sampleRequestId": d.sample_request_id,
                "class_name": d.class_name,
                "className": d.class_name,
                "characteristic_name": d.characteristic_name,
                "characteristicName": d.characteristic_name,
                "value": d.value,
                "uom": d.uom,
            }
            for d in rows
        ]

    def save_product_details(self, sample_request_id: int, details: List[Dict[str, Any]]) -> bool:
        """Upsert product details for a sample request."""
        req = self.repo.get_by_id(sample_request_id)
        if not req:
            return False

        existing_details = {
            f"{d.class_name}::{d.characteristic_name}".lower(): d
            for d in req.product_details
        }

        for item in details:
            class_name = item.get("class_name") or item.get("className") or "Product"
            char_name = item.get("characteristic_name") or item.get("characteristicName")
            if not char_name:
                continue
            key = f"{class_name}::{char_name}".lower()
            val = item.get("value")
            val_str = str(val).strip() if val is not None else None
            uom = item.get("uom")

            if key in existing_details:
                existing_details[key].value = val_str
                if uom is not None:
                    existing_details[key].uom = uom
            else:
                new_detail = ProductDetail(
                    sample_request_id=sample_request_id,
                    class_name=class_name,
                    characteristic_name=char_name,
                    value=val_str,
                    uom=uom,
                )
                self.db.add(new_detail)
                req.product_details.append(new_detail)

        req.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        return True

    def create_characteristic(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new product characteristic."""
        c = ProductCharacteristic(
            class_name=payload.get("class_name") or "Product",
            characteristic_name=payload.get("characteristic_name", ""),
            sequence=payload.get("sequence", 0),
            uom=payload.get("uom"),
            options=payload.get("options") or [],
            is_active=payload.get("is_active", True),
        )
        self.db.add(c)
        self.db.commit()
        self.db.refresh(c)
        return {
            "id": c.id,
            "class_name": c.class_name,
            "characteristic_name": c.characteristic_name,
            "sequence": c.sequence,
            "uom": c.uom,
            "options": c.options or [],
            "is_active": c.is_active,
        }

    def update_characteristic(self, char_id: int, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a product characteristic."""
        c = self.db.query(ProductCharacteristic).filter(ProductCharacteristic.id == char_id).first()
        if not c:
            return None
        for key in ("class_name", "characteristic_name", "sequence", "uom", "options", "is_active"):
            if key in payload:
                setattr(c, key, payload[key])
        self.db.commit()
        self.db.refresh(c)
        return {
            "id": c.id,
            "class_name": c.class_name,
            "characteristic_name": c.characteristic_name,
            "sequence": c.sequence,
            "uom": c.uom,
            "options": c.options or [],
            "is_active": c.is_active,
        }

    def add_characteristic_option(self, char_id: int, option: str) -> Optional[Dict[str, Any]]:
        """Add an option to a product characteristic."""
        c = self.db.query(ProductCharacteristic).filter(ProductCharacteristic.id == char_id).first()
        if not c:
            return None
        current_options = list(c.options or [])
        clean_opt = option.strip()
        if clean_opt and clean_opt not in current_options:
            current_options.append(clean_opt)
            c.options = current_options
            self.db.commit()
            self.db.refresh(c)
        return {
            "id": c.id,
            "class_name": c.class_name,
            "characteristic_name": c.characteristic_name,
            "sequence": c.sequence,
            "uom": c.uom,
            "options": c.options or [],
            "is_active": c.is_active,
        }


"""
Sample Request Repository.
Handles all database operations for the `create_sample_requests` entity.
"""
from typing import Optional, List, Dict, Any, Tuple
import re
from sqlalchemy.orm import Session, aliased, selectinload
from sqlalchemy import func, or_, and_, literal_column
from app.repositories.base import BaseRepository
from app.models.sample_request import CreateSampleRequest, ProductDetail
from app.utils.business_year import get_business_year_date_range

MISSING_TAXONOMY_FILTER = "__missing__"


class SampleRequestRepository(BaseRepository[CreateSampleRequest]):
    """Repository dedicated to sample requests persistence."""

    def __init__(self, db: Session):
        super().__init__(CreateSampleRequest, db)

    @staticmethod
    def _eager_options(include_product_details: bool = True):
        """Eager-load only relationships needed by the requested result shape."""
        options = [selectinload(CreateSampleRequest.request_type_audit)]
        if include_product_details:
            options.append(selectinload(CreateSampleRequest.product_details))
        return tuple(options)

    def get_by_id(self, id: Any) -> Optional[CreateSampleRequest]:
        """Fetch request by primary key with eager-loaded relationships."""
        return (
            self.db.query(CreateSampleRequest)
            .options(*self._eager_options())
            .filter(CreateSampleRequest.id == id)
            .first()
        )

    def get_by_sr_number(self, sr_number: str) -> Optional[CreateSampleRequest]:
        """Fetch request by SR number."""
        return (
            self.db.query(CreateSampleRequest)
            .options(*self._eager_options())
            .filter(CreateSampleRequest.sr_number == sr_number)
            .first()
        )

    def get_for_update(
        self,
        request_id: int,
        include_product_details: bool = True,
    ) -> Optional[CreateSampleRequest]:
        """Lock and refresh a request before applying a workflow update."""
        return (
            self.db.query(CreateSampleRequest)
            .options(*self._eager_options(include_product_details=include_product_details))
            .filter(CreateSampleRequest.id == request_id)
            .with_for_update()
            .populate_existing()
            .first()
        )

    def list_by_filters(
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
    ) -> List[CreateSampleRequest]:
        """Query sample requests with optional business year, customer, status, and created_by filters."""
        # List responses need only a small detail summary, loaded separately below.
        # Loading every EAV row here turns catalog-sized data into a huge response.
        query = self.db.query(CreateSampleRequest).options(*self._eager_options(include_product_details=False))

        if year and year.strip().upper() != "ALL":
            clean_year = year.strip()
            if "-" in clean_year and len(clean_year) == 9:
                date_range = get_business_year_date_range(clean_year)
                if date_range:
                    range_start, range_end = (value.isoformat() for value in date_range)
                    _, second_yr = clean_year.split("-")
                    query = query.filter(or_(
                        CreateSampleRequest.year == clean_year,
                        and_(
                            CreateSampleRequest.year == second_yr,
                            CreateSampleRequest.date_request_created >= range_start,
                            CreateSampleRequest.date_request_created < range_end,
                        ),
                    ))
                else:
                    query = query.filter(CreateSampleRequest.year == clean_year)
            else:
                query = query.filter(CreateSampleRequest.year == clean_year)

        if customer and customer.strip():
            query = query.filter(CreateSampleRequest.customer.ilike(f"%{customer.strip()}%"))

        if status and status.strip():
            query = query.filter(CreateSampleRequest.status == status.strip())

        if draft_only:
            normalized_status = func.lower(func.coalesce(CreateSampleRequest.status, ""))
            query = query.filter(or_(
                normalized_status.like("%draft%"),
                normalized_status.like("%smt%"),
            ))

        if created_by and created_by.strip():
            query = query.filter(CreateSampleRequest.created_by.ilike(f"%{created_by.strip()}%"))
        if created_by_user_id is not None:
            query = query.filter(CreateSampleRequest.created_by_user_id == created_by_user_id)
        if request_type and request_type.strip():
            query = query.filter(CreateSampleRequest.request_types.contains([request_type.strip().lower()]))

        query = query.order_by(CreateSampleRequest.id.desc())

        if skip > 0:
            query = query.offset(skip)
        if limit is not None:
            query = query.limit(limit)

        return query.all()

    def get_list_detail_summaries(self, sample_request_ids: List[int]) -> Dict[int, Dict[str, Optional[str]]]:
        """Load only the small set of detail fields used by request-list cards."""
        if not sample_request_ids:
            return {}

        normalized_name = func.regexp_replace(
            func.upper(func.coalesce(ProductDetail.characteristic_name, "")),
            "[^A-Z0-9]+",
            "",
            "g",
        )
        names = (
            "BINDINGTYPE1", "BINDING1", "BINDINGTYPE2", "BINDING2",
            "TREND", "THEME", "DESIGNTREND", "DESIGNTHEME",
            "TARGETAUDIENCE", "AUDIENCE", "DESIGNREMARKS",
        )
        rows = (
            self.db.query(
                ProductDetail.sample_request_id,
                ProductDetail.class_name,
                ProductDetail.characteristic_name,
                ProductDetail.value,
            )
            .filter(ProductDetail.sample_request_id.in_(sample_request_ids))
            .filter(normalized_name.in_(names))
            .order_by(ProductDetail.id)
            .all()
        )
        summaries: Dict[int, Dict[str, Optional[str]]] = {}
        for request_id, class_name, characteristic_name, value in rows:
            clean_value = str(value).strip() if value is not None else ""
            if not clean_value:
                continue
            summary = summaries.setdefault(request_id, {})
            name = re.sub(r"[^A-Z0-9]+", "", str(characteristic_name or "").upper())
            class_key = re.sub(r"[^A-Z0-9]+", "", str(class_name or "").upper())
            if class_key == "NBBINDING" and name in {"BINDINGTYPE1", "BINDING1"}:
                summary.setdefault("binding_type_1", clean_value)
            elif class_key == "NBBINDING" and name in {"BINDINGTYPE2", "BINDING2"}:
                summary.setdefault("binding_type_2", clean_value)
            elif name in {"TREND", "THEME", "DESIGNTREND", "DESIGNTHEME"}:
                summary["trend"] = clean_value
            elif name in {"TARGETAUDIENCE", "AUDIENCE"}:
                summary["target_audience"] = clean_value
            elif name == "DESIGNREMARKS":
                summary["design_remarks"] = clean_value
        return summaries

    def get_business_year_counts(
        self,
        target_plants: Optional[List[str]] = None,
        created_by_user_id: Optional[int] = None,
    ) -> List[Tuple[Optional[str], int]]:
        """Return distinct years and aggregate counts from the database."""
        query = self.db.query(CreateSampleRequest.year, func.count(CreateSampleRequest.id))
        if target_plants is not None:
            query = query.filter(CreateSampleRequest.target_plant.in_(target_plants))
        if created_by_user_id is not None:
            query = query.filter(CreateSampleRequest.created_by_user_id == created_by_user_id)
        return query.group_by(CreateSampleRequest.year).all()

    def search_materials(self, code: Optional[str] = None, limit: int = 50) -> List[CreateSampleRequest]:
        """Search products by material code or description."""
        query = self.db.query(CreateSampleRequest).options(*self._eager_options())
        if code and code.strip():
            c = f"%{code.strip()}%"
            query = query.filter(
                or_(
                    CreateSampleRequest.material_code.ilike(c),
                    CreateSampleRequest.product_description.ilike(c),
                    CreateSampleRequest.customer.ilike(c),
                )
            )
        return query.order_by(CreateSampleRequest.id.desc()).limit(limit).all()

    def search_by_binding(
        self,
        binding1: Optional[str] = None,
        binding2: Optional[str] = None,
        category: Optional[str] = None,
        sub_category: Optional[str] = None,
        third_category: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Tuple[CreateSampleRequest, Optional[str], Optional[str]]]:
        """Find catalog products by taxonomy/binding without loading every product detail."""
        def normalized_sql(column):
            return func.regexp_replace(
                func.lower(func.coalesce(column, "")),
                "[^a-z0-9]+",
                "",
                "g",
            )

        def normalized_value(value: str) -> str:
            return re.sub(r"[^a-z0-9]+", "", str(value or "").casefold())

        def apply_taxonomy_filter(query, column, value: Optional[str]):
            if not value or not value.strip():
                return query
            if value == MISSING_TAXONOMY_FILTER:
                return query.filter(or_(column.is_(None), func.trim(func.coalesce(column, "")) == ""))
            return query.filter(normalized_sql(column) == normalized_value(value))

        binding1_detail = aliased(ProductDetail)
        binding2_detail = aliased(ProductDetail)
        binding1_name = normalized_sql(binding1_detail.characteristic_name)
        binding2_name = normalized_sql(binding2_detail.characteristic_name)
        binding1_join = and_(
            binding1_detail.sample_request_id == CreateSampleRequest.id,
            normalized_sql(binding1_detail.class_name) == "nbbinding",
            binding1_name.in_(("bindingtype1", "binding1")),
        )
        binding2_join = and_(
            binding2_detail.sample_request_id == CreateSampleRequest.id,
            normalized_sql(binding2_detail.class_name) == "nbbinding",
            binding2_name.in_(("bindingtype2", "binding2")),
        )
        query = (
            self.db.query(CreateSampleRequest, binding1_detail.value, binding2_detail.value)
            .outerjoin(binding1_detail, binding1_join)
            .outerjoin(binding2_detail, binding2_join)
        )

        # Taxonomy filters
        for column, value in (
            (CreateSampleRequest.product_category, category),
            (CreateSampleRequest.product_sub_category, sub_category),
            (CreateSampleRequest.product_third_category, third_category),
        ):
            query = apply_taxonomy_filter(query, column, value)

        # Binding 1 filter
        if binding1 and binding1.strip():
            normalized_binding1 = normalized_value(binding1)
            query = query.filter(normalized_sql(binding1_detail.value) == normalized_binding1)

        # Binding 2 filter
        if binding2 and binding2.strip():
            normalized_binding2 = normalized_value(binding2)
            query = query.filter(normalized_sql(binding2_detail.value) == normalized_binding2)

        # If no filter at all provided, return empty list
        if not (
            (binding1 and binding1.strip())
            or (binding2 and binding2.strip())
            or (category and category.strip())
            or (sub_category and sub_category.strip())
            or (third_category and third_category.strip())
        ):
            return []

        query = query.distinct().order_by(CreateSampleRequest.id.desc())
        if limit is not None and limit > 0:
            query = query.limit(limit)
        return query.all()

    def catalog_filter_counts(
        self,
        *,
        category: Optional[str] = None,
        sub_category: Optional[str] = None,
        third_category: Optional[str] = None,
        binding1: Optional[str] = None,
        created_by_user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Return product counts for each next category and binding filter."""
        def normalized_sql(column):
            return func.regexp_replace(
                func.lower(func.coalesce(column, literal_column("''"))),
                literal_column("'[^a-z0-9]+'"),
                literal_column("''"),
                literal_column("'g'"),
            )

        def normalized_value(value: str) -> str:
            return re.sub(r"[^a-z0-9]+", "", str(value or "").casefold())

        def apply_taxonomy_filter(query, column, value: Optional[str]):
            if not value or not value.strip():
                return query
            if value == MISSING_TAXONOMY_FILTER:
                return query.filter(or_(column.is_(None), func.trim(func.coalesce(column, "")) == ""))
            return query.filter(normalized_sql(column) == normalized_value(value))

        def binding_join(alias, names):
            return and_(
                alias.sample_request_id == CreateSampleRequest.id,
                normalized_sql(alias.class_name) == "nbbinding",
                normalized_sql(alias.characteristic_name).in_(names),
            )

        def grouped_counts(
            *,
            category_filter: Optional[str] = None,
            sub_category_filter: Optional[str] = None,
            third_category_filter: Optional[str] = None,
            binding1_filter: Optional[str] = None,
            binding_facet: Optional[str] = None,
        ) -> Dict[str, int]:
            binding1_detail = aliased(ProductDetail) if binding1_filter or binding_facet else None
            binding2_detail = aliased(ProductDetail) if binding_facet == "binding2" else None
            if binding_facet == "binding1":
                facet_column = binding1_detail.value
            elif binding_facet == "binding2":
                facet_column = binding2_detail.value
            elif binding_facet:
                raise ValueError("Unsupported binding facet")
            else:
                facet_column = None

            query = self.db.query(
                normalized_sql(facet_column) if facet_column is not None else None,
                func.count(func.distinct(CreateSampleRequest.id)),
            ).select_from(CreateSampleRequest)
            if binding1_detail is not None:
                query = query.outerjoin(
                    binding1_detail,
                    binding_join(binding1_detail, ("bindingtype1", "binding1")),
                )
            if binding2_detail is not None:
                query = query.outerjoin(
                    binding2_detail,
                    binding_join(binding2_detail, ("bindingtype2", "binding2")),
                )
            if created_by_user_id is not None:
                query = query.filter(CreateSampleRequest.created_by_user_id == created_by_user_id)
            for column, value in (
                (CreateSampleRequest.product_category, category_filter),
                (CreateSampleRequest.product_sub_category, sub_category_filter),
                (CreateSampleRequest.product_third_category, third_category_filter),
            ):
                query = apply_taxonomy_filter(query, column, value)
            if binding1_filter and binding1_detail is not None:
                query = query.filter(normalized_sql(binding1_detail.value) == normalized_value(binding1_filter))
            if facet_column is not None:
                query = query.filter(facet_column.isnot(None)).filter(func.trim(facet_column) != "")
                query = query.group_by(normalized_sql(facet_column))
                rows = query.all()
                return {str(value): int(count) for value, count in rows if value}

            return {}

        def taxonomy_counts(column, category_filter=None, sub_category_filter=None):
            query = self.db.query(
                normalized_sql(column),
                func.count(func.distinct(CreateSampleRequest.id)),
            ).filter(column.isnot(None)).filter(func.trim(column) != "")
            if created_by_user_id is not None:
                query = query.filter(CreateSampleRequest.created_by_user_id == created_by_user_id)
            query = apply_taxonomy_filter(query, CreateSampleRequest.product_category, category_filter)
            query = apply_taxonomy_filter(query, CreateSampleRequest.product_sub_category, sub_category_filter)
            query = query.group_by(normalized_sql(column))
            return {str(value): int(count) for value, count in query.all() if value}

        def taxonomy_missing_count(column, category_filter=None, sub_category_filter=None):
            query = self.db.query(func.count(func.distinct(CreateSampleRequest.id)))
            if created_by_user_id is not None:
                query = query.filter(CreateSampleRequest.created_by_user_id == created_by_user_id)
            query = apply_taxonomy_filter(query, CreateSampleRequest.product_category, category_filter)
            query = apply_taxonomy_filter(query, CreateSampleRequest.product_sub_category, sub_category_filter)
            query = query.filter(or_(column.is_(None), func.trim(func.coalesce(column, "")) == ""))
            return int(query.scalar() or 0)

        return {
            "categories": taxonomy_counts(CreateSampleRequest.product_category),
            "sub_categories": taxonomy_counts(CreateSampleRequest.product_sub_category, category_filter=category),
            "sub_categories_missing": taxonomy_missing_count(
                CreateSampleRequest.product_sub_category,
                category_filter=category,
            ),
            "third_categories": taxonomy_counts(
                CreateSampleRequest.product_third_category,
                category_filter=category,
                sub_category_filter=sub_category,
            ),
            "third_categories_missing": taxonomy_missing_count(
                CreateSampleRequest.product_third_category,
                category_filter=category,
                sub_category_filter=sub_category,
            ),
            "binding1": grouped_counts(
                category_filter=category,
                sub_category_filter=sub_category,
                third_category_filter=third_category,
                binding_facet="binding1",
            ),
            "binding2": grouped_counts(
                category_filter=category,
                sub_category_filter=sub_category,
                third_category_filter=third_category,
                binding1_filter=binding1,
                binding_facet="binding2",
            ),
        }

    def batch_update_status(self, ids: List[int], status: str) -> int:
        """Batch update status on multiple requests in a single transaction."""
        updated = (
            self.db.query(CreateSampleRequest)
            .filter(CreateSampleRequest.id.in_(ids))
            .update({CreateSampleRequest.status: status}, synchronize_session=False)
        )
        self.db.commit()
        return updated

    def total_count(self) -> int:
        """Return total count of sample requests."""
        return self.db.query(CreateSampleRequest).count()

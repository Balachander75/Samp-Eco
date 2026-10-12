"""Safely copy legacy product characteristics into the active SAMP database.

The active database has sample requests but no product_details rows. This
migration maps legacy catalog rows by unique material_code and verifies the
customer and description before inserting anything. It is a dry run unless
--apply is supplied, and it never updates or deletes active records.
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Iterable

from sqlalchemy import create_engine, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.config import settings  # noqa: E402
from app.models.sample_request import CreateSampleRequest, ProductDetail  # noqa: E402


def norm(value: str | None) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).casefold()


def material_key(value: str | None) -> str:
    return re.sub(r"\s+", "", str(value or "")).casefold()


def batches(values: list[dict], size: int = 5000) -> Iterable[list[dict]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-database", default="samp_eco_db")
    parser.add_argument("--apply", action="store_true", help="Insert validated missing catalog details")
    args = parser.parse_args()

    destination_url = make_url(settings.DATABASE_URL)
    if not destination_url.database:
        raise SystemExit("Destination DATABASE_URL must name a database.")
    if destination_url.database.casefold() == args.source_database.casefold():
        raise SystemExit("Source and destination databases must be different.")
    source_url = destination_url.set(database=args.source_database)
    source_engine = create_engine(source_url, pool_pre_ping=True, connect_args={"connect_timeout": 5})
    destination_engine = create_engine(destination_url, pool_pre_ping=True, connect_args={"connect_timeout": 5})

    try:
        with Session(source_engine) as source, Session(destination_engine) as destination:
            source_requests = source.execute(
                select(
                    CreateSampleRequest.id,
                    CreateSampleRequest.material_code,
                    CreateSampleRequest.customer,
                    CreateSampleRequest.product_description,
                )
            ).all()
            destination_requests = destination.execute(
                select(
                    CreateSampleRequest.id,
                    CreateSampleRequest.material_code,
                    CreateSampleRequest.customer,
                    CreateSampleRequest.product_description,
                )
            ).all()

            def index_requests(rows, label: str):
                indexed = {}
                duplicates = set()
                for row in rows:
                    key = material_key(row.material_code)
                    if not key:
                        continue
                    if key in indexed:
                        duplicates.add(key)
                    else:
                        indexed[key] = row
                if duplicates:
                    raise SystemExit(f"{label} has {len(duplicates)} duplicate material-code keys; refusing ambiguous mapping.")
                return indexed

            source_by_material = index_requests(source_requests, "Source catalog")
            destination_by_material = index_requests(destination_requests, "Active database")
            mapped = {}
            metadata_mismatches = []
            for key, source_request in source_by_material.items():
                destination_request = destination_by_material.get(key)
                if destination_request is None:
                    continue
                if (
                    norm(source_request.customer) != norm(destination_request.customer)
                    or norm(source_request.product_description) != norm(destination_request.product_description)
                ):
                    metadata_mismatches.append(key)
                    continue
                mapped[source_request.id] = destination_request.id

            if metadata_mismatches:
                raise SystemExit(
                    f"{len(metadata_mismatches)} overlapping products have mismatched customer/description; refusing to copy."
                )
            if not mapped:
                raise SystemExit("No validated material-code matches found; nothing copied.")

            source_details = source.execute(
                select(
                    ProductDetail.sample_request_id,
                    ProductDetail.class_name,
                    ProductDetail.characteristic_name,
                    ProductDetail.value,
                    ProductDetail.uom,
                    ProductDetail.created_at,
                    ProductDetail.updated_at,
                )
                .where(ProductDetail.sample_request_id.in_(list(mapped)))
                .order_by(ProductDetail.id)
            ).all()

            target_ids = set(mapped.values())
            existing_details = destination.execute(
                select(
                    ProductDetail.sample_request_id,
                    ProductDetail.class_name,
                    ProductDetail.characteristic_name,
                    ProductDetail.value,
                    ProductDetail.uom,
                ).where(ProductDetail.sample_request_id.in_(list(target_ids)))
            ).all()

            def detail_key(sample_id, class_name, characteristic_name):
                return (sample_id, norm(class_name), norm(characteristic_name))

            existing_by_key = defaultdict(list)
            for row in existing_details:
                existing_by_key[detail_key(row.sample_request_id, row.class_name, row.characteristic_name)].append(
                    (row.value, row.uom)
                )

            pending = []
            source_key_values = defaultdict(list)
            already_present = 0
            for row in source_details:
                target_id = mapped[row.sample_request_id]
                key = detail_key(target_id, row.class_name, row.characteristic_name)
                value_pair = (row.value, row.uom)
                source_key_values[key].append(value_pair)
                current_values = existing_by_key.get(key, [])
                if value_pair in current_values:
                    already_present += 1
                    current_values.remove(value_pair)
                    continue
                if current_values:
                    raise SystemExit(
                        "Existing active catalog data conflicts with a source product characteristic; refusing to overwrite or duplicate it."
                    )
                pending.append(
                    {
                        "sample_request_id": target_id,
                        "class_name": row.class_name,
                        "characteristic_name": row.characteristic_name,
                        "value": row.value,
                        "uom": row.uom,
                        "created_at": row.created_at,
                        "updated_at": row.updated_at,
                    }
                )

            repeated_source_keys = sum(1 for values in source_key_values.values() if len(values) > 1)
            if repeated_source_keys:
                raise SystemExit(
                    f"Source has {repeated_source_keys} duplicate product-characteristic keys; refusing an ambiguous import."
                )

            unmatched_source = len(source_by_material) - len(mapped)
            unmatched_destination = len(destination_by_material) - len(mapped)
            print(f"Source products: {len(source_by_material)}")
            print(f"Active products: {len(destination_by_material)}")
            print(f"Validated one-to-one product matches: {len(mapped)}")
            print(f"Source products without an active match: {unmatched_source}")
            print(f"Active products preserved without a source match: {unmatched_destination}")
            print(f"Source characteristic rows mapped: {len(source_details)}")
            print(f"Already-present identical rows: {already_present}")
            print(f"Rows ready to insert: {len(pending)}")

            if not args.apply:
                print("Dry run only. Re-run with --apply to insert the missing catalog rows.")
                return 0

            # End the read-only transaction opened by the preflight SELECTs.
            destination.rollback()
            with destination.begin():
                for batch in batches(pending):
                    destination.bulk_insert_mappings(ProductDetail, batch)
            print(f"Inserted {len(pending)} product characteristic rows into {destination_url.database}.")
            return 0
    finally:
        source_engine.dispose()
        destination_engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())

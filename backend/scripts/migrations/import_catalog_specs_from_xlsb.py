"""Import saved product specifications from the supplied catalog workbook.

The workbook's Material column maps to create_sample_requests.material_code.
The script is a dry run by default; pass --apply to add missing product details.
Existing configured values are preserved.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pyxlsb import open_workbook

from app.database import SessionLocal
from app.models.sample_request import CreateSampleRequest, ProductCharacteristic, ProductDetail


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_WORKBOOK = REPOSITORY_ROOT / "db" / "SMT ALL DATA DT 02.09.26.xlsb"
EMPTY_VALUE_TOKENS = {"", "na", "nan", "null", "none"}
BATCH_SIZE = 5000


def material_key(value: Any) -> str:
    """Normalize Excel's numeric 123.0 cells to the saved material code 123."""
    if value is None:
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if float(value).is_integer():
            return str(int(value))
    text = str(value).strip()
    if text.endswith(".0") and text[:-2].isdigit():
        return text[:-2]
    return text


def specification_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        text = str(int(value)) if float(value).is_integer() else format(value, ".15g")
    else:
        text = str(value).strip()
    token = "".join(character for character in text.casefold() if character.isalnum())
    if token in EMPTY_VALUE_TOKENS:
        return None
    return text or None


def header_rows(sheet) -> tuple[dict[int, Any], dict[int, Any], dict[int, Any]]:
    rows = []
    iterator = sheet.rows(sparse=True)
    for _ in range(3):
        row = next(iterator, None)
        if row is None:
            raise ValueError("Workbook sheet does not contain its three specification header rows.")
        rows.append({cell.c: cell.v for cell in row if cell.v is not None})
    return rows[0], rows[1], rows[2]


def build_spec_columns(sheet, characteristics: dict[tuple[str, str], ProductCharacteristic]):
    names, classes, characteristic_names = header_rows(sheet)
    columns = []
    for column in names:
        if column == 0:  # Material identifier
            continue
        class_name = str(classes.get(column) or "").strip()
        characteristic_name = str(characteristic_names.get(column) or "").strip()
        definition = characteristics.get((class_name.casefold(), characteristic_name.casefold()))
        if not class_name or not characteristic_name or definition is None:
            raise ValueError(f"Workbook specification column {column + 1} has no active master definition.")
        columns.append((column, definition))
    return columns


def import_catalog_specs(workbook_path: Path, apply_changes: bool) -> dict[str, int]:
    if not workbook_path.is_file():
        raise FileNotFoundError(f"Catalog workbook not found: {workbook_path}")

    session = SessionLocal()
    try:
        request_rows = session.query(CreateSampleRequest.id, CreateSampleRequest.material_code).all()
        request_by_material: dict[str, list[int]] = {}
        for request_id, code in request_rows:
            key = material_key(code)
            if not key:
                continue
            request_by_material.setdefault(key, []).append(request_id)

        active_characteristics = (
            session.query(ProductCharacteristic)
            .filter(ProductCharacteristic.is_active.is_(True))
            .all()
        )
        characteristics = {
            (item.class_name.casefold(), item.characteristic_name.casefold()): item
            for item in active_characteristics
        }
        request_ids = [request_id for ids in request_by_material.values() for request_id in ids]
        existing_details = (
            session.query(ProductDetail)
            .filter(ProductDetail.sample_request_id.in_(request_ids))
            .all()
            if request_ids
            else []
        )
        existing_by_key = {
            (item.sample_request_id, item.class_name.casefold(), item.characteristic_name.casefold()): item
            for item in existing_details
        }

        workbook_materials: set[str] = set()
        matched_materials: set[str] = set()
        inserted = 0
        updated_blank = 0
        populated_binding1 = 0
        populated_binding2 = 0
        batch: list[dict[str, Any]] = []
        now = datetime.now(timezone.utc)

        with open_workbook(str(workbook_path)) as workbook:
            if "Sheet1" not in workbook.sheets:
                raise ValueError("Catalog workbook is missing the Sheet1 product specification sheet.")
            with workbook.get_sheet("Sheet1") as sheet:
                spec_columns = build_spec_columns(sheet, characteristics)
                rows = sheet.rows(sparse=True)
                for _ in range(3):
                    next(rows, None)

                for row in rows:
                    cells = {cell.c: cell.v for cell in row if cell.v is not None}
                    key = material_key(cells.get(0))
                    if not key:
                        continue
                    if key in workbook_materials:
                        raise ValueError("Catalog workbook contains duplicate material codes; refusing an ambiguous import.")
                    workbook_materials.add(key)
                    request_ids_for_material = request_by_material.get(key)
                    if not request_ids_for_material:
                        continue
                    matched_materials.add(key)

                    for request_id in request_ids_for_material:
                        for column, definition in spec_columns:
                            value = specification_value(cells.get(column))
                            if value is None:
                                continue
                            detail_key = (
                                request_id,
                                definition.class_name.casefold(),
                                definition.characteristic_name.casefold(),
                            )
                            if detail_key in existing_by_key:
                                existing = existing_by_key[detail_key]
                                if existing is None:
                                    continue
                                if specification_value(existing.value) is not None:
                                    continue
                                if apply_changes:
                                    existing.value = value
                                    if not existing.uom and definition.uom:
                                        existing.uom = definition.uom
                                updated_blank += 1
                                continue

                            if definition.class_name.casefold() == "nb_binding":
                                char_name = "".join(ch for ch in definition.characteristic_name.casefold() if ch.isalnum())
                                if char_name in {"bindingtype1", "binding1"}:
                                    populated_binding1 += 1
                                elif char_name in {"bindingtype2", "binding2"}:
                                    populated_binding2 += 1

                            if apply_changes:
                                batch.append({
                                    "sample_request_id": request_id,
                                    "class_name": definition.class_name,
                                    "characteristic_name": definition.characteristic_name,
                                    "value": value,
                                    "uom": definition.uom,
                                    "created_at": now,
                                    "updated_at": now,
                                })
                                existing_by_key[detail_key] = None
                                if len(batch) >= BATCH_SIZE:
                                    session.bulk_insert_mappings(ProductDetail, batch)
                                    inserted += len(batch)
                                    batch.clear()
                            else:
                                inserted += 1

                missing_materials = set(request_by_material) - matched_materials
                if missing_materials:
                    raise ValueError(
                        f"Workbook is missing {len(missing_materials)} request material codes; refusing a partial import."
                    )

                if apply_changes:
                    if batch:
                        session.bulk_insert_mappings(ProductDetail, batch)
                        inserted += len(batch)
                    session.commit()
                else:
                    session.rollback()

        return {
            "request_materials": len(request_by_material),
            "request_records": len(request_rows),
            "matched_materials": len(matched_materials),
            "workbook_materials": len(workbook_materials),
            "inserted": inserted,
            "updated_blank": updated_blank,
            "binding_type_1": populated_binding1,
            "binding_type_2": populated_binding2,
        }
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import real catalog specifications into product_details.")
    parser.add_argument("--workbook", type=Path, default=DEFAULT_WORKBOOK)
    parser.add_argument("--apply", action="store_true", help="Commit the import. Without this flag, only preview it.")
    args = parser.parse_args()

    result = import_catalog_specs(args.workbook, args.apply)
    mode = "Applied" if args.apply else "Dry run"
    print(
        f"{mode}: matched {result['matched_materials']}/{result['request_materials']} unique materials "
        f"across {result['request_records']} request records "
        f"against {result['workbook_materials']} workbook products; "
        f"{result['inserted']} specification values to insert, {result['updated_blank']} blank values to fill."
    )
    print(
        f"Binding rows to insert: BINDINGTYPE1={result['binding_type_1']}, "
        f"BINDINGTYPE2={result['binding_type_2']}."
    )
    if not args.apply:
        print("Re-run with --apply to commit these real catalog values.")


if __name__ == "__main__":
    main()

"""Create the design request table and migrate its JSON backup into PostgreSQL."""

from app.database import (
    Base,
    SessionLocal,
    engine,
    ensure_design_requests_table,
    ensure_design_workflow_columns,
    ensure_user_team_columns,
)
from app.models import master, sample_request  # noqa: F401 - register metadata models
from app.repositories.design_request_repo import DesignRequestRepository, _read_records


def main() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_design_requests_table()
    ensure_user_team_columns()
    ensure_design_workflow_columns()
    with SessionLocal() as db:
        repository = DesignRequestRepository(db)
        imported = repository.import_json_backup_records()
        from app.models.sample_request import DesignRequest
        record_count = db.query(DesignRequest).count()
        backup_records = _read_records()
        backed_up_in_database = sum(
            1
            for item in backup_records
            if item.get("sr_number")
            and db.query(DesignRequest.id).filter(DesignRequest.sr_number == item["sr_number"]).first()
        )
    print(
        f"Design request table ready. Imported {imported} JSON backup record(s); "
        f"PostgreSQL contains {record_count} design request(s), and "
        f"{backed_up_in_database}/{len(backup_records)} JSON backup record(s) are present in PostgreSQL."
    )


if __name__ == "__main__":
    main()

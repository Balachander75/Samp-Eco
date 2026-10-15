"""Add the explicit request-created-by field to feasibility requests."""

from sqlalchemy import text

from app.database import Base, engine
from app.models.feasibility import FeasibilityRequest  # noqa: F401 - register model
from app.models.master import Customer, Plant  # noqa: F401 - register relationships


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE feasibility_requests "
                "ADD COLUMN IF NOT EXISTS request_created_by VARCHAR(255)"
            )
        )
        connection.execute(
            text(
                "UPDATE feasibility_requests "
                "SET request_created_by = created_by "
                "WHERE request_created_by IS NULL"
            )
        )
    print("Ensured feasibility_requests.request_created_by exists.")


if __name__ == "__main__":
    main()

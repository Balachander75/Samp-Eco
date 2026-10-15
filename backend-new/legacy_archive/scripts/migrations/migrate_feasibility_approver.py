"""Add the SAMP approver audit field to feasibility requests."""

from sqlalchemy import text

from app.database import engine


def main() -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE feasibility_requests "
                "ADD COLUMN IF NOT EXISTS sampling_feasibility_approved_by VARCHAR(255)"
            )
        )
    print("Added sampling_feasibility_approved_by to feasibility_requests.")


if __name__ == "__main__":
    main()

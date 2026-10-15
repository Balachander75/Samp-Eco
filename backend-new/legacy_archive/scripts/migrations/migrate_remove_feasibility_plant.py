"""Remove plant routing from the feasibility workflow."""

from sqlalchemy import text

from app.database import engine
from app.models import FeasibilityRequest  # noqa: F401 - register the model


def main() -> None:
    # PostgreSQL drops the target-plant foreign-key constraint with the column.
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE feasibility_requests DROP COLUMN IF EXISTS target_plant_id"))
        connection.execute(text("ALTER TABLE feasibility_requests DROP COLUMN IF EXISTS plant_feasibility_response"))
        connection.execute(text("ALTER TABLE feasibility_requests DROP COLUMN IF EXISTS plant_feasibility_remark"))
    print("Removed plant routing and plant-review columns from feasibility_requests.")


if __name__ == "__main__":
    main()

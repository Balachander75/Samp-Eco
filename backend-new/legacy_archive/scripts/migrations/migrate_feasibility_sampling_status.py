"""Move feasibility requests into the direct SAMP review queue."""

from sqlalchemy import text

from app.database import engine


def main() -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE feasibility_requests "
                "ALTER COLUMN status SET DEFAULT 'Pending Feasibility'"
            )
        )
        result = connection.execute(
            text(
                "UPDATE feasibility_requests "
                "SET status = 'Pending Feasibility' "
                "WHERE status = 'Draft (Pre-SMT)'"
            )
        )
    print(f"Moved {result.rowcount} feasibility request(s) to the SAMP queue.")


if __name__ == "__main__":
    main()

"""Create the persistent downstream operational tables before deploying the API."""

from app.database import ensure_downstream_schema


if __name__ == "__main__":
    ensure_downstream_schema()
    print("Downstream Creative, Studio, and Costing schema is ready.")

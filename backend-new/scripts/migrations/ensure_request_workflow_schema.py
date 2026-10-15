"""Create and backfill dedicated Costing and Mockup workflow tables."""

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(backend_dir))

from app.database import ensure_request_workflow_schema


if __name__ == "__main__":
    ensure_request_workflow_schema()
    print("Costing and Mockup workflow schemas are ready.")

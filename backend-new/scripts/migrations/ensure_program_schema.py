"""Apply the additive Program Planning schema changes before deploying API workers."""

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(backend_dir))

from app.database import ensure_program_schema


if __name__ == "__main__":
    ensure_program_schema()
    print("Program Planning schema is ready.")

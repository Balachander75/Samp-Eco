"""Migration script to add SLA, marketing decision columns, and activity logs table."""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from app.database import engine, Base
from app.models.feasibility import FeasibilityRequest, FeasibilityActivityLog

def run_migration():
    print("[Migration] Verifying / creating new tables...")
    Base.metadata.create_all(bind=engine)
    
    print("[Migration] Adding new columns to feasibility_requests if not existing...")
    columns_sql = [
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS is_responded_on_time BOOLEAN;",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS marketing_decision VARCHAR(32);",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS marketing_decision_by VARCHAR(255);",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS marketing_decision_at TIMESTAMPTZ;",
        "ALTER TABLE feasibility_requests ADD COLUMN IF NOT EXISTS marketing_decision_remark TEXT;",
    ]
    
    with engine.connect() as conn:
        for stmt in columns_sql:
            conn.execute(text(stmt))
        conn.commit()
    
    print("[Migration] [OK] Schema successfully updated!")

if __name__ == "__main__":
    run_migration()

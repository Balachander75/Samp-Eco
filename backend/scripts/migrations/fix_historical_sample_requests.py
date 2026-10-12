"""Ensure all historical FY25-26 and existing requests in create_sample_requests have request_types = ["sample"]."""
from sqlalchemy import text
from app.database import SessionLocal

def main():
    with SessionLocal() as db:
        query = text("""
            UPDATE create_sample_requests
            SET request_types = '["sample"]'::jsonb
            WHERE request_types IS NULL
               OR request_types = '{}'::jsonb
               OR request_types = '[]'::jsonb
               OR jsonb_typeof(request_types) != 'array'
               OR jsonb_array_length(CASE WHEN jsonb_typeof(request_types) = 'array' THEN request_types ELSE '[]'::jsonb END) = 0;
        """)
        res = db.execute(query)
        db.commit()
        print(f"Updated {res.rowcount} records to request_types = ['sample']")

        distinct_types = db.execute(text("SELECT DISTINCT request_types FROM create_sample_requests;")).fetchall()
        print("Distinct request_types in create_sample_requests:", distinct_types)

if __name__ == "__main__":
    main()

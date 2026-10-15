import psycopg2
import psycopg2.extras

def sync_data():
    conn_eco = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/samp_eco_db")
    conn_curr = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/navneet_samp")
    
    cur_eco = conn_eco.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur_curr = conn_curr.cursor()

    # Get column names of create_sample_requests
    cur_eco.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'create_sample_requests' 
        ORDER BY ordinal_position
    """)
    cols = [r[0] for r in cur_eco.fetchall()]
    print(f"Found {len(cols)} columns in create_sample_requests")

    # Fetch all records from samp_eco_db
    cur_eco.execute("SELECT * FROM create_sample_requests ORDER BY id ASC")
    eco_records = cur_eco.fetchall()
    print(f"Fetched {len(eco_records)} records from samp_eco_db")

    # Clear old synced records in navneet_samp (id <= 2687)
    cur_curr.execute("DELETE FROM create_sample_requests WHERE id <= 2687")
    print(f"Cleared old synced rows in navneet_samp")

    # Prepare insert query
    cols_str = ", ".join([f'"{c}"' for c in cols])
    placeholders = ", ".join(["%s"] * len(cols))
    insert_sql = f"INSERT INTO create_sample_requests ({cols_str}) VALUES ({placeholders})"

    # Insert all rows directly from samp_eco_db
    rows_to_insert = [[r[c] for c in cols] for r in eco_records]
    psycopg2.extras.execute_batch(cur_curr, insert_sql, rows_to_insert, page_size=500)
    conn_curr.commit()
    print(f"Successfully inserted {len(rows_to_insert)} records into navneet_samp!")

    # Verify counts
    cur_curr.execute("SELECT COUNT(*), COUNT(date_request_created), COUNT(sample_required_date) FROM create_sample_requests WHERE id <= 2687")
    res = cur_curr.fetchone()
    print(f"navneet_samp verification (total, has_date_created, has_sample_required_date): {res}")

    # Show first 5 and last 5 date_request_created
    cur_curr.execute("SELECT id, sr_number, date_request_created, sample_required_date, year, program_year FROM create_sample_requests ORDER BY id ASC LIMIT 5")
    print("\nFirst 5 records:")
    for row in cur_curr.fetchall():
        print("  ", row)

    cur_curr.execute("SELECT id, sr_number, date_request_created, sample_required_date, year, program_year FROM create_sample_requests ORDER BY id DESC LIMIT 5")
    print("\nLast 5 records:")
    for row in cur_curr.fetchall():
        print("  ", row)

    cur_eco.close()
    cur_curr.close()
    conn_eco.close()
    conn_curr.close()

if __name__ == "__main__":
    sync_data()

import psycopg2

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/navneet_samp")
cur = conn.cursor()

# Fix 11 rows with '1508' target_plant -> '1505- Khaniwade'
cur.execute("""
    SELECT id, sr_number, customer, target_plant 
    FROM create_sample_requests 
    WHERE target_plant = '1508';
""")
rows = cur.fetchall()
print(f"Rows with target_plant = '1508' ({len(rows)}):")
for r in rows:
    print(f"  id={r[0]}, sr={r[1]}, customer={r[2]!r}, plant={r[3]!r}")

# Fix them
cur.execute("""
    UPDATE create_sample_requests 
    SET target_plant = '1505- Khaniwade'
    WHERE target_plant = '1508';
""")
affected = cur.rowcount
conn.commit()
print(f"\nFixed {affected} rows: '1508' -> '1505- Khaniwade'")

# Verify no bad values remain
cur.execute("SELECT target_plant, count(*) FROM create_sample_requests GROUP BY target_plant ORDER BY count(*) DESC;")
print("\nFinal target_plant distribution:")
for r in cur.fetchall():
    print(f"  {r[0]!r}: {r[1]} rows")

cur.close()
conn.close()

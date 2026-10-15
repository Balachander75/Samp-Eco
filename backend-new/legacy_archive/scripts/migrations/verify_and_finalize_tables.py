import psycopg2

conn_src = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/samp_eco_db")
cur_src = conn_src.cursor()

conn_dst = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/navneet_samp")
cur_dst = conn_dst.cursor()

# 1. Fetch function definition from samp_eco_db
cur_src.execute("""
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column';
""")
fn_row = cur_src.fetchone()
if fn_row:
    fn_def = fn_row[0]
    print("Found update_updated_at_column in samp_eco_db, creating in navneet_samp...")
    cur_dst.execute(fn_def)
    conn_dst.commit()
    print("[OK] Created update_updated_at_column function.")

    # Apply triggers
    triggers = [
        ("update_create_sample_requests_updated_at", "create_sample_requests"),
        ("update_product_characteristics_updated_at", "product_characteristics"),
        ("update_product_details_updated_at", "product_details")
    ]
    for trg_name, tbl_name in triggers:
        cur_dst.execute(f"""
            DROP TRIGGER IF EXISTS {trg_name} ON {tbl_name};
            CREATE TRIGGER {trg_name}
            BEFORE UPDATE ON {tbl_name}
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
        """)
        print(f"[OK] Created trigger {trg_name} on {tbl_name}.")
    conn_dst.commit()

# 2. Verify row counts and integrity in navneet_samp
print("\n--- Verifying Row Counts in navneet_samp ---")
tables = ['create_sample_requests', 'product_characteristics', 'product_details']
for t in tables:
    cur_dst.execute(f'SELECT COUNT(*) FROM "{t}";')
    cnt = cur_dst.fetchone()[0]
    cur_src.execute(f'SELECT COUNT(*) FROM "{t}";')
    src_cnt = cur_src.fetchone()[0]
    match_status = "MATCH" if cnt == src_cnt else "MISMATCH"
    print(f"Table '{t}': navneet_samp = {cnt} rows | samp_eco_db = {src_cnt} rows [{match_status}]")

# 3. Verify Foreign Key constraint
cur_dst.execute("""
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'product_details'::regclass AND contype = 'f';
""")
fks = cur_dst.fetchall()
print("\nForeign keys on product_details in navneet_samp:")
for fk in fks:
    print(f"  - {fk[0]}: {fk[1]}")

cur_src.close()
conn_src.close()
cur_dst.close()
conn_dst.close()
print("\nAll verification checks completed.")

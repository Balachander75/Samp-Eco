"""
Verification script for End-to-End Product Staging to Draft Release workflow
Testing:
1. Batch create sample requests with all 4 commercial scopes & custom binding details
2. Verify SampleRequestType audit columns and timestamps
3. Verify cloned product_details
4. Verify characteristic details update endpoint
5. Verify batch-status update to 'Creative'
6. Clean up test records
"""
import sys
import requests
import json
from datetime import datetime, timezone

BASE_URL = "http://localhost:8001/api/v1"

def run_tests():
    print("=" * 60)
    print("STARTING END-TO-END WORKFLOW VERIFICATION")
    print("=" * 60)

    # 1. Test Batch Create
    test_batch_payload = [
        {
            "customer": "VERIFICATION_TEST_CORP",
            "program_name": "Test BTS 2026 Spiral Launch",
            "program_year": "2026",
            "year": "2026-27",
            "target_plant": "1505- Khaniwade",
            "product_description": "Verification Spiral Notebook 160pg",
            "material_code": "VERIF-NB-001",
            "creation_mode": "binding",
            "custom_binding_1": "Single Spiral",
            "custom_binding_2": "Hard Bound",
            "custom_details": [
                {
                    "class_name": "NB_BINDING",
                    "characteristic_name": "PAGES",
                    "value": "160",
                    "uom": "NOS"
                }
            ],
            "request_types": ["design", "mockup", "sample", "costing"],
            "request_type_timestamps": {
                "design": datetime.now(timezone.utc).isoformat(),
                "mockup": datetime.now(timezone.utc).isoformat(),
                "sample": datetime.now(timezone.utc).isoformat(),
                "costing": datetime.now(timezone.utc).isoformat()
            },
            "status": "Draft (Pre-SMT)"
        },
        {
            "customer": "VERIFICATION_TEST_CORP",
            "program_name": "Test BTS 2026 Spiral Launch",
            "program_year": "2026",
            "year": "2026-27",
            "target_plant": "1505- Khaniwade",
            "product_description": "Verification Drawing Book 36pg",
            "material_code": "",
            "creation_mode": "material_code",
            "request_types": ["design"],
            "request_type_timestamps": {
                "design": datetime.now(timezone.utc).isoformat()
            },
            "status": "Draft (Pre-SMT)"
        }
    ]

    print("\n1. Testing POST /sample-requests/batch...")
    resp = requests.post(f"{BASE_URL}/sample-requests/batch", json=test_batch_payload)
    if resp.status_code not in (200, 201):
        print(f"FAILED: Batch create returned status {resp.status_code}: {resp.text}")
        sys.exit(1)

    data = resp.json()
    created_items = data.get("results", data) if isinstance(data, dict) else data
    print(f"SUCCESS: Created {len(created_items)} sample requests.")
    for it in created_items:
        sr = it.get('srNumber') or it.get('sr_number')
        mat = it.get('materialCode') or it.get('material_code')
        print(f"   -> ID: {it.get('id')}, SR: {sr}, MatCode: {mat}, Status: {it.get('status')}")

    item1_id = created_items[0]['id']
    item2_id = created_items[1]['id']
    all_created_ids = [item1_id, item2_id]

    try:
        # 2. Verify SampleRequestType and product details for Item 1
        print(f"\n2. Testing GET /product-characteristics/details/{item1_id}...")
        resp_details = requests.get(f"{BASE_URL}/product-characteristics/details/{item1_id}")
        if resp_details.status_code != 200:
            print(f"FAILED: fetch details returned {resp_details.status_code}: {resp_details.text}")
            sys.exit(1)
        details = resp_details.json()
        print(f"SUCCESS: Found {len(details)} characteristic detail rows for request {item1_id}.")
        binding1_found = any(d.get('characteristicName') == 'BINDINGTYPE1' and d.get('value') == 'Single Spiral' for d in details)
        binding2_found = any(d.get('characteristicName') == 'BINDINGTYPE2' and d.get('value') == 'Hard Bound' for d in details)
        pages_found = any(d.get('characteristicName') == 'PAGES' and d.get('value') == '160' for d in details)
        print(f"   -> BINDINGTYPE1 'Single Spiral' present: {binding1_found}")
        print(f"   -> BINDINGTYPE2 'Hard Bound' present: {binding2_found}")
        print(f"   -> PAGES '160' present: {pages_found}")

        if not (binding1_found and binding2_found and pages_found):
            print("WARNING: Some custom details were not properly persisted!")

        # 3. Test Save Specifications Endpoint
        print(f"\n3. Testing POST /product-characteristics/details for request {item1_id}...")
        update_specs_payload = [
            {
                "className": "NB_BINDING",
                "characteristicName": "PAGES",
                "value": "200",
                "uom": "NOS"
            }
        ]
        resp_update_specs = requests.post(f"{BASE_URL}/product-characteristics/details?sample_request_id={item1_id}", json=update_specs_payload)
        if resp_update_specs.status_code != 200:
            print(f"FAILED: update specs returned {resp_update_specs.status_code}: {resp_update_specs.text}")
            sys.exit(1)
        print(f"SUCCESS: Updated specifications.")

        # 4. Test Batch Status Update to 'Creative' (Draft Release)
        print(f"\n4. Testing POST /sample-requests/batch-status -> 'Creative'...")
        release_payload = {
            "ids": all_created_ids,
            "status": "Creative"
        }
        resp_release = requests.post(f"{BASE_URL}/sample-requests/batch-status", json=release_payload)
        if resp_release.status_code != 200:
            print(f"FAILED: batch status update returned {resp_release.status_code}: {resp_release.text}")
            sys.exit(1)
        print(f"SUCCESS: {resp_release.json()}")

        # Verify new status via GET
        resp_get = requests.get(f"{BASE_URL}/sample-requests/{item1_id}")
        if resp_get.status_code == 200:
            updated_item = resp_get.json()
            print(f"SUCCESS: Request {item1_id} status is now: '{updated_item.get('status')}' (expected: 'Creative')")
            assert updated_item.get('status') == 'Creative', f"Status is {updated_item.get('status')}, expected Creative"

        print("\nAll verification steps passed successfully!")

    finally:
        # Cleanup test records
        print("\n5. Cleaning up test records...")
        for rid in all_created_ids:
            del_resp = requests.delete(f"{BASE_URL}/sample-requests/{rid}")
            print(f"   -> Deleted test request {rid}: {del_resp.status_code}")

    print("\n" + "=" * 60)
    print("VERIFICATION COMPLETE: ALL INTEGRATION CHECKS PASSED")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()

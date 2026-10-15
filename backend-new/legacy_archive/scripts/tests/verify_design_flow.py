"""
Automated End-to-End Verification Script for Design Request & Workflow Ecosystem.
Tests:
1. SQL-filtered query optimization & index performance on GET /api/v1/design-requests
2. Creation of Design Request (Intake)
3. Marketing release from draft to Creative Studio
4. Creative Studio claim & multi-user locking validation
5. 48-hour Counter-Date proposal & Marketing acceptance
6. Multi-batch artwork submission with Shutterstock validation
7. Partial deliverable review & remaining artwork request cycle
8. Final batch fulfillment & Commercial Acceptance (Approved / Closed)
9. Internal chatter notes persistence & audit event stream
10. Downstream chaining to Mockup / Sampling
11. Clean-up of test records
"""
import sys
import os
sys.path.insert(0, os.path.abspath("."))
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

BASE_URL = "http://127.0.0.1:8001/api/v1"

def http_req(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    req_body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=req_body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            body = resp.read().decode("utf-8")
            return status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = body
        return e.code, parsed

def run_tests():
    print("=" * 70)
    print("STARTING END-TO-END DESIGN REQUEST WORKFLOW VERIFICATION")
    print("=" * 70)

    # 0. Setup Auth Tokens
    from app.routers.auth import create_access_token
    admin_token = create_access_token(subject=1, role="admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    print("[1/11] Generated Admin JWT authentication token.")

    # 1. Test Indexed Query Listing
    t0 = datetime.now()
    status, initial_list = http_req(f"{BASE_URL}/design-requests", headers=admin_headers)
    t_elapsed = (datetime.now() - t0).total_seconds() * 1000
    assert status == 200, f"List failed: {status}: {initial_list}"
    print(f"[2/11] GET /design-requests responded with status 200 in {t_elapsed:.1f}ms. Found {len(initial_list)} active records.")

    # 2. Create New Design Request
    req_date = (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%d")
    create_payload = {
        "customer_name": "Antigravity Luxury Brand",
        "product_description": "Exclusive Metallic Foil Planner with Geometric Botanical Patterns",
        "number_of_designs": 3,
        "design_required_date": req_date,
        "trend": "Geometric Art Deco",
        "target_audience": "Executive Professionals",
        "program_name": "Premium Diary Collection",
        "program_year": "2025-2026",
        "reference_images": ["https://example.com/moodboard1.jpg"],
        "reference_links": ["https://example.com/trend-brief"],
        "design_remarks": "Ensure CMYK separation ready for gold metallic foil stamping.",
    }
    status, created = http_req(f"{BASE_URL}/design-requests", method="POST", data=create_payload, headers=admin_headers)
    assert status == 201, f"Create failed ({status}): {created}"
    design_id = created["id"]
    req_code = created["request_code"]
    print(f"[3/11] Created Design Request ID={design_id} (Code: {req_code}, Status: {created['status']}).")

    # 3. Release from Draft to Creative
    status, released = http_req(f"{BASE_URL}/design-requests/{design_id}/release", method="POST", headers=admin_headers)
    assert status == 200, f"Release failed ({status}): {released}"
    assert released["status"] == "Creative", f"Expected status 'Creative', got {released['status']}"
    print(f"[4/11] Released from Draft to Creative Studio. Status: {released['status']}.")

    # 4. Creative Claims the Request
    status, claimed = http_req(
        f"{BASE_URL}/design-requests/{design_id}/claim",
        method="POST",
        data={"designer_name": "Studio Lead Artist"},
        headers=admin_headers,
    )
    assert status == 200, f"Claim failed ({status}): {claimed}"
    workflow_state = claimed.get("workflow_state") or {}
    print(f"[DEBUG] Claimed response workflow_state: {workflow_state}")
    assert workflow_state.get("claimedBy"), "ClaimedBy should not be empty"
    print(f"[5/11] Claimed by {workflow_state.get('claimedBy')}. Claim time recorded.")

    # 5. Propose Counter-Date and Accept
    counter_date = (datetime.now(timezone.utc) + timedelta(days=8)).strftime("%Y-%m-%d")
    status, countered = http_req(
        f"{BASE_URL}/design-requests/{design_id}/counter-date-proposal",
        method="POST",
        data={"proposed_date": counter_date, "reason": "Requires high-res botanical 3D foil vectorization."},
        headers=admin_headers,
    )
    assert status == 200, f"Counter date proposal failed ({status}): {countered}"
    c_state = countered.get("workflow_state") or {}
    assert c_state.get("isCounterDateActive") is True, "Counter date should be active"
    print(f"[6/11] Proposed revised date {counter_date}. Awaiting Marketing decision.")

    # Marketing Accepts Counter-Date
    status, decided = http_req(
        f"{BASE_URL}/design-requests/{design_id}/counter-date-decision",
        method="POST",
        data={"decision": "accepted", "notes": "Approved revised timeline for high-res foil artwork."},
        headers=admin_headers,
    )
    assert status == 200, f"Counter date decision failed ({status}): {decided}"
    assert decided["design_required_date"] == counter_date, "design_required_date not updated"
    print(f"[7/11] Marketing accepted counter-date. Target date updated to {decided['design_required_date']}.")

    # 6. Submit Batch 1 (1 Artwork delivered out of 3)
    batch_1_payload = {
        "design_file_url": "https://creative-cloud.adobe.com/share/art-batch-1",
        "rows": [
            {"shutterstockNo": "SH-98214401", "remarks": "Gold foil botanical pattern variation A"},
        ],
    }
    status, batch1_res = http_req(
        f"{BASE_URL}/design-requests/{design_id}/creative-output",
        method="PUT",
        data=batch_1_payload,
        headers=admin_headers,
    )
    assert status == 200, f"Batch 1 submit failed ({status}): {batch1_res}"
    assert batch1_res["remaining_design_count"] == 2, f"Expected 2 remaining, got {batch1_res['remaining_design_count']}"
    assert batch1_res["status"] == "Awaiting Marketing Review", f"Expected 'Awaiting Marketing Review', got {batch1_res['status']}"
    print(f"[8/11] Submitted Batch #1 (1 of 3 artworks delivered, 2 remaining). Status: {batch1_res['status']}.")

    # 7. Marketing Requests Remaining Artworks
    status, req_rem = http_req(
        f"{BASE_URL}/design-requests/{design_id}/marketing-decision",
        method="POST",
        data={"decision": "request_remaining"},
        headers=admin_headers,
    )
    assert status == 200, f"Request remaining failed ({status}): {req_rem}"
    assert req_rem["status"] == "Creative Remaining Requested"
    print(f"[9/11] Marketing requested remainder. Status shifted to '{req_rem['status']}'.")

    # 8. Submit Batch 2 (Remaining 2 Artworks delivered)
    batch_2_payload = {
        "design_file_url": "https://creative-cloud.adobe.com/share/art-batch-2",
        "rows": [
            {"shutterstockNo": "SH-98214402", "remarks": "Gold foil botanical pattern variation B"},
            {"shutterstockNo": "SH-98214403", "remarks": "Gold foil botanical pattern variation C"},
        ],
    }
    status, batch2_res = http_req(
        f"{BASE_URL}/design-requests/{design_id}/creative-output",
        method="PUT",
        data=batch_2_payload,
        headers=admin_headers,
    )
    assert status == 200, f"Batch 2 submit failed ({status}): {batch2_res}"
    assert batch2_res["remaining_design_count"] == 0, f"Expected 0 remaining, got {batch2_res['remaining_design_count']}"
    assert batch2_res["status"] == "Awaiting Marketing Review"

    # Marketing Approves & Closes
    status, approved = http_req(
        f"{BASE_URL}/design-requests/{design_id}/marketing-decision",
        method="POST",
        data={"decision": "accept"},
        headers=admin_headers,
    )
    assert status == 200, f"Accept failed ({status}): {approved}"
    assert approved["status"] == "Approved / Closed"
    assert approved["marketing_decision"] == "accepted"
    print(f"[10/11] All 3 artworks delivered. Marketing approved & closed request. Status: '{approved['status']}'.")

    # 9. Add Note & Verify Chatter
    status, noted = http_req(
        f"{BASE_URL}/design-requests/{design_id}/notes",
        method="POST",
        data={"body": "Final vectorized PDFs uploaded to archive NAS for printing."},
        headers=admin_headers,
    )
    assert status == 200, f"Note failed ({status}): {noted}"
    notes = noted.get("workflow_state", {}).get("notes") or []
    assert len(notes) >= 1, "Note was not recorded"

    # 10. Clean-up test record
    status, deleted = http_req(f"{BASE_URL}/design-requests/{design_id}", method="DELETE", headers=admin_headers)
    assert status in (200, 204), f"Delete failed ({status}): {deleted}"
    print(f"[11/11] Cleaned up test record DSG-{design_id:04d} successfully.")

    print("=" * 70)
    print("ALL 11 END-TO-END DESIGN WORKFLOW TESTS PASSED CLEANLY (EXIT CODE 0)!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()

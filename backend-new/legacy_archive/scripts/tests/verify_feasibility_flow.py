"""
Verification script for End-to-End Feasibility Flow using Python standard library urllib.
Testing:
1. Auth token generation & header setup
2. POST /api/v1/feasibility-requests (Create feasibility request with classification & constraints)
3. POST /api/v1/feasibility-requests/{id}/claim (SAMP Team claims task)
4. POST /api/v1/feasibility-requests/{id}/samp-verdict (Technical verdict: Yes/Feasible)
5. POST /api/v1/feasibility-requests/{id}/marketing-decision (Marketing sign-off: Accepted)
6. POST /api/v1/feasibility-requests/{id}/convert-to-sampling (Commercial conversion to SR-XXXX)
7. DELETE /api/v1/feasibility-requests/{id} (Clean up)
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
    print("=" * 65)
    print("STARTING END-TO-END FEASIBILITY WORKFLOW VERIFICATION")
    print("=" * 65)

    # 0. Generate Admin JWT Token
    from app.routers.auth import create_access_token
    token = create_access_token(subject=1, role="admin")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print("[OK] Created valid test JWT token for Admin.")

    # 1. Fetch initial list
    status, initial_list = http_req(f"{BASE_URL}/feasibility-requests", headers=headers)
    assert status == 200, f"List failed: {status}: {initial_list}"
    print(f"[OK] Initial Feasibility Requests count: {len(initial_list)}")

    # 2. Create New Feasibility Check Request
    target_date = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
    create_payload = {
        "customer": "Abundance Global - Fzco",
        "feasibility_type": "other",
        "custom_feasibility_type": "Gold Foil Embossed Line",  # 24 chars
        "description_notes": "Premium hardbound A5 diary with custom UV foil stamping and golden edges.",  # 73 chars
        "required_date": target_date,
        "marketing_remarks": "High-priority annual festival catalogue check for Dubai retail client.",  # 69 chars
        "reference_images": [],
        "reference_image_names": [],
        "reference_links": ["https://example.com/spec-sheet.pdf"],
    }

    print("\n1. Testing POST /feasibility-requests (Create)...")
    status, req_data = http_req(f"{BASE_URL}/feasibility-requests", method="POST", data=create_payload, headers=headers)
    if status not in (200, 201):
        print(f"FAILED: Create returned {status}: {req_data}")
        sys.exit(1)
    
    req_id = req_data["id"]
    req_code = req_data["request_code"]
    print(f"[OK] Created feasibility request: ID={req_id}, Code={req_code}, Status={req_data['status']}")
    assert req_data["customer"] == "Abundance Global - Fzco"
    assert req_data["custom_feasibility_type"] == "Gold Foil Embossed Line"

    try:
        # 3. SAMP Team Claims the Task
        print(f"\n2. Testing POST /feasibility-requests/{req_id}/claim (SAMP Team Claim)...")
        status, claimed_data = http_req(f"{BASE_URL}/feasibility-requests/{req_id}/claim", method="POST", headers=headers)
        assert status == 200, f"Claim failed: {status}: {claimed_data}"
        print(f"[OK] Task claimed successfully by: {claimed_data.get('taken_by_samp')}")
        assert claimed_data.get("taken_by_samp") is not None

        # 4. SAMP Team Submits Technical Verdict
        print(f"\n3. Testing PUT /feasibility-requests/{req_id}/samp-verdict (Technical Sign-off)...")
        verdict_payload = {
            "response": "Yes",
            "remark": "Foil stamping line 2 has necessary brass die fixture and capacity.",
            "conditions": "Minimum batch run 500 units for embossing tooling setup.",
            "lead_time_note": "3 days for brass die engraving."
        }
        status, verdict_data = http_req(f"{BASE_URL}/feasibility-requests/{req_id}/samp-verdict", method="PUT", data=verdict_payload, headers=headers)
        assert status == 200, f"Verdict failed: {status}: {verdict_data}"
        print(f"[OK] Technical verdict recorded: {verdict_data.get('sampling_feasibility_response')}")
        print(f"   Remark: {verdict_data.get('sampling_feasibility_remark')}")
        assert verdict_data.get("sampling_feasibility_response") == "Yes"

        # 5. Marketing Authority Takes Commercial Decision
        print(f"\n4. Testing POST /feasibility-requests/{req_id}/marketing-decision (Commercial Approval)...")
        decision_payload = {
            "decision": "Accepted",
            "decision_remark": "Client confirmed batch of 2500 units, commercial terms aligned."
        }
        status, dec_data = http_req(f"{BASE_URL}/feasibility-requests/{req_id}/marketing-decision", method="POST", data=decision_payload, headers=headers)
        assert status == 200, f"Decision failed: {status}: {dec_data}"
        print(f"[OK] Marketing decision recorded: {dec_data.get('marketing_decision')}")
        assert dec_data.get("marketing_decision") == "Accepted"
        assert dec_data.get("status") == "Marketing Accepted"

        # 6. Convert Feasibility to Commercial Sampling Request
        print(f"\n5. Testing POST /feasibility-requests/{req_id}/convert-to-sampling (Commercial Request Creation)...")
        convert_payload = {
            "request_types": ["sample", "costing"]
        }
        status, conv_result = http_req(f"{BASE_URL}/feasibility-requests/{req_id}/convert-to-sampling", method="POST", data=convert_payload, headers=headers)
        assert status == 200, f"Convert failed: {status}: {conv_result}"
        sr_num = conv_result.get("sample_sr_number")
        sr_id = conv_result.get("sample_request_id")
        print(f"[OK] Successfully converted to commercial request: SR Number={sr_num}, ID={sr_id}")
        assert sr_num is not None

        # Verify converted feasibility request status
        feas_data = conv_result.get("feasibility")
        print(f"[OK] Updated Feasibility status: {feas_data.get('status')}")
        assert feas_data.get("converted_sr_number") == sr_num

        # 7. Verify chatter note addition
        print(f"\n6. Testing POST /feasibility-requests/{req_id}/notes (Chatter feed)...")
        status, note_data = http_req(f"{BASE_URL}/feasibility-requests/{req_id}/notes", method="POST", data={"note": "Sample conversion completed, notified client desk."}, headers=headers)
        assert status == 200, f"Note failed: {status}: {note_data}"
        print("[OK] Chatter audit log note added.")

    finally:
        # Clean up created records (delete linked sample request first to maintain referential integrity)
        if sr_id:
            print(f"\n7a. Cleaning up test linked sample request {sr_id}...")
            del_sr_status, del_sr_body = http_req(f"{BASE_URL}/sample-requests/{sr_id}", method="DELETE", headers=headers)
            print(f"    Sample request delete status: {del_sr_status} ({del_sr_body})")
        print(f"\n7b. Cleaning up test feasibility record {req_id}...")
        status, del_result = http_req(f"{BASE_URL}/feasibility-requests/{req_id}", method="DELETE", headers=headers)
        if status in (200, 204):
            print("[OK] Test feasibility record deleted cleanly.")
        else:
            print(f"Warning: Cleanup returned {status}: {del_result}")

    print("\n" + "=" * 65)
    print("ALL FEASIBILITY WORKFLOW TESTS PASSED CLEANLY & SMOOTHLY!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()

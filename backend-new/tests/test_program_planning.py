"""
Test suite for Seasonal Program Planning and Material Specification Matrix.
Verifies creation, auto-computed macro status transitions, SKU promotion to commercial SR,
idempotency, and role-based access guards.
"""
import pytest
from fastapi.testclient import TestClient


def test_create_program_request_and_matrix(client: TestClient, marketing_headers: dict):
    payload = {
        "customer_name": "Test Customer Ltd",
        "target_plant": "Plant 1",
        "program_campaign_title": "Back to School 2027",
        "program_year": "2026-2027",
        "materials": [
            {
                "material_type": "Folding Box Board",
                "supplier_name": "ITC Ltd",
                "grade": "Cyber XL Pac",
                "color_variant": "Natural White",
                "caliper_wt": "300 GSM",
                "quantity": "50000",
                "unit": "pcs",
                "remark": "High-yield carton substrate",
            },
            {
                "material_type": "Kraft Paper",
                "supplier_name": "Bilt Graphic",
                "grade": "Super Kraft",
                "color_variant": "Golden Brown",
                "caliper_wt": "180 GSM",
                "quantity": "25000",
                "unit": "pcs",
                "remark": "Outer corrugated sleeve",
            },
        ],
    }
    res = client.post("/api/v1/program-requests", json=payload, headers=marketing_headers)
    assert res.status_code == 201, f"Failed to create program request: {res.text}"
    data = res.json()
    assert data["customer_name"] == "Test Customer Ltd"
    assert data["status"] == "Pending SAMP Review"
    assert len(data["materials"]) == 2
    assert data["materials"][0]["material_type"] == "Folding Box Board"
    assert data["materials"][1]["material_type"] == "Kraft Paper"


def test_auto_computed_status_and_sku_promotion(client: TestClient, marketing_headers: dict, samp_headers: dict, admin_headers: dict):
    # 1. Marketing creates a new Program Plan
    create_payload = {
        "customer_name": "Global Stationery Corp",
        "target_plant": "Plant 1",
        "program_campaign_title": "Executive Diaries 2027",
        "program_year": "2026-2027",
        "materials": [
            {
                "material_type": "Art Paper Gloss",
                "quantity": "10000",
                "unit": "pcs",
                "remark": "Inner full-color leaf",
            }
        ],
    }
    res = client.post("/api/v1/program-requests", json=create_payload, headers=marketing_headers)
    assert res.status_code == 201
    item = res.json()
    req_id = item["id"]
    mat_id = item["materials"][0]["id"]
    assert item["status"] == "Pending SAMP Review"

    # 2. SAMP claims and submits technical review output
    claim_res = client.post(f"/api/v1/program-requests/{req_id}/claim", json={"department": "sampling"}, headers=samp_headers)
    assert claim_res.status_code == 200

    samp_out_res = client.post(
        f"/api/v1/program-requests/{req_id}/outputs",
        json={"department": "sampling", "remark": "Substrate is fully compatible with UV offset lines."},
        headers=samp_headers,
    )
    assert samp_out_res.status_code == 200
    after_samp = samp_out_res.json()
    # Auto-computed status: SAMP done, Plant pending -> "Pending Plant Review"
    assert after_samp["status"] == "Pending Plant Review"
    assert after_samp["sampling_remark"] == "Substrate is fully compatible with UV offset lines."
    assert after_samp["sampling_verdict"] == "Feasible"

    # 3. Plant submits capacity output (Admin acting as plant desk)
    claim_plant = client.post(f"/api/v1/program-requests/{req_id}/claim", json={"department": "plant"}, headers=admin_headers)
    assert claim_plant.status_code == 200

    plant_out_res = client.post(
        f"/api/v1/program-requests/{req_id}/outputs",
        json={"department": "plant", "remark": "Plant 1 has capacity for scheduled run in Q3."},
        headers=admin_headers,
    )
    assert plant_out_res.status_code == 200
    after_plant = plant_out_res.json()
    # Auto-computed status: Both SAMP and Plant done -> "Dual Sign-Off Completed"
    assert after_plant["status"] == "Dual Sign-Off Completed"
    assert after_plant["plant_verdict"] == "Capacity Confirmed"

    # 4. Marketing promotes the matrix SKU into an active commercial Sample Request
    promote_res = client.post(
        f"/api/v1/program-requests/{req_id}/materials/{mat_id}/promote-to-sampling",
        json={"request_types": ["sample"]},
        headers=marketing_headers,
    )
    assert promote_res.status_code == 200, f"Promotion failed: {promote_res.text}"
    promote_data = promote_res.json()
    assert promote_data["already_promoted"] is False
    assert promote_data["sample_request_id"] > 0
    assert promote_data["sample_sr_number"].startswith("SR-") or "SR" in promote_data["sample_sr_number"]

    # Verify that the material in the program has the promoted fields linked
    prog_mat = next(m for m in promote_data["program"]["materials"] if m["id"] == mat_id)
    assert prog_mat["promoted_sample_request_id"] == promote_data["sample_request_id"]
    assert prog_mat["promoted_sr_number"] == promote_data["sample_sr_number"]

    # 5. Idempotency test: Repeat promotion on the same SKU
    repeat_res = client.post(
        f"/api/v1/program-requests/{req_id}/materials/{mat_id}/promote-to-sampling",
        json={"request_types": ["sample"]},
        headers=marketing_headers,
    )
    assert repeat_res.status_code == 200
    repeat_data = repeat_res.json()
    assert repeat_data["already_promoted"] is True
    assert repeat_data["sample_request_id"] == promote_data["sample_request_id"]
    assert repeat_data["sample_sr_number"] == promote_data["sample_sr_number"]


def test_program_security_and_role_guards(client: TestClient, marketing_headers: dict, samp_headers: dict):
    # Marketing cannot submit SAMP department review
    create_payload = {
        "customer_name": "Security Test Corp",
        "target_plant": "Plant 1",
        "program_campaign_title": "Security Guard Test",
        "program_year": "2026-2027",
    }
    create_res = client.post("/api/v1/program-requests", json=create_payload, headers=marketing_headers)
    assert create_res.status_code == 201
    req_id = create_res.json()["id"]

    # Attempting to submit SAMP output using marketing token should be rejected
    unauthorized_res = client.post(
        f"/api/v1/program-requests/{req_id}/outputs",
        json={"department": "sampling", "remark": "Hacked output"},
        headers=marketing_headers,
    )
    assert unauthorized_res.status_code in (403, 404), "Marketing must not submit technical SAMP review"


def test_promote_with_custom_scopes_and_prevent_delete_promoted(client: TestClient, marketing_headers: dict):
    # 1. Create program with a SKU
    create_payload = {
        "customer_name": "Multi Scope Corp",
        "target_plant": "Plant 1",
        "program_campaign_title": "Packaging Range 2027",
        "program_year": "2026-2027",
        "materials": [
            {
                "material_type": "SBS Board",
                "quantity": "5000",
                "unit": "pcs",
            }
        ],
    }
    res = client.post("/api/v1/program-requests", json=create_payload, headers=marketing_headers)
    assert res.status_code == 201
    item = res.json()
    req_id = item["id"]
    mat_id = item["materials"][0]["id"]

    # 2. Promote with both sample and costing scopes
    promote_res = client.post(
        f"/api/v1/program-requests/{req_id}/materials/{mat_id}/promote-to-sampling",
        json={"request_types": ["sample", "costing"]},
        headers=marketing_headers,
    )
    assert promote_res.status_code == 200
    promote_data = promote_res.json()
    sr_id = promote_data["sample_request_id"]

    # Verify the created sample request has both scopes
    sr_res = client.get(f"/api/v1/sample-requests/{sr_id}", headers=marketing_headers)
    assert sr_res.status_code == 200
    sr_obj = sr_res.json()
    assert "sample" in sr_obj["request_types"]
    assert "costing" in sr_obj["request_types"]

    # 3. Attempting to delete this promoted material must raise 409 Conflict
    del_res = client.delete(
        f"/api/v1/program-requests/{req_id}/materials/{mat_id}",
        headers=marketing_headers,
    )
    assert del_res.status_code == 409
    assert "already been promoted" in del_res.json()["detail"]


def test_marketing_delete_material_and_add_note(client: TestClient, marketing_headers: dict):
    create_payload = {
        "customer_name": "Delete Test Customer",
        "target_plant": "Plant 1",
        "program_campaign_title": "Delete SKU Test",
        "program_year": "2026-2027",
        "materials": [
            {"material_type": "Keep Me", "quantity": "100"},
            {"material_type": "Delete Me", "quantity": "200"},
        ],
    }
    res = client.post("/api/v1/program-requests", json=create_payload, headers=marketing_headers)
    assert res.status_code == 201
    item = res.json()
    req_id = item["id"]
    delete_mat_id = item["materials"][1]["id"]

    # Marketing owner can delete unpromoted material
    del_res = client.delete(
        f"/api/v1/program-requests/{req_id}/materials/{delete_mat_id}",
        headers=marketing_headers,
    )
    assert del_res.status_code == 200
    updated_materials = del_res.json()["materials"]
    assert len(updated_materials) == 1
    assert updated_materials[0]["material_type"] == "Keep Me"

    # Add a note into the chatter
    note_res = client.post(
        f"/api/v1/program-requests/{req_id}/notes",
        json={"note": "Reviewed with brand manager today"},
        headers=marketing_headers,
    )
    assert note_res.status_code == 200
    acts = note_res.json()["activities"]
    assert any(a["action"] == "NOTE_POSTED" and a["payload"].get("note") == "Reviewed with brand manager today" for a in acts)


def test_custom_verdicts_in_outputs(client: TestClient, marketing_headers: dict, samp_headers: dict):
    create_payload = {
        "customer_name": "Verdict Test Corp",
        "target_plant": "Plant 1",
        "program_campaign_title": "Verdict Test Program",
        "program_year": "2026-2027",
    }
    res = client.post("/api/v1/program-requests", json=create_payload, headers=marketing_headers)
    assert res.status_code == 201
    req_id = res.json()["id"]

    # Claim review
    client.post(f"/api/v1/program-requests/{req_id}/claim", json={"department": "sampling"}, headers=samp_headers)

    # Submit output with explicit verdict "Revisions Required"
    samp_out = client.post(
        f"/api/v1/program-requests/{req_id}/outputs",
        json={
            "department": "sampling",
            "remark": "Substrate thickness needs recalibration.",
            "verdict": "Revisions Required",
        },
        headers=samp_headers,
    )
    assert samp_out.status_code == 200
    data = samp_out.json()
    assert data["sampling_verdict"] == "Revisions Required"
    assert data["sampling_remark"] == "Substrate thickness needs recalibration."


def test_dismantle_program_irreversible(client: TestClient, marketing_headers: dict):
    create_payload = {
        "customer_name": "Dismantle Test Corp",
        "target_plant": "Plant 1",
        "program_campaign_title": "Dismantle Test Campaign",
        "program_year": "2026-2027",
    }
    res = client.post("/api/v1/program-requests", json=create_payload, headers=marketing_headers)
    assert res.status_code == 201
    req_id = res.json()["id"]

    # Dismantle program
    dismantle_res = client.post(
        f"/api/v1/program-requests/{req_id}/dismantle",
        json={"reason": "Campaign cancelled due to budget cuts"},
        headers=marketing_headers,
    )
    assert dismantle_res.status_code == 200
    data = dismantle_res.json()
    assert data["status"] == "Dismantled"
    assert data["is_active"] is False

    # Irreversible guard 1: Attempt to resume via pause endpoint should fail with 400
    resume_res = client.post(
        f"/api/v1/program-requests/{req_id}/pause",
        json={"paused": False},
        headers=marketing_headers,
    )
    assert resume_res.status_code == 400
    assert "dismantled program plan cannot be resumed" in resume_res.json()["detail"].lower()

    # Irreversible guard 2: Attempt to dismantle again should fail with 400
    dismantle_again = client.post(
        f"/api/v1/program-requests/{req_id}/dismantle",
        json={"reason": "Trying again"},
        headers=marketing_headers,
    )
    assert dismantle_again.status_code == 400
    assert "already dismantled" in dismantle_again.json()["detail"].lower()


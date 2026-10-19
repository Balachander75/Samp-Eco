import base64
from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.feasibility import FeasibilityRequest, FeasibilityActivityLog
from app.models.sample_request import CreateSampleRequest, SampleRequestReferenceImage
from app.utils.operational_workdays import is_operational_workday


def _get_upcoming_workday(days_ahead: int = 5) -> str:
    current = datetime.now(timezone.utc).date() + timedelta(days=days_ahead)
    while not is_operational_workday(current):
        current += timedelta(days=1)
    return current.isoformat()


# Minimal 1x1 valid PNG in base64
TINY_PNG_DATA_URL = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def test_team_head_cannot_write_feasibility(client: TestClient, team_head_headers: dict):
    """Verify Team Heads get HTTP 403 on mutating Feasibility endpoints (Issue 1 fix)."""
    target_date = _get_upcoming_workday(3)
    response = client.post(
        "/api/v1/feasibility-requests",
        headers=team_head_headers,
        json={
            "customer": "Avalon International Ltd.",
            "feasibility_type": "new_category",
            "description_notes": "Team Head Write Test",
            "required_date": target_date,
        },
    )
    assert response.status_code == 403
    assert "Team heads have read-only access" in response.text


def test_create_feasibility_request_validation(client: TestClient, marketing_headers: dict):
    """Verify validation on required date (non-workdays) and valid creation."""
    # Find next Sunday (guaranteed non-workday)
    sun = datetime.now(timezone.utc).date() + timedelta(days=1)
    while sun.weekday() != 6:
        sun += timedelta(days=1)

    fail_response = client.post(
        "/api/v1/feasibility-requests",
        headers=marketing_headers,
        json={
            "customer": "Avalon International Ltd.",
            "feasibility_type": "new_category",
            "description_notes": "Sunday request",
            "required_date": sun.isoformat(),
        },
    )
    assert fail_response.status_code == 422
    assert "Required date must be a working day" in fail_response.text


def test_feasibility_full_lifecycle_and_conversion(
    client: TestClient,
    marketing_headers: dict,
    samp_headers: dict,
    admin_headers: dict,
    db_session: Session,
):
    """End-to-end test: Create -> Claim -> Counter-Date -> Verdict -> Decision -> Convert to Sampling."""
    workday = _get_upcoming_workday(4)

    # 1. Marketing creates feasibility request with reference images and links
    create_payload = {
        "customer": "Test Enterprise Client",
        "feasibility_type": "new_format",
        "description_notes": "Automated feasibility verification test",
        "required_date": workday,
        "marketing_remarks": "Critical client launch",
        "reference_images": [TINY_PNG_DATA_URL],
        "reference_image_names": ["spec-drawing-1.png"],
        "reference_links": ["https://drive.google.com/test-spec"],
    }
    res = client.post("/api/v1/feasibility-requests", headers=marketing_headers, json=create_payload)
    assert res.status_code == 201, f"Create failed: {res.text}"
    req_data = res.json()
    req_id = req_data["id"]
    req_code = req_data["request_code"]
    assert req_data["status"] == "Pending Feasibility"
    assert len(req_data["reference_links"]) == 1
    assert len(req_data["reference_images"]) == 1

    # Verify CREATED log in DB
    created_log = (
        db_session.query(FeasibilityActivityLog)
        .filter(FeasibilityActivityLog.feasibility_request_id == req_id, FeasibilityActivityLog.action == "CREATED")
        .first()
    )
    assert created_log is not None

    # 2. Maker-Checker Rule: Creator cannot claim their own request for review
    claim_by_creator = client.post(f"/api/v1/feasibility-requests/{req_id}/claim", headers=marketing_headers)
    assert claim_by_creator.status_code == 403

    # 3. SAMP Team claims the review
    claim_res = client.post(f"/api/v1/feasibility-requests/{req_id}/claim", headers=samp_headers)
    assert claim_res.status_code == 200
    claimed_data = claim_res.json()
    assert claimed_data["status"] == "Under SAMP Review"
    assert claimed_data["taken_by_samp"] is not None

    # 4. Propose revised counter-date
    counter_date = _get_upcoming_workday(8)
    prop_res = client.post(
        f"/api/v1/feasibility-requests/{req_id}/counter-date",
        headers=samp_headers,
        json={"proposed_date": counter_date, "reason": "Custom tooling delivery required"},
    )
    assert prop_res.status_code == 200
    prop_data = prop_res.json()
    assert prop_data["counter_date_decision"] == "pending"
    assert prop_data["status"] == "Awaiting Marketing Date Decision"

    # 5. Marketing accepts the counter-date
    decide_res = client.post(
        f"/api/v1/feasibility-requests/{req_id}/counter-date-decision",
        headers=marketing_headers,
        json={"decision": "accepted", "decision_remark": "Client agreed to revised schedule"},
    )
    assert decide_res.status_code == 200
    decide_data = decide_res.json()
    assert decide_data["counter_date_decision"] == "accepted"
    assert decide_data["required_date"] == counter_date
    assert decide_data["status"] == "Under SAMP Review"

    # 6. Add chatter note (Issue 2 backend verification)
    note_res = client.post(
        f"/api/v1/feasibility-requests/{req_id}/notes",
        headers=marketing_headers,
        json={"note": "Tooling supplier confirmed shipment dispatch."},
    )
    assert note_res.status_code == 200

    # 7. SAMP submits technical verdict
    verdict_res = client.put(
        f"/api/v1/feasibility-requests/{req_id}/samp-verdict",
        headers=samp_headers,
        json={
            "response": "Yes",
            "remark": "Plant machinery tooling fully compatible.",
            "lead_time_note": "4 business days fabrication.",
        },
    )
    assert verdict_res.status_code == 200
    verdict_data = verdict_res.json()
    assert verdict_data["sampling_feasibility_response"] == "Yes"
    assert verdict_data["status"] == "Feasibility Yes"

    # 8. Marketing renders final commercial decision
    mktg_res = client.post(
        f"/api/v1/feasibility-requests/{req_id}/marketing-decision",
        headers=marketing_headers,
        json={"decision": "Accepted", "decision_remark": "Approved for sampling run"},
    )
    assert mktg_res.status_code == 200
    mktg_data = mktg_res.json()
    assert mktg_data["marketing_decision"] == "Accepted"
    assert mktg_data["status"] == "Marketing Accepted"

    # 9. Convert to commercial Sample and Costing request (Issue 3 fix verification)
    conv_res = client.post(
        f"/api/v1/feasibility-requests/{req_id}/convert-to-sampling",
        headers=marketing_headers,
        json={"request_types": ["sample", "costing"]},
    )
    assert conv_res.status_code == 200
    conv_data = conv_res.json()
    sample_req_id = conv_data["sample_request_id"]
    assert sample_req_id is not None
    assert "sample" in conv_data["request_types"]
    assert "costing" in conv_data["request_types"]

    # Verify that reference links and reference images were copied into the commercial request
    converted_sr = db_session.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_req_id).first()
    assert converted_sr is not None
    assert converted_sr.reference_links == ["https://drive.google.com/test-spec"]

    copied_images = (
        db_session.query(SampleRequestReferenceImage)
        .filter(SampleRequestReferenceImage.sample_request_id == sample_req_id)
        .all()
    )
    assert len(copied_images) >= 1
    assert copied_images[0].original_name == "spec-drawing-1.png"

    # Request deletion is disabled; remove this test data through the DB fixture.
    del_res = client.delete(f"/api/v1/feasibility-requests/{req_id}", headers=admin_headers)
    assert del_res.status_code == 405
    db_session.delete(db_session.get(FeasibilityRequest, req_id))
    db_session.commit()

def test_feasibility_convert_both_sample_and_mockup_together(
    client: TestClient,
    marketing_headers: dict,
    samp_headers: dict,
    db_session: Session,
):
    """Verify converting an accepted feasibility request to BOTH Sample and Mockup together."""
    workday = _get_upcoming_workday(3)
    create_payload = {
        "customer": "Both Types Enterprise",
        "feasibility_type": "new_format",
        "description_notes": "Both sample and mockup conversion test",
        "required_date": workday,
        "marketing_remarks": "Dual request conversion",
    }
    res = client.post("/api/v1/feasibility-requests", headers=marketing_headers, json=create_payload)
    assert res.status_code == 201
    req_id = res.json()["id"]

    # Claim & Sign-off by SAMP
    client.post(f"/api/v1/feasibility-requests/{req_id}/claim", headers=samp_headers)
    client.put(
        f"/api/v1/feasibility-requests/{req_id}/samp-verdict",
        headers=samp_headers,
        json={"response": "Yes", "remark": "Compatible for both sampling and mockups."},
    )

    # Marketing accepts
    client.post(
        f"/api/v1/feasibility-requests/{req_id}/marketing-decision",
        headers=marketing_headers,
        json={"decision": "Accepted", "decision_remark": "Approved for full commercial sampling and mockup."},
    )

    # Convert to BOTH Sample and Mockup together
    conv_res = client.post(
        f"/api/v1/feasibility-requests/{req_id}/convert-to-sampling",
        headers=marketing_headers,
        json={"request_types": ["sample", "mockup"]},
    )
    assert conv_res.status_code == 200
    conv_data = conv_res.json()
    assert "sample" in conv_data["request_types"]
    assert "mockup" in conv_data["request_types"]
    assert conv_data["feasibility"]["status"] == "Converted to Sample & Mockup"

    # Cleanup
    db_session.delete(db_session.get(FeasibilityRequest, req_id))
    db_session.commit()

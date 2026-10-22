import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.security import create_access_token
from app.models.master import User
from app.models.sample_request import CreateSampleRequest
from app.models.request_workflows import MockupWorkflow, CostingWorkflow
from tests.conftest import _get_or_create_user


def _get_studio_headers(db: Session) -> dict:
    user = _get_or_create_user(
        db,
        userid="TestStudio",
        name="Studio Specialist",
        email="studio.tester@navneet.com",
        role="user",
        team="creative_studio",
        is_team_head=False,
    )
    token = create_access_token(
        subject=user.id,
        role=user.role,
        extra={"name": user.name, "userid": user.userid, "team": user.team},
    )
    return {"Authorization": f"Bearer {token}"}


def _get_costing_headers(db: Session) -> dict:
    user = _get_or_create_user(
        db,
        userid="TestCosting",
        name="Costing Specialist",
        email="costing.tester@navneet.com",
        role="user",
        team="costing",
        is_team_head=False,
    )
    token = create_access_token(
        subject=user.id,
        role=user.role,
        extra={"name": user.name, "userid": user.userid, "team": user.team},
    )
    return {"Authorization": f"Bearer {token}"}


def test_mockup_intake_validation_logic(client: TestClient, marketing_headers: dict, db_session: Session):
    """Bug 2: When design is NOT needed, shutterstock or remark is mandatory on release/submit. When design IS needed, it is not required."""
    # 1. New design NOT needed and missing both shutterstock and remark -> 422 on release
    payload_invalid = {
        "customer": "Navneet Consumer",
        "material_code": "VAL-MOCK-001",
        "product_description": "Validation Notebook",
        "status": "Draft (Pre-SMT)",
        "request_types": ["mockup"],
        "mockup_workflow_state": {
            "requiredDate": "2026-11-01",
            "qtyForMockup": "2",
            "designNeeded": "no",
            "marketingShutterstockNo": "",
            "marketingRemark": "",
        },
    }
    res1 = client.post("/api/v1/sample-requests", json=payload_invalid, headers=marketing_headers)
    assert res1.status_code == 201
    sample_id = res1.json()["id"]

    res_rel_invalid = client.post(f"/api/v1/sample-requests/{sample_id}/release", headers=marketing_headers)
    assert res_rel_invalid.status_code == 422
    assert "Shutterstock number or remark when no new design is needed" in res_rel_invalid.json()["detail"]

    # 2. New design IS needed -> valid even without shutterstock
    payload_valid = {
        "customer": "Navneet Consumer",
        "material_code": "VAL-MOCK-002",
        "product_description": "Validation Notebook 2",
        "status": "Draft (Pre-SMT)",
        "request_types": ["mockup"],
        "mockup_workflow_state": {
            "requiredDate": "2026-11-01",
            "qtyForMockup": "2",
            "designNeeded": "yes",
            "marketingShutterstockNo": "",
            "marketingRemark": "",
        },
    }
    res2 = client.post("/api/v1/sample-requests", json=payload_valid, headers=marketing_headers)
    assert res2.status_code == 201
    sample_id2 = res2.json()["id"]

    res_rel_valid = client.post(f"/api/v1/sample-requests/{sample_id2}/release", headers=marketing_headers)
    assert res_rel_valid.status_code == 200


def test_multi_scope_creation_and_status_hygiene(client: TestClient, marketing_headers: dict, db_session: Session):
    """Bug 4: Costing workflow status must not be contaminated with Studio on direct creation."""
    payload = {
        "customer": "Navneet Retail",
        "material_code": "HYG-MULTI-001",
        "product_description": "Multi-Scope Hygiene Notebook",
        "status": "In Progress",
        "request_types": ["mockup", "costing"],
        "qty_design_costing": "500",
        "unit_pc_pack": "PC",
        "costing_required_date": "2026-11-15",
        "costing_creative_input_needed": False,
        "mockup_workflow_state": {
            "requiredDate": "2026-11-01",
            "qtyForMockup": "3",
            "designNeeded": "no",
            "marketingRemark": "Use standard cover template",
        },
    }
    res = client.post("/api/v1/sample-requests", json=payload, headers=marketing_headers)
    assert res.status_code == 201
    created_id = res.json()["id"]

    cw = db_session.query(CostingWorkflow).filter(CostingWorkflow.sample_request_id == created_id).first()
    assert cw is not None
    assert cw.status == "Costing Work"
    assert cw.status != "Studio"
    assert cw.current_stage == "costing"


def test_multi_scope_draft_release_status_lock(client: TestClient, marketing_headers: dict, db_session: Session):
    """Bug 5: Draft with mockup+costing without creative needs releases to 'Studio', not locked to 'Creative'."""
    # Create draft
    draft_payload = {
        "customer": "Navneet Export",
        "material_code": "REL-LOCK-001",
        "product_description": "Release Lock Test Notebook",
        "status": "Draft (Pre-SMT)",
        "request_types": ["mockup", "costing"],
        "qty_design_costing": "1000",
        "unit_pc_pack": "PC",
        "costing_required_date": "2026-12-01",
        "costing_creative_input_needed": False,
        "mockup_workflow_state": {
            "requiredDate": "2026-11-20",
            "qtyForMockup": "1",
            "designNeeded": "no",
            "marketingRemark": "Standard binding",
        },
    }
    res_draft = client.post("/api/v1/sample-requests", json=draft_payload, headers=marketing_headers)
    assert res_draft.status_code == 201
    sample_id = res_draft.json()["id"]

    # Release draft
    res_release = client.post(f"/api/v1/sample-requests/{sample_id}/release", headers=marketing_headers)
    assert res_release.status_code == 200
    updated_rec = res_release.json()["data"]
    assert updated_rec["status"] == "Studio"

    mw = db_session.query(MockupWorkflow).filter(MockupWorkflow.sample_request_id == sample_id).first()
    assert mw.current_stage == "studio"
    assert mw.status == "Studio"

    cw = db_session.query(CostingWorkflow).filter(CostingWorkflow.sample_request_id == sample_id).first()
    assert cw.current_stage == "costing"
    assert cw.status == "Costing Work"


def test_mockup_sampling_loop_resolution(client: TestClient, marketing_headers: dict, samp_headers: dict, db_session: Session):
    """Bug 1: When Marketing accepts a Mockup with has_sampling=True, the Mockup deliverable closes (done) and physical sample continues."""
    studio_headers = _get_studio_headers(db_session)

    payload = {
        "customer": "Navneet Education",
        "material_code": "LOOP-FIX-001",
        "product_description": "Loop Resolution Notebook",
        "status": "In Progress",
        "request_types": ["mockup", "sample"],
        "sample_required_date": "2026-12-10",
        "qty_for_sampling": "5",
        "unit_pc_pack": "PC",
        "mockup_workflow_state": {
            "requiredDate": "2026-11-25",
            "qtyForMockup": "1",
            "designNeeded": "no",
            "marketingRemark": "Direct studio design",
            "stage": "studio",
        },
    }
    res = client.post("/api/v1/sample-requests", json=payload, headers=marketing_headers)
    assert res.status_code == 201
    sample_id = res.json()["id"]

    # 1. Studio claims and submits mockup link
    client.post(f"/api/v1/sample-requests/{sample_id}/mockup/claim", json={"stage": "studio"}, headers=studio_headers)
    res_submit = client.post(f"/api/v1/sample-requests/{sample_id}/mockup/submit", json={"mockup_url": "https://storage.navneet.com/mockups/001.pdf"}, headers=studio_headers)
    assert res_submit.status_code == 200

    # 2. Marketing accepts mockup
    res_accept = client.post(
        f"/api/v1/sample-requests/{sample_id}/mockup/marketing-decision",
        json={"decision": "accept"},
        headers=marketing_headers,
    )
    assert res_accept.status_code == 200

    # Verify MockupWorkflow is closed (done) and request status is Sampling Review (PMT)
    mw = db_session.query(MockupWorkflow).filter(MockupWorkflow.sample_request_id == sample_id).first()
    assert mw.current_stage == "done"
    assert mw.status == "Approved / Closed"
    assert mw.closed_at is not None

    req = db_session.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).first()
    assert req.status == "Sampling Review (PMT)"


def test_studio_revision_rejection_with_sampling_remark(client: TestClient, marketing_headers: dict, samp_headers: dict, db_session: Session):
    """Bug 6: Studio can reject a revision that originated from Sampling review notes."""
    studio_headers = _get_studio_headers(db_session)

    payload = {
        "customer": "Navneet Paper",
        "material_code": "REJ-TEST-001",
        "product_description": "Revision Rejection Test Notebook",
        "request_types": ["mockup"],
        "status": "Creative",
        "mockup_workflow_state": {
            "requiredDate": "2026-11-25",
            "qtyForMockup": "1",
            "designNeeded": "no",
            "marketingRemark": "Standard cover",
            "stage": "sampling_review",
        },
    }
    res = client.post("/api/v1/sample-requests", json=payload, headers=marketing_headers)
    assert res.status_code == 201
    sample_id = res.json()["id"]

    mw = db_session.query(MockupWorkflow).filter(MockupWorkflow.sample_request_id == sample_id).first()
    mw.current_stage = "sampling_review"
    req = db_session.query(CreateSampleRequest).filter(CreateSampleRequest.id == sample_id).first()
    st = dict(req.mockup_workflow_state or {})
    st["stage"] = "sampling_review"
    req.mockup_workflow_state = st
    db_session.commit()

    # Sampling claims and returns
    client.post(f"/api/v1/sample-requests/{sample_id}/mockup/claim", json={"stage": "sampling_review"}, headers=samp_headers)
    client.post(f"/api/v1/workflows/mockup/{sample_id}/review", json={"decision": "return", "remark": "Binding margin too tight"}, headers=samp_headers)

    # Studio claims and rejects revision
    client.post(f"/api/v1/sample-requests/{sample_id}/mockup/claim", json={"stage": "studio"}, headers=studio_headers)
    res_reject = client.post(
        f"/api/v1/sample-requests/{sample_id}/mockup/studio-revision-decision",
        json={"remark": "Dieline cannot accommodate 15mm margin requested"},
        headers=studio_headers,
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "Awaiting Marketing Direction (Mockup)"


def test_admin_claim_bypass_and_closure_protection(client: TestClient, admin_headers: dict, marketing_headers: dict, db_session: Session):
    """Bug 10 & 11: Admin can act without claim; closed mockups reject subsequent mutations."""
    payload = {
        "customer": "Navneet Corporate",
        "material_code": "ADM-CLOSE-001",
        "product_description": "Admin and Closure Test Notebook",
        "status": "In Progress",
        "request_types": ["mockup"],
        "mockup_workflow_state": {
            "requiredDate": "2026-11-25",
            "qtyForMockup": "1",
            "designNeeded": "no",
            "marketingRemark": "Admin test",
            "stage": "studio",
        },
    }
    res = client.post("/api/v1/sample-requests", json=payload, headers=marketing_headers)
    assert res.status_code == 201
    sample_id = res.json()["id"]

    # 1. Admin can submit studio mockup without claiming first (Bug 10)
    res_admin_submit = client.post(
        f"/api/v1/sample-requests/{sample_id}/mockup/submit",
        json={"mockup_url": "https://storage.navneet.com/mockups/admin_bypass.pdf"},
        headers=admin_headers,
    )
    assert res_admin_submit.status_code == 200

    # 2. Marketing accepts mockup -> Mockup deliverable closes
    client.post(
        f"/api/v1/sample-requests/{sample_id}/mockup/marketing-decision",
        json={"decision": "accept"},
        headers=marketing_headers,
    )

    # 3. Subsequent write attempts on closed mockup must be rejected with 409 (Bug 11)
    res_closed_write = client.post(
        f"/api/v1/sample-requests/{sample_id}/mockup/submit",
        json={"mockup_url": "https://storage.navneet.com/mockups/illegal_write.pdf"},
        headers=admin_headers,
    )
    assert res_closed_write.status_code == 409
    assert "closed" in res_closed_write.json()["detail"].lower()


def test_close_request_endpoint_freezes_mockup_across_all_teams(
    client: TestClient,
    admin_headers: dict,
    marketing_headers: dict,
    db_session: Session,
):
    creative_headers = _get_studio_headers(db_session)
    """Marketing closes a mockup while Creative had claimed it; all teams are permanently blocked."""
    # 1. Create a mockup request
    payload = {
        "customer": "Navneet Stationery",
        "material_code": "CLOSE-TEST-001",
        "product_description": "Terminal Closure Test",
        "status": "In Progress",
        "request_types": ["mockup"],
        "mockup_workflow_state": {
            "requiredDate": "2026-11-28",
            "qtyForMockup": "2",
            "designNeeded": "no",
            "marketingRemark": "Ready for creative input",
            "stage": "creative",
        },
    }
    create_res = client.post("/api/v1/sample-requests", json=payload, headers=marketing_headers)
    assert create_res.status_code == 201
    sample_id = create_res.json()["id"]

    # 2. Creative claims the mockup task
    claim_res = client.post(f"/api/v1/sample-requests/{sample_id}/mockup/claim", headers=creative_headers)
    assert claim_res.status_code == 200
    assert claim_res.json()["mockup_workflow_state"].get("claimedBy") is not None

    # 2b. Creative or unauthorized users CANNOT close the request (403 Forbidden)
    illegal_close = client.post(
        "/api/v1/request-closures",
        json={"request_type": "mockup", "request_id": sample_id, "reason": "Creative closing"},
        headers=creative_headers,
    )
    assert illegal_close.status_code == 403

    # 3. ONLY the Marketing user who raised the request can close it
    close_res = client.post(
        "/api/v1/request-closures",
        json={
            "request_type": "mockup",
            "request_id": sample_id,
            "reason": "Project dropped by client; cancelling immediately.",
        },
        headers=marketing_headers,
    )
    assert close_res.status_code == 201
    closure_data = close_res.json()["closure"]
    assert closure_data["reason"] == "Project dropped by client; cancelling immediately."
    assert closure_data["closed_by_team"] == "marketing"

    # 4. Fetch the sample request: is_closed is True, claim is wiped clean!
    get_res = client.get(f"/api/v1/sample-requests/{sample_id}", headers=creative_headers)
    assert get_res.status_code == 200
    sample_body = get_res.json()
    assert sample_body["is_closed"] is True
    assert sample_body["closure"] is not None
    assert sample_body["closure"]["reason"] == "Project dropped by client; cancelling immediately."
    mw_state = sample_body["mockup_workflow_state"]
    assert mw_state.get("is_closed") is True
    assert mw_state.get("claimedBy") is None

    # 5. Creative tries to submit input -> blocked with 409
    creative_submit_res = client.post(
        f"/api/v1/sample-requests/{sample_id}/mockup/send-to-studio",
        json={"target_artwork_date": "2026-11-30", "creative_remarks": "Submitting my work anyway"},
        headers=creative_headers,
    )
    assert creative_submit_res.status_code == 409
    assert "closed" in creative_submit_res.json()["detail"].lower()

    # 6. Anyone (even admin) tries to claim or modify -> blocked with 409
    admin_claim_res = client.post(f"/api/v1/sample-requests/{sample_id}/mockup/claim", headers=admin_headers)
    assert admin_claim_res.status_code == 409

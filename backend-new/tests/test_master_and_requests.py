from fastapi.testclient import TestClient


def test_health_and_readiness(client: TestClient):
    """Verify health and readiness probes return 200 OK."""
    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json() == {"status": "healthy"}

    ready_res = client.get("/ready")
    assert ready_res.status_code == 200
    assert ready_res.json()["status"] == "ready"
    assert ready_res.json()["database"] == "ready"


def test_master_plants_list(client: TestClient, admin_headers: dict):
    """Verify plants master endpoint returns operational facilities."""
    response = client.get("/api/v1/plants", headers=admin_headers)
    assert response.status_code == 200
    plants = response.json()
    assert isinstance(plants, list)
    assert len(plants) > 0
    codes = [p["code"] for p in plants]
    assert "1505" in codes, "Khaniwade hub 1505 must be present"


def test_master_customers_list(client: TestClient, admin_headers: dict):
    """Verify customers master endpoint returns seeded corporate clients."""
    response = client.get("/api/v1/customers", headers=admin_headers)
    assert response.status_code == 200
    customers = response.json()
    assert isinstance(customers, list)
    assert len(customers) >= 5, "Seeded customers must be available"


def test_master_product_characteristics(client: TestClient, admin_headers: dict):
    """Verify packaging taxonomy and characteristics catalog."""
    response = client.get("/api/v1/product-characteristics", headers=admin_headers)
    assert response.status_code == 200
    chars = response.json()
    assert isinstance(chars, list)


def test_sample_requests_list(client: TestClient, admin_headers: dict):
    """Verify sample requests query returns paginated data."""
    response = client.get("/api/v1/sample-requests", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data or isinstance(data, list)


def test_feasibility_requests_list(client: TestClient, admin_headers: dict):
    """Verify feasibility inquiries query."""
    response = client.get("/api/v1/feasibility-requests", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list) or "items" in data



from uuid import uuid4

def test_resample_auto_detection_catalog_material_code(client: TestClient, marketing_headers: dict):
    """Test that a sample request created from an existing catalog material code is auto-detected as Resample and released to Plant."""
    mat_code = f"MAT-AUTO-RESAMPLE-{uuid4().hex[:6]}"
    payload = {
        "customer": "Test Corp",
        "product_description": "Catalog Notebook A5",
        "material_code": mat_code,
        "creation_mode": "material_code",
        "request_types": ["sample"],
        "status": "Draft (Pre-SMT)",
    }
    create_res = client.post("/api/v1/sample-requests", json=payload, headers=marketing_headers)
    assert create_res.status_code == 201
    created_id = create_res.json()["data"]["id"]

    release_res = client.post(
        "/api/v1/sample-requests/release-batch",
        json={"ids": [created_id], "status": "Released to Plant"},
        headers=marketing_headers,
    )
    assert release_res.status_code == 200

    get_res = client.get(f"/api/v1/sample-requests/{created_id}", headers=marketing_headers)
    assert get_res.status_code == 200
    item = get_res.json()
    assert item["status"] == "Released to Plant"
    state = item.get("mockup_workflow_state") or {}
    assert state.get("isResample") is True


def test_brand_new_product_routes_to_sampling_review(client: TestClient, marketing_headers: dict):
    """Test that a brand new product without characteristics is NEVER routed to Plant, but to Sampling Review (PMT)."""
    payload = {
        "customer": "Test Corp",
        "product_description": "Brand New Box NPD",
        "material_code": "NEW-PROD-99",
        "creation_mode": "new",
        "request_types": ["sample"],
        "status": "Draft (Pre-SMT)",
    }
    create_res = client.post("/api/v1/sample-requests", json=payload, headers=marketing_headers)
    assert create_res.status_code == 201
    created_id = create_res.json()["data"]["id"]

    release_res = client.post(
        "/api/v1/sample-requests/release-batch",
        json={"ids": [created_id], "status": "Released to Plant"},
        headers=marketing_headers,
    )
    assert release_res.status_code == 200

    get_res = client.get(f"/api/v1/sample-requests/{created_id}", headers=marketing_headers)
    assert get_res.status_code == 200
    item = get_res.json()
    assert item["status"] == "Sampling Review (PMT)"

def test_create_sample_request_rejects_empty_product_description(client: TestClient, marketing_headers: dict):
    """Verify that creating a sample request with empty or whitespace product_description fails."""
    payload_empty = {
        "customer": "Test Corp",
        "product_description": "",
        "status": "Draft (Pre-SMT)",
    }
    res = client.post("/api/v1/sample-requests", json=payload_empty, headers=marketing_headers)
    assert res.status_code == 422
    assert "Product description is required" in res.json().get("detail", "")

    payload_whitespace = {
        "customer": "Test Corp",
        "product_description": "   \t   ",
        "status": "Draft (Pre-SMT)",
    }
    res_ws = client.post("/api/v1/sample-requests", json=payload_whitespace, headers=marketing_headers)
    assert res_ws.status_code == 422


def test_batch_create_rejects_empty_items_or_descriptions(client: TestClient, marketing_headers: dict):
    """Verify that batch creation requires at least one product with non-empty product_description."""
    res_empty = client.post("/api/v1/sample-requests/batch", json={"items": []}, headers=marketing_headers)
    assert res_empty.status_code == 422
    assert "At least one product item is required" in res_empty.json().get("detail", "")

    res_no_desc = client.post(
        "/api/v1/sample-requests/batch",
        json={"items": [{"product_description": "   "}]},
        headers=marketing_headers,
    )
    assert res_no_desc.status_code == 422
    assert "Product description is required" in res_no_desc.json().get("detail", "")


def test_delete_draft_sample_request(client: TestClient, marketing_headers: dict):
    """Verify that a draft sample request can be deleted and subsequent GET returns 404."""
    payload = {
        "customer": "Test Corp",
        "product_description": "Temporary Draft To Delete",
        "status": "Draft (Pre-SMT)",
    }
    create_res = client.post("/api/v1/sample-requests", json=payload, headers=marketing_headers)
    assert create_res.status_code == 201
    draft_id = create_res.json()["data"]["id"]

    delete_res = client.delete(f"/api/v1/sample-requests/{draft_id}", headers=marketing_headers)
    assert delete_res.status_code == 200
    assert delete_res.json()["success"] is True

    get_res = client.get(f"/api/v1/sample-requests/{draft_id}", headers=marketing_headers)
    assert get_res.status_code == 404


def test_delete_released_sample_request_rejected(client: TestClient, marketing_headers: dict):
    """Verify that released requests cannot be deleted via draft deletion endpoint."""
    payload = {
        "customer": "Test Corp",
        "product_description": "Released Request Cannot Be Deleted",
        "material_code": "MAT-NON-DEL",
        "creation_mode": "material_code",
        "request_types": ["sample"],
        "status": "Draft (Pre-SMT)",
    }
    create_res = client.post("/api/v1/sample-requests", json=payload, headers=marketing_headers)
    assert create_res.status_code == 201
    created_id = create_res.json()["data"]["id"]

    release_res = client.post(
        "/api/v1/sample-requests/release-batch",
        json={"ids": [created_id], "status": "Released to Plant"},
        headers=marketing_headers,
    )
    assert release_res.status_code == 200

    del_res = client.delete(f"/api/v1/sample-requests/{created_id}", headers=marketing_headers)
    assert del_res.status_code == 400
    assert "Only draft sample requests can be deleted" in del_res.json().get("detail", "")

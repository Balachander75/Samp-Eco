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

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.master import User, RefreshToken
from app.auth.security import create_access_token, create_refresh_token, _hash_token


def test_login_success(client: TestClient):
    """Verify login issues both access token and HttpOnly refresh cookie."""
    response = client.post(
        "/api/auth/login",
        json={"identifier": "Admin", "password": "Admin123", "remember_me": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["role"] == "admin"
    assert "refresh_token" in response.cookies, "HttpOnly refresh cookie must be set"


def test_login_invalid_credentials(client: TestClient):
    """Verify invalid password returns 401 without setting cookies."""
    response = client.post(
        "/api/auth/login",
        json={"identifier": "Admin", "password": "WrongPassword999!"},
    )
    assert response.status_code == 401
    assert "refresh_token" not in response.cookies


def test_login_missing_identifier(client: TestClient):
    """Verify empty identifier returns 422 validation error."""
    response = client.post(
        "/api/auth/login",
        json={"identifier": "", "password": "SomePassword"},
    )
    assert response.status_code == 422


def test_get_current_user_me(client: TestClient, admin_headers: dict):
    """Verify /api/auth/me returns the authenticated profile."""
    response = client.get("/api/auth/me", headers=admin_headers)
    assert response.status_code == 200
    profile = response.json()
    assert profile["userid"] == "Admin"
    assert profile["role"] == "admin"


def test_refresh_token_rotation_via_cookie(client: TestClient):
    """Verify /api/auth/refresh rotates the refresh token cookie seamlessly."""
    # 1. Login to get initial cookie
    login_res = client.post(
        "/api/auth/login",
        json={"identifier": "Admin", "password": "Admin123", "remember_me": True},
    )
    assert login_res.status_code == 200
    old_cookie = client.cookies.get("refresh_token")
    assert old_cookie is not None

    # 2. Refresh with cookie only (empty payload)
    refresh_res = client.post("/api/auth/refresh", json={})
    assert refresh_res.status_code == 200
    refresh_data = refresh_res.json()
    assert "access_token" in refresh_data

    # 3. Verify new rotated cookie was set
    new_cookie = client.cookies.get("refresh_token")
    assert new_cookie is not None
    assert new_cookie != old_cookie, "Refresh cookie must be rotated on refresh"


def test_refresh_token_reuse_detection(client: TestClient, db_session: Session):
    """Verify using an already-revoked refresh token triggers session revocation."""
    admin = db_session.query(User).filter(User.role == "admin").first()
    assert admin is not None

    # Create and manually revoke a token
    raw_token = create_refresh_token(admin.id, db_session)
    token_hash = _hash_token(raw_token)
    record = db_session.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    assert record is not None
    record.is_revoked = True
    db_session.commit()

    # Attempt to refresh using the revoked token
    response = client.post("/api/auth/refresh", json={"refresh_token": raw_token})
    assert response.status_code == 401
    detail = response.json().get("detail", {})
    assert detail.get("error", {}).get("code") == "SESSION_REVOKED"


def test_logout_clears_cookie_and_revokes(client: TestClient):
    """Verify /api/auth/logout revokes the token and deletes the cookie."""
    # 1. Login
    login_res = client.post(
        "/api/auth/login",
        json={"identifier": "Admin", "password": "Admin123", "remember_me": True},
    )
    assert login_res.status_code == 200

    # 2. Logout
    logout_res = client.post("/api/auth/logout", json={})
    assert logout_res.status_code == 200

    # 3. Subsequent refresh should fail
    refresh_res = client.post("/api/auth/refresh", json={})
    assert refresh_res.status_code == 401


def test_team_head_read_only_enforcement(client: TestClient, db_session: Session):
    """Verify Team Heads are strictly blocked with 403 on mutating requests."""
    # Find or temporarily set a Team Head
    head_user = db_session.query(User).filter(User.is_team_head.is_(True), User.role != "admin").first()
    if not head_user:
        head_user = User(
            name="Test Team Head",
            userid="test.head",
            email="test.head@navneet.com",
            password_hash="dummy_hash",
            role="user",
            team="marketing",
            is_team_head=True,
            is_active=True,
        )
        db_session.add(head_user)
        db_session.commit()

    head_token = create_access_token(
        subject=head_user.id,
        role=head_user.role,
        extra={"name": head_user.name, "userid": head_user.userid},
    )
    headers = {"Authorization": f"Bearer {head_token}"}

    # Attempt a POST request on a workflow endpoint
    response = client.post(
        "/api/v1/sample-requests/batch",
        json={"requests": []},
        headers=headers,
    )
    assert response.status_code == 403
    assert "Team heads have read-only access" in response.text

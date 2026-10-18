import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.auth.security import create_access_token
from app.models.master import User


@pytest.fixture(scope="session")
def db_session():
    """Provides a database session for tests."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session")
def client():
    """Provides an unauthenticated TestClient instance."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_headers(db_session: Session):
    """Provides Authorization headers for the root Admin user."""
    admin = db_session.query(User).filter(User.role == "admin").first()
    assert admin is not None, "Admin user must exist in the database for tests"
    token = create_access_token(
        subject=admin.id,
        role=admin.role,
        extra={"name": admin.name, "userid": admin.userid},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def marketing_headers(db_session: Session):
    """Provides Authorization headers for a Marketing team member."""
    user = db_session.query(User).filter(User.team == "marketing", User.is_team_head.is_(False)).first()
    if not user:
        user = db_session.query(User).filter(User.role != "admin").first()
    assert user is not None, "A regular user must exist in database"
    token = create_access_token(
        subject=user.id,
        role=user.role,
        extra={"name": user.name, "userid": user.userid},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def samp_headers(db_session: Session):
    """Provides Authorization headers for a SAMP team member."""
    user = db_session.query(User).filter(User.team.in_(["samp", "sampling"]), User.is_team_head.is_(False)).first()
    assert user is not None, "A SAMP user must exist in database"
    token = create_access_token(
        subject=user.id,
        role=user.role,
        extra={"name": user.name, "userid": user.userid},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def team_head_headers(db_session: Session):
    """Provides Authorization headers for a Team Head user."""
    user = db_session.query(User).filter(User.is_team_head.is_(True), User.role != "admin").first()
    assert user is not None, "A team head user must exist in database"
    token = create_access_token(
        subject=user.id,
        role=user.role,
        extra={"name": user.name, "userid": user.userid},
    )
    return {"Authorization": f"Bearer {token}"}

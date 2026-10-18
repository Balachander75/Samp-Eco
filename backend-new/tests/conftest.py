import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.auth.security import create_access_token, hash_password
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


def _get_or_create_user(
    db: Session,
    userid: str,
    name: str,
    email: str,
    role: str = "user",
    team: str = "marketing",
    is_team_head: bool = False,
) -> User:
    user = db.query(User).filter(User.userid == userid).first()
    if not user:
        user = User(
            name=name,
            userid=userid,
            email=email,
            password_hash=hash_password("Password123"),
            role=role,
            sub_role="Executive",
            team=team,
            is_team_head=is_team_head,
            plant_code="1505",
            theme_id="emerald",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@pytest.fixture(scope="session")
def admin_headers(db_session: Session):
    """Provides Authorization headers for the root Admin user."""
    admin = _get_or_create_user(
        db_session,
        userid="Admin",
        name="Administrator",
        email="admin.test@navneet.com",
        role="admin",
        team="Management",
        is_team_head=True,
    )
    token = create_access_token(
        subject=admin.id,
        role=admin.role,
        extra={"name": admin.name, "userid": admin.userid},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def marketing_headers(db_session: Session):
    """Provides Authorization headers for a Marketing team member."""
    user = _get_or_create_user(
        db_session,
        userid="TestMarketing",
        name="Marketing Tester",
        email="marketing.tester@navneet.com",
        role="user",
        team="marketing",
        is_team_head=False,
    )
    token = create_access_token(
        subject=user.id,
        role=user.role,
        extra={"name": user.name, "userid": user.userid},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def samp_headers(db_session: Session):
    """Provides Authorization headers for a SAMP team member."""
    user = _get_or_create_user(
        db_session,
        userid="TestSamp",
        name="Samp Specialist",
        email="samp.tester@navneet.com",
        role="user",
        team="samp",
        is_team_head=False,
    )
    token = create_access_token(
        subject=user.id,
        role=user.role,
        extra={"name": user.name, "userid": user.userid},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def team_head_headers(db_session: Session):
    """Provides Authorization headers for a Team Head user."""
    user = _get_or_create_user(
        db_session,
        userid="TestTeamHead",
        name="Team Head Tester",
        email="teamhead.tester@navneet.com",
        role="user",
        team="marketing",
        is_team_head=True,
    )
    token = create_access_token(
        subject=user.id,
        role=user.role,
        extra={"name": user.name, "userid": user.userid},
    )
    return {"Authorization": f"Bearer {token}"}

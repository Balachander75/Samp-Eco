from sqlalchemy import Column, Integer, String

from app.database import Base


class RequestCodeSequence(Base):
    """Transactional per-request-type numbering within each business year."""

    __tablename__ = "request_code_sequences"

    prefix = Column(String(8), primary_key=True)
    business_year_start = Column(Integer, primary_key=True)
    last_value = Column(Integer, nullable=False, default=0)

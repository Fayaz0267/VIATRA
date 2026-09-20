from sqlalchemy import Column, Integer, String, DateTime, Enum
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class OfficerStatus(str, enum.Enum):
    PENDING  = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class OfficerRole(str, enum.Enum):
    ADMIN   = "admin"
    OFFICER = "officer"

class Officer(Base):
    __tablename__ = "officers"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(100), nullable=False)
    email        = Column(String(150), unique=True, index=True, nullable=False)
    password     = Column(String(200), nullable=False)
    badge_number = Column(String(30), unique=True, nullable=True)
    rank         = Column(String(50), nullable=True)
    station      = Column(String(100), nullable=True)
    phone        = Column(String(20), nullable=True)
    role         = Column(String(20), default=OfficerRole.OFFICER)
    status       = Column(String(20), default=OfficerStatus.PENDING)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    approved_at  = Column(DateTime(timezone=True), nullable=True)

    def to_dict(self):
        return {
            "id":           self.id,
            "name":         self.name,
            "email":        self.email,
            "badge_number": self.badge_number,
            "rank":         self.rank,
            "station":      self.station,
            "phone":        self.phone,
            "role":         self.role,
            "status":       self.status,
            "created_at":   self.created_at.isoformat() if self.created_at else None,
        }

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

VIOLATION_TYPES = [
    "no_helmet", "triple_riding", "signal_jumping",
    "lane_violation", "wrong_way", "overspeeding", "both"
]

FINE_MAP = {
    "no_helmet":      500,
    "triple_riding":  1000,
    "signal_jumping": 1000,
    "lane_violation": 500,
    "wrong_way":      5000,
    "overspeeding":   2000,
    "both":           1500,
}

SECTION_MAP = {
    "no_helmet":      "Section 129 MV Act 1988",
    "triple_riding":  "Section 128 MV Act 1988",
    "signal_jumping": "Section 119 MV Act 1988",
    "lane_violation": "Section 112 MV Act 1988",
    "wrong_way":      "Section 119 MV Act 1988",
    "overspeeding":   "Section 112 MV Act 1988",
    "both":           "Section 128 & 129 MV Act 1988",
}

class Violation(Base):
    __tablename__ = "violations"

    id             = Column(Integer, primary_key=True, index=True)
    violation_type = Column(String(30),  nullable=False)
    plate_number   = Column(String(20),  nullable=True)
    confidence     = Column(Float,       nullable=False, default=0.0)
    rider_count    = Column(Integer,     default=1)
    track_id       = Column(Integer,     nullable=True)
    speed_kmh      = Column(Float,       nullable=True)
    location       = Column(String(200), default="Hyderabad, Telangana")
    legal_section  = Column(String(100), nullable=True)
    snapshot_path  = Column(String(500), nullable=True)
    challan_text   = Column(Text,        nullable=True)
    fine_amount    = Column(Integer,     default=1000)
    status         = Column(String(20),  default="open")
    notes          = Column(Text,        nullable=True)
    officer_id     = Column(Integer,     ForeignKey("officers.id"), nullable=True)
    all_violations = Column(String(200), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())

    def to_dict(self):
        return {
            "id":             self.id,
            "violation_type": self.violation_type,
            "plate_number":   self.plate_number,
            "confidence":     round(self.confidence, 3),
            "rider_count":    self.rider_count,
            "track_id":       self.track_id,
            "speed_kmh":      self.speed_kmh,
            "location":       self.location,
            "legal_section":  self.legal_section,
            "snapshot_path":  self.snapshot_path,
            "challan_text":   self.challan_text,
            "fine_amount":    self.fine_amount,
            "status":         self.status,
            "notes":          self.notes,
            "officer_id":     self.officer_id,
            "all_violations": self.all_violations,
            "created_at":     self.created_at.isoformat() if self.created_at else None,
            "updated_at":     self.updated_at.isoformat() if self.updated_at else None,
        }

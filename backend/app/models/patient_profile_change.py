from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class PatientProfileChange(Base):
    __tablename__ = "patient_profile_changes"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    field_name = Column(String(50), nullable=False)
    old_value_masked = Column(String(255), nullable=True)
    new_value_masked = Column(String(255), nullable=False)
    changed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

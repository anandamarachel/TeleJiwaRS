import enum

from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    proof_file_path = Column(String(500), nullable=False)
    status = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)

    consultation = relationship("Consultation", back_populates="payments")
    verified_by = relationship("Admin")
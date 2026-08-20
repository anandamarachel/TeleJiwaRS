import enum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class ConsultationStatus(str, enum.Enum):
    SCREENING = "screening"
    PAYMENT_PENDING = "payment_pending"
    PAYMENT_REJECTED = "payment_rejected"
    READY = "ready"
    ACTIVE = "active"
    COMPLETED = "completed"


class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    status = Column(Enum(ConsultationStatus), nullable=False, default=ConsultationStatus.SCREENING)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    patient = relationship("Patient", back_populates="consultations")
    doctor = relationship("Doctor", back_populates="consultations")
    screening = relationship("Screening", back_populates="consultation", uselist=False)
    payments = relationship("Payment", back_populates="consultation")
    note = relationship("ConsultationNote", back_populates="consultation", uselist=False)
    prescription = relationship("Prescription", back_populates="consultation", uselist=False)
    follow_up = relationship("FollowUp", back_populates="consultation", uselist=False)
    referral = relationship("Referral", back_populates="consultation", uselist=False)
    notifications = relationship("Notification", back_populates="consultation")
    chat_messages = relationship("ChatMessage", back_populates="consultation")
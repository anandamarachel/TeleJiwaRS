import enum

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class NotificationStatus(str, enum.Enum):
    LINK_GENERATED = "link_generated"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=False)
    message_text = Column(Text, nullable=False)
    status = Column(Enum(NotificationStatus), nullable=False, default=NotificationStatus.LINK_GENERATED)
    generated_by_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    consultation = relationship("Consultation", back_populates="notifications")
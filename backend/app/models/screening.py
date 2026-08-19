from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class ScreeningQuestion(Base):
    __tablename__ = "screening_questions"

    id = Column(Integer, primary_key=True)
    text = Column(Text, nullable=False)
    order_index = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    answers = relationship("ScreeningAnswer", back_populates="question")


class Screening(Base):
    __tablename__ = "screenings"

    id = Column(Integer, primary_key=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=False, unique=True)
    chief_complaint = Column(Text, nullable=False)
    total_score = Column(Integer, nullable=True)
    result_category = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    consultation = relationship("Consultation", back_populates="screening")
    answers = relationship("ScreeningAnswer", back_populates="screening")


class ScreeningAnswer(Base):
    __tablename__ = "screening_answers"
    __table_args__ = (
        UniqueConstraint("screening_id", "question_id", name="uq_screening_question"),
    )

    id = Column(Integer, primary_key=True)
    screening_id = Column(Integer, ForeignKey("screenings.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("screening_questions.id"), nullable=False)
    score_value = Column(Integer, nullable=False)

    screening = relationship("Screening", back_populates="answers")
    question = relationship("ScreeningQuestion", back_populates="answers")
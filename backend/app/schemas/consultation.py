from datetime import datetime

from pydantic import BaseModel

from app.models.consultation import ConsultationStatus


class ConsultationResponse(BaseModel):
    id: int
    status: str
    created_at: datetime
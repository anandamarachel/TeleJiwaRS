from datetime import datetime

from pydantic import BaseModel


class ChatMessageResponse(BaseModel):
    id: int
    sender_role: str
    message: str
    sent_at: datetime
    read_at: datetime | None

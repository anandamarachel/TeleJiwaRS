from datetime import datetime

from pydantic import BaseModel


class ChatMessageResponse(BaseModel):
    sender_role: str
    message: str
    sent_at: datetime
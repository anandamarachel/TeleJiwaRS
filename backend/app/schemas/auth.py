from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class UserInfoResponse(BaseModel):
    id: int
    email: str
    role: str
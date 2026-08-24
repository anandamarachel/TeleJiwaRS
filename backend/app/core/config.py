from pydantic_settings import BaseSettings, SettingsConfigDict
from decimal import Decimal

class Settings(BaseSettings):
    database_url: str
    secret_key: str
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"
    upload_dir: str = "uploads"
    consultation_fee: Decimal = Decimal("150000.00")
    cors_origins: str = "http://localhost:3000"
    smtp_host: str
    smtp_port: int = 587
    smtp_username: str
    smtp_password: str
    admin_notification_email: str
    smtp_from_email: str
    cookie_secure: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
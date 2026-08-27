from decimal import Decimal
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    environment: Literal["development", "test", "production"] = "development"
    database_url: str
    secret_key: str
    access_token_expire_minutes: int = 420
    algorithm: str = "HS256"
    upload_dir: str = "uploads"
    consultation_fee: Decimal = Decimal("150000.00")
    payment_bank_name: str = "BCA"
    payment_bank_account_number: str = "124232034"
    payment_bank_account_holder: str = "Rumah Sakit TeleJiwa"
    cors_origins: str = "http://localhost:3000"
    smtp_host: str
    smtp_port: int = 587
    smtp_username: str
    smtp_password: str
    admin_notification_email: str
    smtp_from_email: str
    cookie_secure: bool = False
    allowed_hosts: str = "localhost,127.0.0.1,testserver"
    max_chat_message_chars: int = 4000
    websocket_messages_per_minute: int = 60

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def allowed_host_list(self) -> list[str]:
        return [host.strip() for host in self.allowed_hosts.split(",") if host.strip()]

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.environment != "production":
            return self

        if not self.cookie_secure:
            raise ValueError("COOKIE_SECURE must be true in production")
        if len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must contain at least 32 characters in production")
        if any(origin == "*" or "localhost" in origin for origin in self.cors_origin_list):
            raise ValueError("CORS_ORIGINS must contain only explicit production origins")
        if not self.allowed_host_list or "*" in self.allowed_host_list:
            raise ValueError("ALLOWED_HOSTS must contain explicit production hosts")
        if (
            self.payment_bank_account_number == "124232034"
            or self.payment_bank_account_holder == "Rumah Sakit TeleJiwa"
        ):
            raise ValueError("Production payment bank details must replace development defaults")
        return self

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

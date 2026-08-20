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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    database_url: str
    secret_key: str

    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    qdrant_url: str
    qdrant_api_key: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
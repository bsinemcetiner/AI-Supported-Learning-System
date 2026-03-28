from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Learning Assistant API"
    secret_key: str = "change-this-in-production-please"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 gün

    class Config:
        env_file = ".env"


settings = Settings()

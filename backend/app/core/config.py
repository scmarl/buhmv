from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://buhmv:buhmv@db:5432/buhmv"
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ALGORITHM: str = "HS256"
    APP_NAME: str = "BuHMV"

    class Config:
        env_file = ".env"


settings = Settings()

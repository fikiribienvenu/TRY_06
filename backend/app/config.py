from pydantic_settings import BaseSettings
from typing import List
import secrets


class Settings(BaseSettings):
    # App
    APP_NAME: str = "PulmoScan AI"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    FRONTEND_URL: str = "http://localhost:3000"

    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "pulmoscan"

    # JWT
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_REFRESH_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@pulmoscan.ai"
    EMAIL_FROM_NAME: str = "PulmoScan AI"

    # Gemini
    GEMINI_API_KEY: str = ""

    # File Upload
    MAX_FILE_SIZE_MB: int = 50
    UPLOAD_DIR: str = "uploads"
    ALLOWED_EXTENSIONS: List[str] = ["jpg", "jpeg", "png", "dcm"]

    # Director bootstrap
    DIRECTOR_EMAIL: str = "director@pulmoscan.ai"
    DIRECTOR_DEFAULT_PASSWORD: str = "Director@2024!"
    DIRECTOR_FIRST_NAME: str = "System"
    DIRECTOR_LAST_NAME: str = "Director"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

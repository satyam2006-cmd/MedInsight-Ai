import os
from typing import Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    """Application settings using Pydantic for validation"""
    APP_NAME: str = "MedInsight AI"
    APP_VERSION: str = "2.0.0"
    
    # API Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY") or os.getenv("Gemini_API_KEY") or ""
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    
    # App Settings
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    CORS_ALLOW_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ALLOW_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ]
    
    # File Constraints
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: set = {".jpg", ".jpeg", ".png", ".pdf"}
    ALLOWED_MIME_TYPES: set = {
        "image/jpeg",
        "image/png",
        "application/pdf",
    }
    MAX_TTS_TEXT_LENGTH: int = 3000

    class Config:
        case_sensitive = True

settings = Settings()

# Diagnostic logging for deployment
import logging
diagnostic_logger = logging.getLogger("app.config")
if settings.GEMINI_API_KEY:
    diagnostic_logger.info("✅ GEMINI_API_KEY loaded successfully")
else:
    diagnostic_logger.error("❌ GEMINI_API_KEY NOT FOUND in environment variables!")
diagnostic_logger.info(f"Using Model: {settings.GEMINI_MODEL}")

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
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    
    # App Settings
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # File Constraints
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: set = {".jpg", ".jpeg", ".png", ".pdf"}

    class Config:
        case_sensitive = True

settings = Settings()

# Diagnostic logging for deployment
import logging
diagnostic_logger = logging.getLogger("app.config")
if settings.GEMINI_API_KEY:
    masked = f"{settings.GEMINI_API_KEY[:4]}...{settings.GEMINI_API_KEY[-4:]}"
    diagnostic_logger.info(f"✅ GEMINI_API_KEY loaded successfully. Masked: {masked}")
else:
    diagnostic_logger.error("❌ GEMINI_API_KEY NOT FOUND in environment variables!")
diagnostic_logger.info(f"Using Model: {settings.GEMINI_MODEL}")

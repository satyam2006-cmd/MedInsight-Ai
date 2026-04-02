import os
from fastapi import HTTPException
from ..config import settings

def validate_medical_file(filename: str, file_size: int):
    """Checks if file extension and size are allowed"""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type. Allowed: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )
    
    if file_size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413, 
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE // (1024*1024)}MB"
        )


def validate_medical_mime_type(content_type: str):
    """Checks if MIME type is allowed for uploaded medical documents."""
    normalized = (content_type or "").strip().lower()
    if normalized not in settings.ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported content type. Allowed: "
                + ", ".join(sorted(settings.ALLOWED_MIME_TYPES))
            ),
        )

def sanitize_text(text: str) -> str:
    """Basic text sanitization to prevent prompt injection or issues"""
    # Simply stripping extra whitespace and potential control chars for now
    return " ".join(text.split())

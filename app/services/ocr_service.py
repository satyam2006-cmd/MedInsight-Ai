import logging

logger = logging.getLogger(__name__)

class OCRService:
    """
    Lightweight OCR Service stub.
    Text extraction is primarily handled by the frontend (Tesseract.js/PDF.js).
    If frontend extraction fails, Gemini's native multimodal vision is used as fallback.
    """
    
    def __init__(self):
        logger.info("OCRService (Frontend-first) initialized.")

    def extract_text(self, file_content: bytes) -> str:
        """
        Returns empty string to trigger Gemini's native multimodal OCR 
        if frontend text was not provided.
        """
        return ""

ocr_service = OCRService()

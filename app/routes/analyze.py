from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from ..ai_engine import ai_engine
from ..services.ocr_service import ocr_service
from ..utils.validators import validate_medical_file
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/analyze-report")
async def analyze_report(
    file: UploadFile = File(...),
    extracted_text: str = Form(None),
    target_language: str = Form("Hindi")
):
    """
    Endpoint to process medical reports using OCR and Gemini.
    """
    # 1. Validate File
    file_content = await file.read()
    validate_medical_file(file.filename, len(file_content))
    
    try:
        # 2. Extract Text if not provided by Frontend
        if not extracted_text:
            logger.info(f"Extracting text from {file.filename} using PaddleOCR...")
            extracted_text = ocr_service.extract_text(file_content)
        
        # 3. Analyze with Gemini
        mime_type = file.content_type or "application/octet-stream"
        
        analysis = await ai_engine.analyze_medical_document(
            file_content=file_content,
            mime_type=mime_type,
            target_language=target_language,
            extracted_text=extracted_text
        )
        
        # 4. Final Response
        return analysis.dict()

    except Exception as e:
        logger.error(f"Error in /analyze-report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

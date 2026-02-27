from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from ..ai_engine import ai_engine
from ..utils.validators import validate_medical_file
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Map internal schema field name to the displayed label if needed
# But AIEngine now handles the translation dynamically

@router.post("/analyze-report")
async def analyze_report(
    file: UploadFile = File(...),
    extracted_text: str = Form(None),
    target_language: str = Form("Hindi")
):
    """
    Endpoint to process medical reports using Gemini Multimodal Vision.
    """
    # 1. Validate File
    file_content = await file.read()
    validate_medical_file(file.filename, len(file_content))
    
    try:
        # 2. Analyze with Gemini Multimodal
        mime_type = file.content_type or "application/octet-stream"
        
        # We use await here as we refactored ai_engine to be async-friendly
        analysis = await ai_engine.analyze_medical_document(
            file_content=file_content,
            mime_type=mime_type,
            target_language=target_language,
            extracted_text=extracted_text
        )
        
        # 3. Final Response
        return analysis.dict()

    except Exception as e:
        logger.error(f"Error in /analyze-report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

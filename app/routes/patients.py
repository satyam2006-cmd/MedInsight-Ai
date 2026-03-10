from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Header, Depends
from typing import Optional
import logging
from ..services.db_service import get_supabase_client, db_service
from ..ai_engine import ai_engine
from ..services.ocr_service import ocr_service

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/patients")
async def create_patient_and_report(
    authorization: str = Header(..., description="JWT Bearer Token from Frontend"),
    patient_id: str = Form(...),
    patient_name: str = Form(...),
    patient_number: str = Form(...),
    language: str = Form("English"),
    report_file: UploadFile = File(...)
):
    """
    Creates a patient and a linked report by extracting text from the file 
    and generating an AI analysis in the requested language.
    """
    try:
        # 0. Initialize user-scoped Supabase client
        supabase = get_supabase_client(authorization)
        
        # 1. Create Patient
        logger.info(f"Creating patient record for {patient_name}...")
        patient_record = db_service.create_patient(
            supabase=supabase,
            name=patient_name,
            number=patient_number
        )
        
        new_patient_db_id = patient_record.get("id")
        
        # 2. Extract Text from document
        file_content = await report_file.read()
        logger.info(f"Extracting text from {report_file.filename} using PaddleOCR...")
        extracted_text = ocr_service.extract_text(file_content)
        
        # 3. Analyze with Gemini
        logger.info(f"Analyzing extracted text with AI (Language: {language})...")
        mime_type = report_file.content_type or "application/octet-stream"
        
        analysis_result = await ai_engine.analyze_medical_document(
            file_content=file_content,
            mime_type=mime_type,
            target_language=language,
            extracted_text=extracted_text
        )
        
        # 4. Save Report Linked to Patient
        logger.info(f"Saving report analysis for patient ID: {new_patient_db_id}...")
        report_record = db_service.create_report(
            supabase=supabase,
            patient_id=new_patient_db_id,
            extracted_text=extracted_text,
            analysis=analysis_result.dict()
        )
        
        # 5. Return success back to frontend
        return {
            "status": "success",
            "message": "Patient records and AI report saved successfully.",
            "patient": patient_record,
            "report_summary": report_record
        }

    except Exception as e:
        logger.error(f"Error in POST /patients: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/patients")
async def get_patients(authorization: str = Header(...)):
    """
    Fetches all patients for the user (hospital).
    """
    try:
        supabase = get_supabase_client(authorization)
        # Fetch patients with their reports
        response = supabase.table("patients").select("*, reports(*)").execute()
        return response.data
    except Exception as e:
        logger.error(f"Error fetching patients: {e}")
        raise HTTPException(status_code=500, detail=str(e))

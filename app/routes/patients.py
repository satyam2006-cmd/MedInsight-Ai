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
    language: Optional[str] = Form(None),
    report_file: UploadFile = File(...)
):
    """
    Creates a patient and a linked report by extracting text from the file 
    and generating an AI analysis in the requested language.
    """
    try:
        # 0. Initialize user-scoped Supabase client
        supabase = get_supabase_client(authorization)

        auth_response = supabase.auth.get_user()
        user = auth_response.user if auth_response and auth_response.user else None
        profile_language = ""
        if user and user.user_metadata:
            profile_language = user.user_metadata.get("preferred_language") or user.user_metadata.get("language") or ""
        resolved_language = (language or profile_language or "").strip()
        if not resolved_language:
            raise HTTPException(status_code=400, detail="Target language is required. Set preferred language in profile or provide language.")
        
        # 1. Create Patient
        logger.info(f"Creating patient record for {patient_name}...")
        patient_record = db_service.create_patient(
            supabase=supabase,
            name=patient_name,
            number=patient_number,
            custom_id=patient_id
        )
        
        new_patient_db_id = patient_record.get("id")
        
        # 2. Extract Text from document
        file_content = await report_file.read()
        logger.info(f"Extracting text from {report_file.filename} using PaddleOCR...")
        extracted_text = ocr_service.extract_text(file_content)
        
        # 3. Analyze with Gemini
        logger.info(f"Analyzing extracted text with AI (Language: {resolved_language})...")
        mime_type = report_file.content_type or "application/octet-stream"
        
        analysis_result = await ai_engine.analyze_medical_document(
            file_content=file_content,
            mime_type=mime_type,
            target_language=resolved_language,
            extracted_text=extracted_text
        )

        # 3.1. Fetch User Metadata for branding injection
        try:
            if user:
                # Determine profile name based on account type or available data
                account_type = user.user_metadata.get("account_type", "hospital")
                h_name = user.user_metadata.get("hospital_name", "")
                f_name = user.user_metadata.get("full_name", "")
                u_name = user.user_metadata.get("admin_username", "")
                
                # Logical fallback: Hospital Name -> Full Name -> Username
                branding_name = h_name or f_name or u_name or "Medical Professional"
                
                phone = f"{user.user_metadata.get('country_code', '')} {user.user_metadata.get('phone', '')}".strip() if user.user_metadata else ""
                hospital_info = {
                    "hospital_name": branding_name,
                    "admin_name": u_name,
                    "email": user.email or "",
                    "phone": phone
                }
                analysis_result.hospital_details = hospital_info
        except Exception as auth_err:
            logger.warning(f"Failed to fetch user metadata for branding: {auth_err}")

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
        
        # 1. Fetch caller's account type to handle privacy rules
        user_type = "hospital"
        try:
            auth_res = supabase.auth.get_user()
            if auth_res and auth_res.user:
                user_type = auth_res.user.user_metadata.get("account_type", "hospital")
        except Exception: pass

        # 2. Fetch patients with their reports
        response = supabase.table("patients").select("*, reports(*)").execute()
        patients = response.data or []
        
        # 3. Privacy Filter: Hospitals should NOT see vitals-sourced reports
        if user_type == "hospital":
            for p in patients:
                if "reports" in p:
                    p["reports"] = [
                        r for r in p["reports"] 
                        if not (r.get("analysis") and isinstance(r["analysis"], dict) and r["analysis"].get("source") == "vitals_live")
                    ]
        
        return patients
    except Exception as e:
        logger.error(f"Error fetching patients: {e}")
        raise HTTPException(status_code=500, detail=str(e))


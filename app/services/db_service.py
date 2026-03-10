import logging
from supabase import create_client, Client
from ..config import settings

logger = logging.getLogger(__name__)

def get_supabase_client(jwt_token: str = None) -> Client:
    """
    Initializes a Supabase client.
    If a jwt_token is provided, it sets the session to act on behalf of the user 
    (required for Row Level Security to work).
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        logger.error("Supabase URL or Key not found in environment variables.")
        raise ValueError("Database configuration missing")
    
    # Initialize the client with the anon key
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    
    if jwt_token:
        # We strip Bearer if it's there
        token = jwt_token.replace("Bearer ", "") if jwt_token.startswith("Bearer ") else jwt_token
        # Set the session so RLS policies know who auth.uid() is
        supabase.auth.set_session(access_token=token, refresh_token="")
        
    return supabase

class DBService:
    @staticmethod
    def create_patient(supabase: Client, name: str, number: str, hospital_id: str = None):
        """Creates a patient record in the database."""
        data = {
            "patient_name": name,
            "patient_number": number,
        }
        # If running without JWT context but passing hospital_id explicitly (Service role or testing)
        if hospital_id:
            data["hospital_id"] = hospital_id
            
        try:
            # We use upsert on (hospital_id, patient_number) to avoid duplicates
            # hospital_id is handled by RLS on INSERT but for UPSERT we might need to be explicit 
            # or rely on the constraint we're about to add.
            response = supabase.table("patients").upsert(data, on_conflict="patient_number").execute()
            if response.data and len(response.data) > 0:
                return response.data[0]
            raise ValueError("Failed to upsert patient")
        except Exception as e:
            logger.error(f"Error creating patient: {e}")
            raise

    @staticmethod
    def create_report(supabase: Client, patient_id: str, extracted_text: str, analysis: dict):
        """Creates a report record linking to the patient_id."""
        data = {
            "patient_id": patient_id,
            "report_text": extracted_text,
            "analysis": analysis,
            "file_url": "extracted_from_local", # Stamping since file storage is skipped
            "status": "Analyzed",
            "risk_level": analysis.get("risk_level", "Unknown") if isinstance(analysis, dict) else "Unknown"
        }
        try:
            response = supabase.table("reports").insert(data).execute()
            if response.data and len(response.data) > 0:
                return response.data[0]
            raise ValueError("Failed to insert report")
        except Exception as e:
            logger.error(f"Error creating report: {e}")
            raise

db_service = DBService()

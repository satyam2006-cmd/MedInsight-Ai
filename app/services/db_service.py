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
    def create_patient(supabase: Client, name: str, number: str, custom_id: str = None, hospital_id: str = None):
        """Creates a patient record in the database."""
        data = {
            "patient_name": name,
            "patient_number": number,
            "patient_custom_id": custom_id
        }
        # If running without JWT context but passing hospital_id explicitly (Service role or testing)
        if hospital_id:
            data["hospital_id"] = hospital_id
            
        try:
            # Reverted to standard insert to avoid 42P10 constraint errors.
            # Use the Delete button in the UI to manage duplicates as requested.
            response = supabase.table("patients").insert(data).execute()
            if response.data and len(response.data) > 0:
                return response.data[0]
            raise ValueError("Failed to insert patient")
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

    @staticmethod
    def create_vitals_session(
        supabase: Client,
        session_id: str,
        patient_id: str,
        device_label: str,
        condition_tag: str,
        summary: dict,
        samples: list,
    ):
        data = {
            "id": session_id,
            "patient_id": patient_id,
            "device_label": device_label,
            "condition_tag": condition_tag,
            "summary": summary,
            "samples": samples,
        }
        try:
            response = supabase.table("vitals_sessions").insert(data).execute()
            if response.data and len(response.data) > 0:
                return response.data[0]
            raise ValueError("Failed to insert vitals session")
        except Exception as e:
            logger.error(f"Error creating vitals session: {e}")
            raise

    @staticmethod
    def get_vitals_session(supabase: Client, session_id: str):
        try:
            response = (
                supabase.table("vitals_sessions")
                .select("id, samples, summary")
                .eq("id", session_id)
                .limit(1)
                .execute()
            )
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Error fetching vitals session: {e}")
            raise

    @staticmethod
    def create_reference_readings(
        supabase: Client,
        session_id: str,
        device_name: str,
        condition_tag: str,
        readings: list,
    ):
        data = {
            "session_id": session_id,
            "device_name": device_name,
            "condition_tag": condition_tag,
            "readings": readings,
        }
        try:
            response = supabase.table("reference_readings").insert(data).execute()
            if response.data and len(response.data) > 0:
                return response.data[0]
            raise ValueError("Failed to insert reference readings")
        except Exception as e:
            logger.error(f"Error creating reference readings: {e}")
            raise

    @staticmethod
    def get_reference_reading_set(supabase: Client, reference_id: str):
        try:
            response = (
                supabase.table("reference_readings")
                .select("id, session_id, readings")
                .eq("id", reference_id)
                .limit(1)
                .execute()
            )
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Error fetching reference reading set: {e}")
            raise

    @staticmethod
    def create_accuracy_metric(
        supabase: Client,
        session_id: str,
        reference_id: str,
        hr_metrics: dict,
        rr_metrics: dict,
        spo2_metrics: dict,
    ):
        data = {
            "session_id": session_id,
            "reference_id": reference_id,
            "hr_metrics": hr_metrics,
            "rr_metrics": rr_metrics,
            "spo2_metrics": spo2_metrics,
        }
        try:
            response = supabase.table("accuracy_metrics").insert(data).execute()
            if response.data and len(response.data) > 0:
                return response.data[0]
            raise ValueError("Failed to insert accuracy metric")
        except Exception as e:
            logger.error(f"Error creating accuracy metric: {e}")
            raise


db_service = DBService()

from pydantic import BaseModel, Field
from typing import List, Optional

class HospitalDetails(BaseModel):
    """Metadata about the hospital providing the report"""
    hospital_name: str = Field(..., description="Name of the hospital")
    admin_name: str = Field(..., description="Name of the hospital administrator")
    email: str = Field(..., description="Contact email")
    phone: str = Field(..., description="Contact phone number")

class MedicalEntities(BaseModel):
    """Structured medical entities extracted from the report"""
    symptoms: List[str] = Field(default_factory=list)
    medications: List[str] = Field(default_factory=list)
    vital_signs: List[str] = Field(default_factory=list)

class MedicalAnalysisRequest(BaseModel):
    """Schema for incoming analysis requests (though files are handled via multipart)"""
    pass

class HealthResponse(BaseModel):
    """Schema for health check endpoint"""
    status: str
    version: str

class AnalysisResponse(BaseModel):
    """Structured output for medical report analysis"""
    summary: str = Field(..., description="A simple, patient-friendly summary of the medical document.")
    hindi_translation: str = Field(..., description="The summary translated into the target language.")
    target_language: str = Field("English", description="The language the report was translated into.")
    risk_level: str = Field(..., description="Risk classification: Low, Medium, or High.")
    key_findings: List[str] = Field(..., description="List of key medical findings extracted from the document.")
    potential_concerns: List[str] = Field(..., description="List of potential health concerns to highlight (non-diagnostic).")
    medical_entities: Optional[MedicalEntities] = Field(None, description="Structured medical entities like symptoms and meds.")
    hospital_details: Optional[HospitalDetails] = Field(None, description="Injects branding and contact info into the report analysis.")

class ErrorResponse(BaseModel):
    """Standard error response schema"""
    error: str
    detail: Optional[str] = None


class VitalsSample(BaseModel):
    timestamp_sec: float = Field(..., ge=0, description="Relative time in seconds from session start.")
    hr: Optional[float] = Field(None, description="Heart rate in BPM.")
    rr: Optional[float] = Field(None, description="Respiration rate in breaths/min.")
    spo2: Optional[float] = Field(None, description="SpO2 in percentage.")
    signal_quality: Optional[float] = Field(None, ge=0, le=100)
    confidence: Optional[float] = Field(None, ge=0, le=100)


class SaveVitalsSessionRequest(BaseModel):
    session_id: Optional[str] = Field(None, description="Explicit vitals session id from websocket stream.")
    patient_id: Optional[str] = Field(None, description="Optional patient identifier for linking session data.")
    device_label: str = Field("webcam-rppg", description="Capture device label.")
    condition_tag: str = Field("general", description="Condition label such as rest/walking/daylight.")


class ReferenceReading(BaseModel):
    timestamp_sec: float = Field(..., ge=0, description="Relative time in seconds from session start.")
    hr: Optional[float] = Field(None, ge=0)
    rr: Optional[float] = Field(None, ge=0)
    spo2: Optional[float] = Field(None, ge=0, le=100)


class CreateReferenceReadingsRequest(BaseModel):
    session_id: str
    device_name: str = Field("Apple Watch", description="Reference device name.")
    condition_tag: str = Field("general", description="Condition label for benchmark grouping.")
    readings: List[ReferenceReading] = Field(default_factory=list)


class MetricBundle(BaseModel):
    count: int
    mae: Optional[float] = None
    rmse: Optional[float] = None
    mape: Optional[float] = None
    correlation: Optional[float] = None
    within_tolerance_pct: Optional[float] = None


class CompareVitalsResponse(BaseModel):
    session_id: str
    reference_id: str
    hr: MetricBundle
    rr: MetricBundle
    spo2: MetricBundle


class LiveCalibrationRequest(BaseModel):
    session_id: str
    reference_id: str
    metrics: List[str] = Field(default_factory=lambda: ["hr", "rr", "spo2"])

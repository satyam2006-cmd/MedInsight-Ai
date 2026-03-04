from pydantic import BaseModel, Field
from typing import List, Optional

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
    hindi_translation: str = Field(..., description="The summary translated into Hindi.")
    risk_level: str = Field(..., description="Risk classification: Low, Medium, or High.")
    key_findings: List[str] = Field(..., description="List of key medical findings extracted from the document.")
    potential_concerns: List[str] = Field(..., description="List of potential health concerns to highlight (non-diagnostic).")
    medical_entities: Optional[MedicalEntities] = Field(None, description="Structured medical entities like symptoms and meds.")

class ErrorResponse(BaseModel):
    """Standard error response schema"""
    error: str
    detail: Optional[str] = None

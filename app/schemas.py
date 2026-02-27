from pydantic import BaseModel, Field
from typing import List, Optional

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

class ErrorResponse(BaseModel):
    """Standard error response schema"""
    error: str
    detail: Optional[str] = None

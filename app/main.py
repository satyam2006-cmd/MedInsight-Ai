from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import analyze, tts, patients
from .config import settings
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Production-grade medical report analyzer using Google Vision and Gemini.",
    docs_url="/docs",
    openapi_url="/openapi.json"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(analyze.router, tags=["Analysis"])
app.include_router(tts.router, tags=["TTS"])
app.include_router(patients.router, tags=["Patients"])

@app.get("/health")
async def health():
    return {
        "status": "healthy", 
        "version": settings.APP_VERSION,
        "timestamp": "2026-03-10T20:45:00", # Manually updated to verify sync
        "features": ["analysis", "tts", "patients"]
    }

@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)

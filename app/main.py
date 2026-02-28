from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import analyze, tts
from .config import settings
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Production-grade medical report analyzer using Google Vision and Gemini."
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(analyze.router, tags=["Analysis"])
app.include_router(tts.router, tags=["TTS"])

@app.get("/health")
async def health():
    return {"status": "healthy", "version": settings.APP_VERSION}

@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from ..services.tts_service import tts_service
from ..config import settings
import logging
import re

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/tts")
async def get_tts(
    text: str = Query(..., description="Text to convert to speech"),
    lang: str = Query("en", description="Language code for the text")
):
    """
    Generates speech from text and returns it as a streaming audio response.
    """
    if not text:
        raise HTTPException(status_code=400, detail="Text parameter is required")

    if len(text) > settings.MAX_TTS_TEXT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Text is too long. Max length is {settings.MAX_TTS_TEXT_LENGTH} characters",
        )

    if not re.match(r"^[a-z]{2,8}(-[A-Za-z]{2,8})?$", lang):
        raise HTTPException(status_code=400, detail="Invalid language code")

    try:
        audio_stream = await tts_service.generate_audio(text, lang)
        # Get the size of the BytesIO stream
        content_length = audio_stream.getbuffer().nbytes
        
        return StreamingResponse(
            audio_stream,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f"inline; filename=tts_{lang}.mp3",
                "Content-Length": str(content_length)
            }
        )
    except Exception:
        logger.exception("TTS route error")
        raise HTTPException(status_code=500, detail="Failed to generate speech")

import edge_tts
import io
import asyncio
import logging

logger = logging.getLogger(__name__)

class TTSService:
    """Handles Text-to-Speech conversion using Edge-TTS (Neural Voices)."""

    def __init__(self):
        # Mapping common language names to Edge-TTS neural voices
        # Using gender-neutral or high-quality options where possible
        self.VOICE_MAP = {
            'hindi': 'hi-IN-MadhurNeural',
            'marathi': 'mr-IN-ManoharNeural',
            'bengali': 'bn-IN-BashkarNeural',
            'tamil': 'ta-IN-ValluvarNeural',
            'telugu': 'te-IN-MohanNeural',
            'kannada': 'kn-IN-GaganNeural',
            'gujarati': 'gu-IN-NiranjanNeural',
            'malayalam': 'ml-IN-MidhunNeural',
            'punjabi': 'pa-IN-GurumaNeural',
            'english': 'en-US-AndrewNeural',
            'spanish': 'es-ES-AlvaroNeural',
            'french': 'fr-FR-HenriNeural',
            'german': 'de-DE-ConradNeural',
            'chinese': 'zh-CN-YunxiNeural',
            'japanese': 'ja-JP-KeitaNeural',
            'korean': 'ko-KR-HyunsuNeural',
            'russian': 'ru-RU-DmitryNeural'
        }

    async def generate_audio(self, text: str, lang: str = 'en') -> io.BytesIO:
        """
        Converts text to speech asynchronously and returns a BytesIO object.
        """
        lang_lower = lang.lower().strip()
        voice = self.VOICE_MAP.get(lang_lower, self.VOICE_MAP['english'])

        try:
            logger.info(f"Generating Edge-TTS for text in '{lang}' using voice '{voice}'...")
            
            communicate = edge_tts.Communicate(text, voice)
            audio_data = b""
            
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data += chunk["data"]
            
            if not audio_data:
                raise Exception("No audio data received from Edge-TTS")

            audio_fp = io.BytesIO(audio_data)
            audio_fp.seek(0)
            return audio_fp

        except Exception as e:
            logger.error(f"Edge-TTS generation failed for '{lang}': {str(e)}")
            # Fallback for English if a specific language fails
            if voice != self.VOICE_MAP['english']:
                return await self.generate_audio(text, 'english')
            raise e

tts_service = TTSService()

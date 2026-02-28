from gtts import gTTS
import io
import logging

logger = logging.getLogger(__name__)

class TTSService:
    """Handles Text-to-Speech conversion using gTTS."""

    def generate_audio(self, text: str, lang: str = 'en') -> io.BytesIO:
        """
        Converts text to speech and returns a BytesIO object containing the MP3 data.
        """
        # Mapping language names/codes to gTTS supported codes
        ISO_MAP = {
            'hindi': 'hi', 'marathi': 'mr', 'bengali': 'bn', 'tamil': 'ta', 
            'telugu': 'te', 'kannada': 'kn', 'gujarati': 'gu', 'punjabi': 'pa',
            'malayalam': 'ml', 'spanish': 'es', 'french': 'fr', 'german': 'de',
            'chinese': 'zh-CN', 'japanese': 'ja', 'korean': 'ko', 'russian': 'ru',
            'english': 'en'
        }
        
        lang_lower = lang.lower().strip()
        target_code = ISO_MAP.get(lang_lower, lang_lower)

        try:
            logger.info(f"Generating TTS for text in '{lang}' (code: {target_code})...")
            tts = gTTS(text=text, lang=target_code)
            
            audio_fp = io.BytesIO()
            tts.write_to_fp(audio_fp)
            audio_fp.seek(0)
            
            return audio_fp
        except Exception as e:
            logger.error(f"TTS generation failed for '{lang}' ({target_code}): {str(e)}")
            # Fallback to English if original language fails
            if target_code != 'en':
                return self.generate_audio(text, 'en')
            raise e

tts_service = TTSService()

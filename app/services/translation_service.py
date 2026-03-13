from deep_translator import GoogleTranslator
import logging

logger = logging.getLogger(__name__)

class TranslationService:
    """Handles text translation using Google Translate (via deep-translator)"""
    
    def translate_text(self, text: str, target_lang: str) -> str:
        """
        Translates text from English to the target language.
        If translation fails, it returns the original text as a fallback.
        """
        if not text or not target_lang or target_lang.lower() == 'english':
            return text
            
        # Comprehensive mapping to handle various ways users might type language names
        ISO_MAP = {
            'hindi': 'hi', 'marathi': 'mr', 'bengali': 'bn', 'tamil': 'ta', 
            'telugu': 'te', 'kannada': 'kn', 'gujarati': 'gu', 'punjabi': 'pa',
            'malayalam': 'ml', 'spanish': 'es', 'french': 'fr', 'german': 'de',
            'chinese': 'zh-CN', 'japanese': 'ja', 'korean': 'ko', 'russian': 'ru'
        }
        
        lang_lower = target_lang.lower().strip()
        target_code = ISO_MAP.get(lang_lower, lang_lower)

        try:
            logger.info(f"Translating text to '{target_lang}' (code: {target_code})...")
            translator = GoogleTranslator(source='en', target=target_code)
            translated = translator.translate(text)
            return translated
        except Exception as e:
            logger.error(f"Translation failed for '{target_lang}' ({target_code}): {str(e)}")
            return text

translation_service = TranslationService()

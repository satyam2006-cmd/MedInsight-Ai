try:
    from paddleocr import PaddleOCR
    import numpy as np
    import cv2
    from PIL import Image
    PADDLE_AVAILABLE = True
except ImportError:
    PADDLE_AVAILABLE = False

import io
import logging
import os

# Python 3.13 Workaround for PaddleOCR's modelscope dependency
os.environ["HUB_DATASET_ENDPOINT"] = "https://www.modelscope.cn"
# Disable connectivity check for faster startup
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

logger = logging.getLogger(__name__)

class OCRService:
    """Handles Optical Character Recognition. Falls back to Gemini if Paddle is unavailable."""
    
    def __init__(self):
        self.ocr = None
        if PADDLE_AVAILABLE:
            try:
                self.ocr = PaddleOCR(use_angle_cls=True, lang='en')
                logger.info("PaddleOCR initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize PaddleOCR: {str(e)}")
        else:
            logger.info("PaddleOCR not installed. Relying on Gemini native OCR.")

    def extract_text(self, file_content: bytes) -> str:
        """
        Extracts text from image content. Returns empty string if Paddle is unavailable, 
        triggering Gemini's native multimodal OCR.
        """
        if not self.ocr:
            return ""

        try:
            image = Image.open(io.BytesIO(file_content)).convert('RGB')
            img_array = np.array(image)
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

            result = self.ocr.ocr(img_array, cls=True)
            
            extracted_lines = []
            if result and result[0]:
                for line in result[0]:
                    extracted_lines.append(line[1][0])
            
            return "\n".join(extracted_lines)

        except Exception as e:
            logger.error(f"OCR extraction failed: {str(e)}")
            return ""

ocr_service = OCRService()

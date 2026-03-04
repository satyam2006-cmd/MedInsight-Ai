from paddleocr import PaddleOCR
import numpy as np
import cv2
from PIL import Image
import io
import logging

import os

# Python 3.13 Workaround for PaddleOCR's modelscope dependency
os.environ["HUB_DATASET_ENDPOINT"] = "https://www.modelscope.cn"
# Disable connectivity check for faster startup
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

logger = logging.getLogger(__name__)

class OCRService:
    """Handles Optical Character Recognition using PaddleOCR"""
    
    def __init__(self):
        try:
            # Initialize PaddleOCR with English language
            # use_angle_cls=True helps with rotated documents
            # Note: In PaddleOCR 3.0, 'show_log' and 'use_gpu' might be handled differently 
            # or removed from the constructor in some configurations.
            self.ocr = PaddleOCR(use_angle_cls=True, lang='en')
            logger.info("PaddleOCR initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize PaddleOCR: {str(e)}")
            self.ocr = None

    def extract_text(self, file_content: bytes) -> str:
        """
        Extracts text from image content (as bytes)
        """
        if not self.ocr:
            logger.warning("OCR engine not initialized. Returning empty string.")
            return ""

        try:
            # Convert bytes to a format PaddleOCR accepts (numpy array)
            image = Image.open(io.BytesIO(file_content)).convert('RGB')
            img_array = np.array(image)
            # PaddleOCR expects BGR format from cv2
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

            result = self.ocr.ocr(img_array, cls=True)
            
            extracted_lines = []
            if result and result[0]:
                for line in result[0]:
                    # line[1][0] contains the text
                    extracted_lines.append(line[1][0])
            
            return "\n".join(extracted_lines)

        except Exception as e:
            logger.error(f"OCR extraction failed: {str(e)}")
            return ""

ocr_service = OCRService()

import { autoPreprocess, preprocessForOCR } from '../utils/imagePreprocessing.js';
import { OCRError, ErrorFactory, validateFile } from '../utils/errorHandling.js';

/**
 * Tesseract.js OCR Service
 */

const PROCESSING_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// Lazy-load Tesseract.js only when needed
let tesseractModule = null;

async function getTesseract() {
  if (!tesseractModule) {
    tesseractModule = await import('tesseract.js');
  }
  return tesseractModule;
}

export const extractTextFromImage = async (
  file,
  onProgress,
  usePreprocessing = true
) => {
  if (file.size > PROCESSING_MAX_SIZE_BYTES) {
    throw new Error(
      'Files larger than 20MB are not supported for processing.'
    );
  }

  try {
    let processedFile = file;

    // Apply preprocessing to improve confidence
    if (usePreprocessing) {
      if (onProgress) onProgress(10);
      processedFile = await autoPreprocess(file);
      if (onProgress) onProgress(20);
    }

    // Lazy-load Tesseract.js
    const { recognize } = await getTesseract();

    // Create an image URL for Tesseract
    const imageUrl = URL.createObjectURL(processedFile);

    // Perform OCR with progress tracking
    const result = await recognize(
      imageUrl,
      'eng',
      {
        logger: (info) => {
          if (info.status === 'recognizing text' && onProgress) {
            const adjustedProgress = usePreprocessing
              ? 20 + Math.round(info.progress * 80)
              : Math.round(info.progress * 100);
            onProgress(adjustedProgress);
          }
        },
      }
    );

    URL.revokeObjectURL(imageUrl);
    const extractedText = result.data.text.trim();

    if (!extractedText) {
      return '';
    }

    return extractedText;
  } catch (error) {
    console.error('Tesseract OCR Error:', error);
    throw new Error(
      'Failed to extract text from image. Please ensure the image contains clear, readable text.'
    );
  }
};

/**
 * Get confidence score for the extracted text
 */
export const extractTextWithConfidence = async (
  file,
  onProgress,
  usePreprocessing = true
) => {
  // Validate file
  try {
    validateFile(file);
  } catch (error) {
    throw error instanceof OCRError ? error : ErrorFactory.fromError(error, 'file validation');
  }

  let imageUrl = null;

  try {
    let processedFile = file;

    if (usePreprocessing) {
      try {
        if (onProgress) onProgress(10);
        processedFile = await autoPreprocess(file);
        if (onProgress) onProgress(20);
      } catch (preprocessError) {
        console.warn('Preprocessing failed, continuing with original image:', preprocessError);
        processedFile = file;
        if (onProgress) onProgress(20);
      }
    }

    const { recognize } = await getTesseract();

    imageUrl = URL.createObjectURL(processedFile);

    const result = await recognize(imageUrl, 'eng', {
      logger: (info) => {
        if (info.status === 'recognizing text' && onProgress) {
          const adjustedProgress = usePreprocessing
            ? 20 + Math.round(info.progress * 80)
            : Math.round(info.progress * 100);
          onProgress(adjustedProgress);
        }
      },
    });

    const text = result.data.text.trim();
    const confidence = result.data.confidence;

    return {
      text,
      confidence,
    };
  } catch (error) {
    console.error('Tesseract OCR Error:', error);

    if (error?.message?.includes('invalid image')) {
      throw ErrorFactory.fileCorrupted(error);
    }

    if (error?.message?.includes('load')) {
      throw ErrorFactory.imageLoadFailed(error);
    }

    if (error?.name === 'QuotaExceededError' || error?.message?.includes('memory')) {
      throw ErrorFactory.outOfMemory(error);
    }

    throw ErrorFactory.processingFailed('Tesseract', error);
  } finally {
    if (imageUrl) {
      try {
        URL.revokeObjectURL(imageUrl);
      } catch (e) {
        console.warn('Failed to revoke object URL:', e);
      }
    }
  }
};

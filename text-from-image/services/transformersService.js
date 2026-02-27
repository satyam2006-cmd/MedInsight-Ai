import { OCRError, ErrorFactory, validateFile } from '../utils/errorHandling.js';

/**
 * Transformers.js + TrOCR Service
 */

let ocrPipeline = null;
let transformersModule = null;

// Lazy-load transformers library
async function getTransformers() {
  if (!transformersModule) {
    transformersModule = await import('@xenova/transformers');
  }
  return transformersModule;
}

const initPipeline = async (onProgress) => {
  if (ocrPipeline) {
    return ocrPipeline;
  }

  try {
    const { pipeline } = await getTransformers();

    ocrPipeline = await pipeline('image-to-text', 'Xenova/trocr-base-printed', {
      progress_callback: (progress) => {
        if (onProgress) {
          const status = progress.status || 'Loading model';
          const percent = progress.progress || 0;
          onProgress(status, Math.round(percent));
        }
      },
    });

    return ocrPipeline;
  } catch (error) {
    console.error('Failed to initialize Transformers.js pipeline:', error);
    ocrPipeline = null;

    if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
      throw ErrorFactory.networkError(error);
    }

    if (error?.message?.includes('load') || error?.message?.includes('download')) {
      throw ErrorFactory.modelLoadFailed('TrOCR', error);
    }

    throw ErrorFactory.processingFailed('Transformers initialization', error);
  }
};

const fileToDataURL = (file) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;
        if (!result) {
          reject(ErrorFactory.fileCorrupted());
        } else {
          resolve(result);
        }
      };

      reader.onerror = () => {
        reject(ErrorFactory.fileCorrupted(reader.error));
      };

      reader.readAsDataURL(file);
    } catch (error) {
      reject(ErrorFactory.fileCorrupted(error));
    }
  });
};

export const extractTextFromImage = async (file, onProgress) => {
  try {
    validateFile(file);
  } catch (error) {
    throw error instanceof OCRError ? error : ErrorFactory.fromError(error, 'file validation');
  }

  try {
    if (onProgress) onProgress('Loading AI model...', 0);
    const pipe = await initPipeline(onProgress);

    if (onProgress) onProgress('Processing image...', 50);
    let imageUrl;

    try {
      imageUrl = await fileToDataURL(file);
    } catch (error) {
      if (error instanceof OCRError) {
        throw error;
      }
      throw ErrorFactory.fileCorrupted(error);
    }

    if (onProgress) onProgress('Extracting text...', 75);
    let result;

    try {
      result = await pipe(imageUrl);
    } catch (modelError) {
      console.error('Model execution error:', modelError);

      if (modelError?.message?.includes('memory') || modelError?.name === 'QuotaExceededError') {
        throw ErrorFactory.outOfMemory(modelError);
      }

      throw ErrorFactory.processingFailed('Transformers model', modelError);
    }

    if (onProgress) onProgress('Complete', 100);

    const extractedText = Array.isArray(result)
      ? result.map((r) => r.generated_text).join('\n')
      : result.generated_text || '';

    const trimmedText = extractedText.trim();

    if (!trimmedText) {
      throw ErrorFactory.noTextFound();
    }

    return trimmedText;
  } catch (error) {
    console.error('Transformers.js OCR Error:', error);

    if (error instanceof OCRError) {
      throw error;
    }

    if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
      throw ErrorFactory.networkError(error);
    }

    if (error?.message?.includes('memory') || error?.name === 'QuotaExceededError') {
      throw ErrorFactory.outOfMemory(error);
    }

    throw ErrorFactory.processingFailed('Transformers', error);
  }
};

import { extractTextFromImage } from './tesseractService.js';
import { extractTextFromPdf } from './pdfService.js';
import { extractTextFromDocx } from './docService.js';

/**
 * Hybrid Extraction Service
 * Detects file type and routes to the appropriate extraction method.
 */
export const extractText = async (file, onProgress) => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    if (fileType.startsWith('image/')) {
        return await extractTextFromImage(file, onProgress);
    } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        return await extractTextFromPdf(file, onProgress);
    } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.endsWith('.docx') ||
        fileName.endsWith('.doc')
    ) {
        return await extractTextFromDocx(file);
    } else {
        throw new Error('Unsupported file type. Please upload an Image, PDF, or DOCX file.');
    }
};

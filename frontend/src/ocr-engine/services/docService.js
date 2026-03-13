import mammoth from 'mammoth';

/**
 * DOCX Extraction Service
 * Extracts text from DOCX files using mammoth.js.
 */
export const extractTextFromDocx = async (file) => {
    const arrayBuffer = await file.arrayBuffer();

    try {
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value.trim();
    } catch (error) {
        console.error('DOCX Extraction Error:', error);
        throw new Error('Failed to extract text from DOCX file.');
    }
};

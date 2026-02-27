import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * PDF Extraction Service
 * Extracts text from PDF files page by page.
 */
export const extractTextFromPdf = async (file, onProgress) => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

    try {
        const pdf = await loadingTask.promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            if (onProgress) onProgress(Math.round((i / pdf.numPages) * 100));

            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n';
        }

        return fullText.trim();
    } catch (error) {
        console.error('PDF Extraction Error:', error);
        throw new Error('Failed to extract text from PDF.');
    }
};

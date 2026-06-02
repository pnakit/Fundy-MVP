import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure worker once at module load
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MAX_CHARS = 150_000; // ~37,500 tokens — covers pitch decks and business plans

/**
 * Extract plain text from a PDF File object in the browser.
 * @param {File} file
 * @returns {Promise<string>} extracted text, truncated to MAX_CHARS
 */
export async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .filter(item => item.str)
      .map(item => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) pages.push(pageText);
  }

  const fullText = pages.join('\n\n');
  if (fullText.length > MAX_CHARS) {
    return fullText.slice(0, MAX_CHARS) + '\n\n[... document truncated ...]';
  }
  return fullText;
}

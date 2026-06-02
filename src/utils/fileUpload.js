import DifyAPI from '../api/difyApi';
import { extractTextFromPdf } from './pdfExtract';

export const DIFY_MAX_FILES = 10;
export const DIFY_MAX_FILE_SIZE_MB = 50; // PDFs are extracted client-side; server limit only applies to Office files
const SERVER_MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB — Vercel's body limit for server-side extraction

/**
 * Upload files and return results.
 *
 * PDFs are extracted client-side (no size limit, no server upload).
 * Office files (docx, xlsx, etc.) are uploaded to /api/upload for server-side extraction.
 * Files exceeding SERVER_MAX_FILE_SIZE_BYTES that aren't PDFs are rejected client-side.
 *
 * @param {File[]} files - Array of File objects to upload
 * @param {string} [user='default-user'] - user ID
 * @param {string} [workflow='onboarding'] - workflow name
 * @returns {Promise<{ succeeded: string[], failed: string[], oversized: Array<{name: string, sizeMB: number}>, uploadedFiles: Array<{fileId: string, fileName: string, extractedText?: string}> }>}
 */
export async function uploadFiles(files, user = 'default-user', workflow = 'onboarding') {
  const succeeded = [];
  const failed = [];
  const oversized = [];
  const uploadedFiles = [];

  for (const file of files) {
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

    // Non-PDF files over 4MB can't be processed server-side
    if (!isPdf && file.size > SERVER_MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      oversized.push({ name: file.name, sizeMB: parseFloat(sizeMB) });
      continue;
    }

    try {
      if (isPdf) {
        // Extract text client-side — no upload needed, handles any file size
        const extractedText = await extractTextFromPdf(file);
        uploadedFiles.push({ fileId: `client-${Date.now()}`, fileName: file.name, extractedText });
        succeeded.push(file.name);
      } else {
        const result = await DifyAPI.uploadFile(file, user, workflow);
        uploadedFiles.push({ fileId: result.fileId, fileName: file.name });
        succeeded.push(file.name);
      }
    } catch (error) {
      console.error(`[uploadFiles] Failed to process "${file.name}":`, error.message);
      failed.push(file.name);
    }
  }

  return { succeeded, failed, oversized, uploadedFiles };
}

/**
 * Build the success message for uploaded files.
 * @param {string[]} succeeded - File names that uploaded successfully
 * @param {string} context - 'onboarding' | 'evaluation' | 'discussion' — changes wording
 * @param {Array<{fileId: string, fileName: string, extractedText?: string}>} uploadedFiles - file results with optional extracted text
 * @returns {{ message: string, prompt: string }}
 */
export function buildUploadMessages(succeeded, context = 'evaluation', uploadedFiles = []) {
  const namesStr = succeeded.map((n) => `"${n}"`).join(', ');
  const pronoun = succeeded.length === 1 ? 'it' : 'them';

  const contextWord =
    context === 'discussion' ? 'our discussion'
    : context === 'onboarding' ? 'our conversation'
    : 'your evaluation';

  const message = `I've received ${namesStr}. Send a message to incorporate ${pronoun} into ${contextWord}. (Max ${DIFY_MAX_FILES} files per message, ${DIFY_MAX_FILE_SIZE_MB}MB each.)`;

  // Build prompt — include extracted text inline for client-side extracted files
  const textBlocks = uploadedFiles
    .filter(f => f.extractedText)
    .map(f => `--- ${f.fileName} ---\n${f.extractedText}`)
    .join('\n\n');

  const intro =
    context === 'onboarding'
      ? succeeded.length === 1
        ? `Here is supporting information from my document "${succeeded[0]}". Please use the content to continue the onboarding.`
        : `Here is supporting information from ${succeeded.length} documents (${succeeded.join(', ')}). Please use the content to continue the onboarding.`
    : context === 'discussion'
      ? succeeded.length === 1
        ? `Here is supporting information from my document "${succeeded[0]}". Please incorporate the content into our discussion.`
        : `Here is supporting information from ${succeeded.length} documents (${succeeded.join(', ')}). Please incorporate the content into our discussion.`
      : succeeded.length === 1
        ? `Here is supporting information from my document "${succeeded[0]}". Please review the content and ask me any relevant questions.`
        : `Here is supporting information from ${succeeded.length} documents (${succeeded.join(', ')}). Please review the content and ask me any relevant questions.`;

  const prompt = textBlocks ? `${intro}\n\n${textBlocks}` : intro;

  return { message, prompt };
}

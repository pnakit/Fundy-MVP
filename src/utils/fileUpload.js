import DifyAPI from '../api/difyApi';

export const DIFY_MAX_FILES = 10;
export const DIFY_MAX_FILE_SIZE_MB = 15;
const DIFY_MAX_FILE_SIZE_BYTES = DIFY_MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Upload files to Dify and return results.
 *
 * Pre-validates file sizes before uploading. Files exceeding DIFY_MAX_FILE_SIZE_MB
 * are rejected client-side without hitting the API.
 *
 * @param {File[]} files - Array of File objects to upload
 * @param {string} [user='default-user'] - Dify user ID
 * @param {string} [workflow='onboarding'] - Dify workflow name
 * @returns {Promise<{ succeeded: string[], failed: string[], oversized: Array<{name: string, sizeMB: number}>, uploadedFiles: Array<{fileId: string, fileName: string}> }>}
 */
export async function uploadFiles(files, user = 'default-user', workflow = 'onboarding') {
  const succeeded = [];
  const failed = [];
  const oversized = [];
  const uploadedFiles = [];

  for (const file of files) {
    if (file.size > DIFY_MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      oversized.push({ name: file.name, sizeMB: parseFloat(sizeMB) });
      continue;
    }
    try {
      const result = await DifyAPI.uploadFile(file, user, workflow);
      uploadedFiles.push({ fileId: result.fileId, fileName: file.name });
      succeeded.push(file.name);
    } catch (error) {
      console.error(`[uploadFiles] Failed to upload "${file.name}":`, error.message);
      failed.push(file.name);
    }
  }

  return { succeeded, failed, oversized, uploadedFiles };
}

/**
 * Build the success message for uploaded files.
 * @param {string[]} succeeded - File names that uploaded successfully
 * @param {string} context - 'onboarding' | 'evaluation' | 'discussion' — changes wording
 * @returns {{ message: string, prompt: string }}
 */
export function buildUploadMessages(succeeded, context = 'evaluation') {
  const namesStr = succeeded.map((n) => `"${n}"`).join(', ');
  const pronoun = succeeded.length === 1 ? 'it' : 'them';

  const contextWord =
    context === 'discussion' ? 'our discussion'
    : context === 'onboarding' ? 'our conversation'
    : 'your evaluation';

  const message = `I've received ${namesStr}. Send a message to incorporate ${pronoun} into ${contextWord}. (Max ${DIFY_MAX_FILES} files per message, ${DIFY_MAX_FILE_SIZE_MB}MB each.)`;

  let prompt;
  if (context === 'onboarding') {
    prompt =
      succeeded.length === 1
        ? `Here is supporting information from my document "${succeeded[0]}". Please use the extracted content to continue the onboarding.`
        : `Here is supporting information from ${succeeded.length} documents (${succeeded.join(', ')}). Please use the extracted content to continue the onboarding.`;
  } else if (context === 'discussion') {
    prompt =
      succeeded.length === 1
        ? `Here is supporting information from my document "${succeeded[0]}". Please incorporate the extracted content into our discussion.`
        : `Here is supporting information from ${succeeded.length} documents (${succeeded.join(', ')}). Please incorporate the extracted content into our discussion.`;
  } else {
    prompt =
      succeeded.length === 1
        ? `Here is supporting information from my document "${succeeded[0]}". Please review the extracted content and ask me any relevant questions.`
        : `Here is supporting information from ${succeeded.length} documents (${succeeded.join(', ')}). Please review the extracted content and ask me any relevant questions.`;
  }

  return { message, prompt };
}

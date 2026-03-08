import DifyAPI from '../api/difyApi';

/**
 * Upload files to Dify and return results.
 *
 * @param {File[]} files - Array of File objects to upload
 * @param {string} [user='default-user'] - Dify user ID
 * @param {string} [workflow='onboarding'] - Dify workflow name
 * @returns {Promise<{ succeeded: string[], failed: string[], uploadedFiles: Array<{fileId: string, fileName: string}> }>}
 */
export async function uploadFiles(files, user = 'default-user', workflow = 'onboarding') {
  const succeeded = [];
  const failed = [];
  const uploadedFiles = [];

  for (const file of files) {
    try {
      const result = await DifyAPI.uploadFile(file, user, workflow);
      uploadedFiles.push({ fileId: result.fileId, fileName: file.name });
      succeeded.push(file.name);
    } catch (error) {
      console.error(`[uploadFiles] Failed to upload "${file.name}":`, error.message);
      failed.push(file.name);
    }
  }

  return { succeeded, failed, uploadedFiles };
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

  const message = `I've received ${namesStr}. Send a message to incorporate ${pronoun} into ${contextWord}.`;

  let prompt;
  if (context === 'onboarding') {
    prompt =
      succeeded.length === 1
        ? `I've uploaded "${succeeded[0]}". Please use it to extract onboarding information.`
        : `I've uploaded ${succeeded.length} files (${succeeded.join(', ')}). Please use them to extract onboarding information.`;
  } else if (context === 'discussion') {
    prompt =
      succeeded.length === 1
        ? `I've uploaded "${succeeded[0]}". Please incorporate this into our discussion.`
        : `I've uploaded ${succeeded.length} files (${succeeded.join(', ')}). Please incorporate them into our discussion.`;
  } else {
    prompt =
      succeeded.length === 1
        ? `I've uploaded "${succeeded[0]}". Please review it and ask me any relevant questions.`
        : `I've uploaded ${succeeded.length} files (${succeeded.join(', ')}). Please review them and ask me any relevant questions.`;
  }

  return { message, prompt };
}

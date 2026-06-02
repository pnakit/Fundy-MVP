import { describe, it, expect, vi, afterEach } from 'vitest';
import { uploadFiles, buildUploadMessages } from './fileUpload';

vi.mock('../api/difyApi', () => ({
  default: {
    uploadFile: vi.fn(),
  },
}));

vi.mock('./pdfExtract', () => ({
  extractTextFromPdf: vi.fn().mockResolvedValue('extracted pdf text'),
}));

import DifyAPI from '../api/difyApi';
import { extractTextFromPdf } from './pdfExtract';

afterEach(() => {
  vi.clearAllMocks();
});

describe('uploadFiles — PDFs (client-side extraction)', () => {
  it('extracts PDF text client-side without calling DifyAPI', async () => {
    const file = new File(['%PDF'], 'deck.pdf', { type: 'application/pdf' });
    const result = await uploadFiles([file]);

    expect(extractTextFromPdf).toHaveBeenCalledWith(file);
    expect(DifyAPI.uploadFile).not.toHaveBeenCalled();
    expect(result.succeeded).toEqual(['deck.pdf']);
    expect(result.uploadedFiles[0]).toMatchObject({
      fileName: 'deck.pdf',
      extractedText: 'extracted pdf text',
    });
  });

  it('handles PDF extraction failure gracefully', async () => {
    extractTextFromPdf.mockRejectedValueOnce(new Error('corrupt pdf'));
    const file = new File(['%PDF'], 'bad.pdf', { type: 'application/pdf' });

    const result = await uploadFiles([file]);

    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual(['bad.pdf']);
  });

  it('detects PDFs by extension regardless of MIME type', async () => {
    const file = new File(['%PDF'], 'deck.pdf', { type: 'application/octet-stream' });
    const result = await uploadFiles([file]);

    expect(extractTextFromPdf).toHaveBeenCalled();
    expect(result.succeeded).toEqual(['deck.pdf']);
  });
});

describe('uploadFiles — Office files (server-side upload)', () => {
  it('uploads non-PDF files to DifyAPI', async () => {
    DifyAPI.uploadFile.mockResolvedValue({ fileId: 'f1', fileName: 'report.docx' });
    const file = new File(['content'], 'report.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    const result = await uploadFiles([file]);

    expect(DifyAPI.uploadFile).toHaveBeenCalledWith(file, 'default-user', 'onboarding');
    expect(extractTextFromPdf).not.toHaveBeenCalled();
    expect(result.succeeded).toEqual(['report.docx']);
    expect(result.uploadedFiles).toEqual([{ fileId: 'f1', fileName: 'report.docx' }]);
  });

  it('returns failed files on upload error', async () => {
    DifyAPI.uploadFile.mockRejectedValue(new Error('fail'));
    const file = new File(['content'], 'report.docx', { type: 'application/msword' });

    const result = await uploadFiles([file]);

    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual(['report.docx']);
  });

  it('rejects oversized non-PDF files (> 4MB)', async () => {
    const bigContent = new Uint8Array(5 * 1024 * 1024);
    const file = new File([bigContent], 'huge.docx', { type: 'application/msword' });

    const result = await uploadFiles([file]);

    expect(result.oversized).toHaveLength(1);
    expect(result.oversized[0].name).toBe('huge.docx');
    expect(DifyAPI.uploadFile).not.toHaveBeenCalled();
  });

  it('passes user and workflow to DifyAPI.uploadFile', async () => {
    DifyAPI.uploadFile.mockResolvedValue({ fileId: 'f1', fileName: 'a.docx' });
    const file = new File([''], 'a.docx', { type: 'application/msword' });

    await uploadFiles([file], 'user-1', 'deepdive');

    expect(DifyAPI.uploadFile).toHaveBeenCalledWith(file, 'user-1', 'deepdive');
  });

  it('returns empty arrays for empty input', async () => {
    const result = await uploadFiles([]);

    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.uploadedFiles).toEqual([]);
    expect(DifyAPI.uploadFile).not.toHaveBeenCalled();
  });
});

describe('buildUploadMessages', () => {
  it('builds singular evaluation message', () => {
    const { message, prompt } = buildUploadMessages(['report.pdf'], 'evaluation');

    expect(message).toContain('"report.pdf"');
    expect(message).toContain('it');
    expect(message).toContain('your evaluation');
    expect(prompt).toContain('report.pdf');
    expect(prompt).toContain('review the content');
  });

  it('builds plural evaluation message', () => {
    const { message, prompt } = buildUploadMessages(['a.pdf', 'b.pdf'], 'evaluation');

    expect(message).toContain('"a.pdf"');
    expect(message).toContain('"b.pdf"');
    expect(message).toContain('them');
    expect(prompt).toContain('2 documents');
  });

  it('builds discussion context message', () => {
    const { message, prompt } = buildUploadMessages(['doc.pdf'], 'discussion');

    expect(message).toContain('our discussion');
    expect(prompt).toContain('incorporate the content into our discussion');
  });

  it('builds onboarding context message', () => {
    const { message, prompt } = buildUploadMessages(['doc.pdf'], 'onboarding');

    expect(message).toContain('our conversation');
    expect(prompt).toContain('content to continue the onboarding');
  });

  it('defaults to evaluation context', () => {
    const { message } = buildUploadMessages(['x.pdf']);

    expect(message).toContain('your evaluation');
  });

  it('includes extracted text in prompt when provided', () => {
    const uploadedFiles = [{ fileId: 'f1', fileName: 'deck.pdf', extractedText: 'slide content here' }];
    const { prompt } = buildUploadMessages(['deck.pdf'], 'onboarding', uploadedFiles);

    expect(prompt).toContain('--- deck.pdf ---');
    expect(prompt).toContain('slide content here');
  });

  it('omits text block when no extracted text', () => {
    const uploadedFiles = [{ fileId: 'f1', fileName: 'doc.docx' }];
    const { prompt } = buildUploadMessages(['doc.docx'], 'onboarding', uploadedFiles);

    expect(prompt).not.toContain('---');
  });
});

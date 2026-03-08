import { describe, it, expect, vi, afterEach } from 'vitest';
import { uploadFiles, buildUploadMessages } from './fileUpload';

vi.mock('../api/difyApi', () => ({
  default: {
    uploadFile: vi.fn(),
  },
}));

import DifyAPI from '../api/difyApi';

afterEach(() => {
  vi.clearAllMocks();
});

describe('uploadFiles', () => {
  it('returns succeeded files on successful upload', async () => {
    DifyAPI.uploadFile.mockResolvedValue({ fileId: 'f1', fileName: 'a.pdf' });
    const file = new File([''], 'a.pdf', { type: 'application/pdf' });

    const result = await uploadFiles([file]);

    expect(result.succeeded).toEqual(['a.pdf']);
    expect(result.failed).toEqual([]);
    expect(result.uploadedFiles).toEqual([{ fileId: 'f1', fileName: 'a.pdf' }]);
  });

  it('returns failed files on upload error', async () => {
    DifyAPI.uploadFile.mockRejectedValue(new Error('fail'));
    const file = new File([''], 'b.pdf', { type: 'application/pdf' });

    const result = await uploadFiles([file]);

    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual(['b.pdf']);
    expect(result.uploadedFiles).toEqual([]);
  });

  it('handles mixed success and failure', async () => {
    DifyAPI.uploadFile
      .mockResolvedValueOnce({ fileId: 'f1', fileName: 'ok.pdf' })
      .mockRejectedValueOnce(new Error('fail'));

    const files = [
      new File([''], 'ok.pdf', { type: 'application/pdf' }),
      new File([''], 'bad.pdf', { type: 'application/pdf' }),
    ];

    const result = await uploadFiles(files);

    expect(result.succeeded).toEqual(['ok.pdf']);
    expect(result.failed).toEqual(['bad.pdf']);
    expect(result.uploadedFiles).toHaveLength(1);
  });

  it('passes user and workflow to DifyAPI.uploadFile', async () => {
    DifyAPI.uploadFile.mockResolvedValue({ fileId: 'f1', fileName: 'a.pdf' });
    const file = new File([''], 'a.pdf', { type: 'application/pdf' });

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
    expect(prompt).toContain('review it');
  });

  it('builds plural evaluation message', () => {
    const { message, prompt } = buildUploadMessages(['a.pdf', 'b.pdf'], 'evaluation');

    expect(message).toContain('"a.pdf"');
    expect(message).toContain('"b.pdf"');
    expect(message).toContain('them');
    expect(prompt).toContain('2 files');
  });

  it('builds discussion context message', () => {
    const { message, prompt } = buildUploadMessages(['doc.pdf'], 'discussion');

    expect(message).toContain('our discussion');
    expect(prompt).toContain('incorporate this into our discussion');
  });

  it('builds onboarding context message', () => {
    const { message, prompt } = buildUploadMessages(['doc.pdf'], 'onboarding');

    expect(message).toContain('our conversation');
    expect(prompt).toContain('extract onboarding information');
  });

  it('defaults to evaluation context', () => {
    const { message } = buildUploadMessages(['x.pdf']);

    expect(message).toContain('your evaluation');
  });
});

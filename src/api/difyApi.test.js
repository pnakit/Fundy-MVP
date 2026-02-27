import { describe, it, expect, vi, beforeEach } from 'vitest';
import DifyAPI from './difyApi';

describe('DifyAPI.sendMessageMock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns a response with expected structure', async () => {
    const promise = DifyAPI.sendMessageMock('hello', null);
    vi.advanceTimersByTime(1500);
    const result = await promise;

    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('conversationId');
    expect(result).toHaveProperty('messageId');
    expect(result).toHaveProperty('fallback', false);
    expect(result.message).toMatch(/^\[mock\] /);
  });

  it('generates a conversationId when none is provided', async () => {
    const promise = DifyAPI.sendMessageMock('hello', null);
    vi.advanceTimersByTime(1500);
    const result = await promise;

    expect(result.conversationId).toMatch(/^conv_/);
  });

  it('preserves the existing conversationId', async () => {
    const promise = DifyAPI.sendMessageMock('hello', 'existing_conv');
    vi.advanceTimersByTime(1500);
    const result = await promise;

    expect(result.conversationId).toBe('existing_conv');
  });

  it('returns a summary when message contains "summary"', async () => {
    const promise = DifyAPI.sendMessageMock('Show me the summary', null);
    vi.advanceTimersByTime(1500);
    const result = await promise;

    expect(result.message).toContain('[ONBOARDING_SUMMARY]');
    expect(result.message).toContain('[/ONBOARDING_SUMMARY]');
    expect(result.message).not.toMatch(/^\[mock\] /);
  });

  it('returns a summary when message contains "finish"', async () => {
    const promise = DifyAPI.sendMessageMock("Let's finish up", null);
    vi.advanceTimersByTime(1500);
    const result = await promise;

    expect(result.message).toContain('[ONBOARDING_SUMMARY]');
  });

  it('summary trigger is case-insensitive', async () => {
    const promise = DifyAPI.sendMessageMock('SUMMARY please', null);
    vi.advanceTimersByTime(1500);
    const result = await promise;

    expect(result.message).toContain('[ONBOARDING_SUMMARY]');
  });
});

describe('DifyAPI.uploadFileMock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns success with file info', async () => {
    const mockFile = { name: 'test.pdf' };
    const promise = DifyAPI.uploadFileMock(mockFile);
    vi.advanceTimersByTime(1000);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.fileId).toMatch(/^file_/);
    expect(result.fileName).toBe('test.pdf');
  });
});

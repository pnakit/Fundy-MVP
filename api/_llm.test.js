import { describe, it, expect, vi, afterEach } from 'vitest';

describe('_llm', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('getModel returns a model for a valid provider:model spec', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.LLM_CHAT_MODEL = 'openai:gpt-4o-mini';
    const { getModel } = await import('./_llm.js');
    const model = getModel('LLM_CHAT_MODEL');
    expect(model).toBeDefined();
    expect(model.modelId).toBe('gpt-4o-mini');
  });

  it('getModel throws when env var is not set', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.LLM_CHAT_MODEL;
    const { getModel } = await import('./_llm.js');
    expect(() => getModel('LLM_CHAT_MODEL')).toThrow('LLM_CHAT_MODEL not configured');
  });

  it('getModel supports different env vars for different workflows', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.LLM_CHAT_MODEL = 'openai:gpt-4o-mini';
    process.env.LLM_EVAL_MODEL = 'openai:gpt-4o';
    const { getModel } = await import('./_llm.js');
    const chatModel = getModel('LLM_CHAT_MODEL');
    const evalModel = getModel('LLM_EVAL_MODEL');
    expect(chatModel.modelId).toBe('gpt-4o-mini');
    expect(evalModel.modelId).toBe('gpt-4o');
  });
});

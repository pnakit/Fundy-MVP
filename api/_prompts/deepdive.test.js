import { describe, it, expect } from 'vitest';
import { buildDeepDiveSystemPrompt, buildDeepDiveMessages } from './deepdive.js';

const mockSummary = {
  companyName: 'TestCo',
  categories: [
    {
      id: 'product_technology',
      title: 'Product & Technology',
      summary: 'Building an ML platform',
      completeness: 60,
      status: 'needs_attention',
      highlights: ['Strong technical team'],
      gaps: ['No IP protection strategy'],
      keyMetrics: { stage: 'Beta' },
      deepDivePrompt: 'Let us explore your product architecture in detail.',
    },
  ],
};

describe('deepdive prompt', () => {
  it('builds a system prompt scoped to the specified category', () => {
    const prompt = buildDeepDiveSystemPrompt('product_technology', mockSummary);
    expect(prompt).toContain('Product & Technology');
    expect(prompt).toContain('Building an ML platform');
    expect(prompt).toContain('Strong technical team');
    expect(prompt).toContain('No IP protection strategy');
  });

  it('throws for an unknown category ID', () => {
    expect(() => buildDeepDiveSystemPrompt('nonexistent', mockSummary)).toThrow();
  });

  it('buildDeepDiveMessages returns system + history', () => {
    const history = [{ role: 'user', content: 'Hello' }];
    const prompt = buildDeepDiveSystemPrompt('product_technology', mockSummary);
    const messages = buildDeepDiveMessages(prompt, history);
    expect(messages[0].role).toBe('system');
    expect(messages.slice(1)).toEqual(history);
  });
});

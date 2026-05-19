/**
 * Tests for _analyze.js — LLM analysis helper for action item refresh.
 *
 * Key invariants:
 * - No evidence → 'insufficient_evidence' without an LLM call
 * - generateObject errors → safe fallback to 'not_addressed' (no throw)
 * - Zod schema is passed to generateObject for structured output
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock 'ai' module before importing _analyze
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

// Mock '../_llm.js'
vi.mock('../_llm.js', () => ({
  getModel: vi.fn(() => 'mock-model'),
}));

import { analyzeActionItem } from './_analyze.js';
import { generateObject } from 'ai';

describe('analyzeActionItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns insufficient_evidence when no evidence chunks provided', async () => {
    const result = await analyzeActionItem({ title: 'Test', description: 'Desc' }, []);
    expect(result.status).toBe('insufficient_evidence');
    expect(result.confidence).toBe(0);
    expect(result.summary).toContain('No relevant evidence');
    expect(generateObject).not.toHaveBeenCalled();
  });

  it('returns insufficient_evidence when evidence is null', async () => {
    const result = await analyzeActionItem({ title: 'Test' }, null);
    expect(result.status).toBe('insufficient_evidence');
    expect(generateObject).not.toHaveBeenCalled();
  });

  it('calls generateObject and returns structured result on success', async () => {
    generateObject.mockResolvedValue({
      object: { status: 'addressed', confidence: 0.9, summary: 'Found evidence.' },
    });

    const result = await analyzeActionItem(
      { title: 'Build financial model', description: 'Create 3-year projections', priority: 'high', status: 'pending' },
      [{ content: 'Revenue projections for 2025-2028 included in onboarding summary.' }],
    );
    expect(result.status).toBe('addressed');
    expect(result.confidence).toBe(0.9);
    expect(result.summary).toBe('Found evidence.');

    // Verify generateObject call structure
    expect(generateObject).toHaveBeenCalledOnce();
    const callArgs = generateObject.mock.calls[0][0];
    expect(callArgs.model).toBe('mock-model');
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0].role).toBe('system');
    expect(callArgs.messages[1].role).toBe('user');
    expect(callArgs.messages[1].content).toContain('Build financial model');
    expect(callArgs.messages[1].content).toContain('Revenue projections');
    expect(callArgs.temperature).toBe(0.2);
  });

  it('returns fallback on generateObject error (does not throw)', async () => {
    generateObject.mockRejectedValue(new Error('API rate limited'));

    const result = await analyzeActionItem(
      { title: 'Test' },
      [{ content: 'evidence' }],
    );
    expect(result.status).toBe('not_addressed');
    expect(result.confidence).toBe(0);
    expect(result.summary).toContain('Analysis failed');
    expect(result.summary).toContain('API rate limited');
  });

  it('handles empty title and description gracefully', async () => {
    generateObject.mockResolvedValue({
      object: { status: 'not_addressed', confidence: 0.1, summary: 'No details.' },
    });

    const result = await analyzeActionItem({}, [{ content: 'evidence' }]);
    expect(result.status).toBe('not_addressed');

    const userMsg = generateObject.mock.calls[0][0].messages[1].content;
    expect(userMsg).toContain('(untitled)');
    expect(userMsg).toContain('(no description)');
  });

  it('includes evidence count in user message', async () => {
    generateObject.mockResolvedValue({
      object: { status: 'partially_addressed', confidence: 0.5, summary: 'Some.' },
    });

    await analyzeActionItem(
      { title: 'Test' },
      [{ content: 'chunk1' }, { content: 'chunk2' }, { content: 'chunk3' }],
    );

    const userMsg = generateObject.mock.calls[0][0].messages[1].content;
    expect(userMsg).toContain('3 results');
    expect(userMsg).toContain('[1] chunk1');
    expect(userMsg).toContain('[2] chunk2');
    expect(userMsg).toContain('[3] chunk3');
  });

  it('passes the Zod schema to generateObject', async () => {
    generateObject.mockResolvedValue({
      object: { status: 'addressed', confidence: 0.8, summary: 'Done.' },
    });

    await analyzeActionItem({ title: 'Test' }, [{ content: 'evidence' }]);

    const callArgs = generateObject.mock.calls[0][0];
    // Verify schema is a Zod object (has .parse method)
    expect(typeof callArgs.schema.parse).toBe('function');
  });
});

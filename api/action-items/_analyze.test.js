/**
 * Tests for _analyze.js — LLM analysis helper for action item refresh.
 *
 * Key invariants:
 * - No evidence → 'insufficient_evidence' without an LLM call
 * - Malformed JSON → safe fallback to 'not_addressed'
 * - Confidence is always clamped to [0, 1]
 * - Invalid status values fall back to 'not_addressed'
 * - Markdown code fences are stripped before parsing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeActionItem, parseAnalysisResponse } from './_analyze.js';

// ─── parseAnalysisResponse (pure function, no mocking needed) ────────────────

describe('parseAnalysisResponse', () => {
  it('parses valid JSON response', () => {
    const raw = JSON.stringify({
      status: 'addressed',
      confidence: 0.85,
      summary: 'Revenue projections provided in onboarding.',
    });
    const result = parseAnalysisResponse(raw);
    expect(result).toEqual({
      status: 'addressed',
      confidence: 0.85,
      summary: 'Revenue projections provided in onboarding.',
    });
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n{"status":"partially_addressed","confidence":0.6,"summary":"Some evidence found."}\n```';
    const result = parseAnalysisResponse(raw);
    expect(result.status).toBe('partially_addressed');
    expect(result.confidence).toBe(0.6);
  });

  it('strips code fences without json language tag', () => {
    const raw = '```\n{"status":"addressed","confidence":0.9,"summary":"Done."}\n```';
    const result = parseAnalysisResponse(raw);
    expect(result.status).toBe('addressed');
  });

  it('returns fallback for malformed JSON', () => {
    const result = parseAnalysisResponse('this is not json {{{');
    expect(result.status).toBe('not_addressed');
    expect(result.confidence).toBe(0);
    expect(result.summary).toBe('Unable to parse analysis response.');
  });

  it('returns fallback for empty input', () => {
    const result = parseAnalysisResponse('');
    expect(result.status).toBe('not_addressed');
    expect(result.confidence).toBe(0);
  });

  it('returns fallback for null input', () => {
    const result = parseAnalysisResponse(null);
    expect(result.status).toBe('not_addressed');
  });

  it('clamps confidence above 1 to 1', () => {
    const raw = JSON.stringify({ status: 'addressed', confidence: 1.5, summary: 'Very sure.' });
    const result = parseAnalysisResponse(raw);
    expect(result.confidence).toBe(1);
  });

  it('clamps confidence below 0 to 0', () => {
    const raw = JSON.stringify({ status: 'addressed', confidence: -0.3, summary: 'Negative.' });
    const result = parseAnalysisResponse(raw);
    expect(result.confidence).toBe(0);
  });

  it('treats NaN confidence as 0', () => {
    const raw = JSON.stringify({ status: 'addressed', confidence: 'high', summary: 'Word instead of number.' });
    const result = parseAnalysisResponse(raw);
    expect(result.confidence).toBe(0);
  });

  it('falls back invalid status to not_addressed', () => {
    const raw = JSON.stringify({ status: 'maybe', confidence: 0.5, summary: 'Unsure.' });
    const result = parseAnalysisResponse(raw);
    expect(result.status).toBe('not_addressed');
  });

  it('provides default summary when missing', () => {
    const raw = JSON.stringify({ status: 'addressed', confidence: 0.8 });
    const result = parseAnalysisResponse(raw);
    expect(result.summary).toBe('No analysis summary provided.');
  });

  it('provides default summary for empty string', () => {
    const raw = JSON.stringify({ status: 'addressed', confidence: 0.8, summary: '' });
    const result = parseAnalysisResponse(raw);
    expect(result.summary).toBe('No analysis summary provided.');
  });
});

// ─── analyzeActionItem (requires fetch mocking) ─────────────────────────────

describe('analyzeActionItem', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('returns insufficient_evidence when no evidence chunks provided', async () => {
    const result = await analyzeActionItem({ title: 'Test', description: 'Desc' }, []);
    expect(result.status).toBe('insufficient_evidence');
    expect(result.confidence).toBe(0);
    expect(result.summary).toContain('No relevant evidence');
  });

  it('returns insufficient_evidence when evidence is null', async () => {
    const result = await analyzeActionItem({ title: 'Test' }, null);
    expect(result.status).toBe('insufficient_evidence');
  });

  it('throws when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(
      analyzeActionItem({ title: 'Test' }, [{ content: 'some evidence' }]),
    ).rejects.toThrow('OPENAI_API_KEY not configured');
  });

  it('calls OpenAI and returns parsed result on success', async () => {
    const mockResponse = {
      choices: [{ message: { content: JSON.stringify({ status: 'addressed', confidence: 0.9, summary: 'Found evidence.' }) } }],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await analyzeActionItem(
      { title: 'Build financial model', description: 'Create 3-year projections', priority: 'high', status: 'pending' },
      [{ content: 'Revenue projections for 2025-2028 included in onboarding summary.' }],
    );
    expect(result.status).toBe('addressed');
    expect(result.confidence).toBe(0.9);
    expect(result.summary).toBe('Found evidence.');

    // Verify the fetch call structure
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(opts.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1].content).toContain('Build financial model');
    expect(body.messages[1].content).toContain('Revenue projections');
  });

  it('throws on OpenAI API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    });

    await expect(
      analyzeActionItem({ title: 'Test' }, [{ content: 'evidence' }]),
    ).rejects.toThrow('OpenAI chat error (429)');
  });

  it('handles empty title and description gracefully', async () => {
    const mockResponse = {
      choices: [{ message: { content: JSON.stringify({ status: 'not_addressed', confidence: 0.1, summary: 'No details.' }) } }],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await analyzeActionItem({}, [{ content: 'evidence' }]);
    expect(result.status).toBe('not_addressed');

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.messages[1].content).toContain('(untitled)');
    expect(body.messages[1].content).toContain('(no description)');
  });
});

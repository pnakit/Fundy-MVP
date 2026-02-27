import { describe, it, expect } from 'vitest';
import { extractOnboardingSummary, parseSSELine, SUMMARY_START_MARKER, SUMMARY_END_MARKER } from './extractSummary';
import { ONBOARDING_CATEGORIES } from '../data/mockData';

function buildSummaryResponse(jsonObj) {
  return `Here is your summary.\n\n${SUMMARY_START_MARKER}\n${JSON.stringify(jsonObj)}\n${SUMMARY_END_MARKER}`;
}

function makeValidSummary(overrides = {}) {
  const categories = ONBOARDING_CATEGORIES.map((cat, i) => ({
    id: cat.id,
    title: cat.title,
    summary: `Summary for ${cat.title}`,
    completeness: 50 + i * 5,
    highlights: ['highlight1'],
    gaps: ['gap1'],
    keyMetrics: {},
    deepDivePrompt: `Let's discuss ${cat.title}`,
  }));
  return { companyName: 'TestCo', overallCompleteness: 60, categories, ...overrides };
}

describe('extractOnboardingSummary', () => {
  it('returns null when no markers are present', () => {
    expect(extractOnboardingSummary('Just a normal message')).toBeNull();
  });

  it('returns null when only start marker is present', () => {
    expect(extractOnboardingSummary(`${SUMMARY_START_MARKER}\n{"foo":1}`)).toBeNull();
  });

  it('returns parse_error for malformed JSON', () => {
    const response = `${SUMMARY_START_MARKER}\n{not valid json}\n${SUMMARY_END_MARKER}`;
    const result = extractOnboardingSummary(response);
    expect(result).toEqual({ error: 'parse_error', message: 'The summary data could not be parsed.' });
  });

  it('returns missing_categories when categories is absent', () => {
    const response = buildSummaryResponse({ companyName: 'Test' });
    const result = extractOnboardingSummary(response);
    expect(result).toEqual({ error: 'missing_categories', message: 'The summary is missing category data.' });
  });

  it('returns missing_categories when categories is not an array', () => {
    const response = buildSummaryResponse({ categories: 'not-array' });
    const result = extractOnboardingSummary(response);
    expect(result).toEqual({ error: 'missing_categories', message: 'The summary is missing category data.' });
  });

  it('returns too_few_categories when fewer than 5', () => {
    const response = buildSummaryResponse({
      categories: ONBOARDING_CATEGORIES.slice(0, 3).map(c => ({
        id: c.id, title: c.title, summary: 'x', completeness: 50,
        highlights: [], gaps: [], keyMetrics: {},
      }))
    });
    const result = extractOnboardingSummary(response);
    expect(result.error).toBe('too_few_categories');
  });

  it('parses a valid complete summary', () => {
    const input = makeValidSummary();
    const response = buildSummaryResponse(input);
    const result = extractOnboardingSummary(response);

    expect(result.error).toBeUndefined();
    expect(result.companyName).toBe('TestCo');
    expect(result.categories).toHaveLength(10);
    expect(result.overallCompleteness).toBeGreaterThan(0);
  });

  it('fixes trailing commas in JSON', () => {
    const json = JSON.stringify(makeValidSummary());
    // Insert trailing commas after the last property in an object
    const brokenJson = json.replace(/}]/g, ',}]').replace(/}}/g, ',}}');
    const response = `${SUMMARY_START_MARKER}\n${brokenJson}\n${SUMMARY_END_MARKER}`;
    const result = extractOnboardingSummary(response);

    expect(result.error).toBeUndefined();
    expect(result.categories).toHaveLength(10);
  });

  it('clamps completeness to 0-100', () => {
    const summary = makeValidSummary();
    summary.categories[0].completeness = 150;
    summary.categories[1].completeness = -20;
    const response = buildSummaryResponse(summary);
    const result = extractOnboardingSummary(response);

    expect(result.categories[0].completeness).toBe(100);
    expect(result.categories[1].completeness).toBe(0);
  });

  it('derives status from completeness thresholds', () => {
    const summary = makeValidSummary();
    summary.categories[0].completeness = 80; // >= 70 → complete
    summary.categories[1].completeness = 50; // >= 40 → needs_attention
    summary.categories[2].completeness = 10; // < 40 → incomplete
    const response = buildSummaryResponse(summary);
    const result = extractOnboardingSummary(response);

    expect(result.categories[0].status).toBe('complete');
    expect(result.categories[1].status).toBe('needs_attention');
    expect(result.categories[2].status).toBe('incomplete');
  });

  it('filters out unknown category IDs', () => {
    const summary = makeValidSummary();
    summary.categories.push({ id: 'unknown_id', title: 'Unknown', completeness: 50 });
    const response = buildSummaryResponse(summary);
    const result = extractOnboardingSummary(response);

    expect(result.categories.find(c => c.id === 'unknown_id')).toBeUndefined();
    expect(result.categories).toHaveLength(10);
  });

  it('backfills missing categories with placeholders', () => {
    const summary = makeValidSummary();
    // Remove the last 3 categories
    summary.categories = summary.categories.slice(0, 7);
    const response = buildSummaryResponse(summary);
    const result = extractOnboardingSummary(response);

    expect(result.categories).toHaveLength(10);
    const backfilled = result.categories.find(c => c.id === 'legal_compliance');
    expect(backfilled.completeness).toBe(0);
    expect(backfilled.status).toBe('incomplete');
  });

  it('sorts categories to match ONBOARDING_CATEGORIES order', () => {
    const summary = makeValidSummary();
    // Reverse the order
    summary.categories = [...summary.categories].reverse();
    const response = buildSummaryResponse(summary);
    const result = extractOnboardingSummary(response);

    const resultIds = result.categories.map(c => c.id);
    const expectedIds = ONBOARDING_CATEGORIES.map(c => c.id);
    expect(resultIds).toEqual(expectedIds);
  });

  it('recalculates overallCompleteness', () => {
    const summary = makeValidSummary();
    summary.categories = summary.categories.map(c => ({ ...c, completeness: 80 }));
    summary.overallCompleteness = 0; // intentionally wrong
    const response = buildSummaryResponse(summary);
    const result = extractOnboardingSummary(response);

    expect(result.overallCompleteness).toBe(80);
  });

  it('defaults companyName to "Your Company" when missing', () => {
    const summary = makeValidSummary();
    delete summary.companyName;
    const response = buildSummaryResponse(summary);
    const result = extractOnboardingSummary(response);

    expect(result.companyName).toBe('Your Company');
  });

  it('handles non-string highlights and gaps by filtering them out', () => {
    const summary = makeValidSummary();
    summary.categories[0].highlights = ['valid', 123, null, 'also valid'];
    summary.categories[0].gaps = [true, 'real gap'];
    const response = buildSummaryResponse(summary);
    const result = extractOnboardingSummary(response);

    expect(result.categories[0].highlights).toEqual(['valid', 'also valid']);
    expect(result.categories[0].gaps).toEqual(['real gap']);
  });

  it('defaults keyMetrics to empty object when invalid', () => {
    const summary = makeValidSummary();
    summary.categories[0].keyMetrics = 'not-an-object';
    const response = buildSummaryResponse(summary);
    const result = extractOnboardingSummary(response);

    expect(result.categories[0].keyMetrics).toEqual({});
  });
});

describe('parseSSELine', () => {
  it('returns null for non-data lines', () => {
    expect(parseSSELine('event: message')).toBeNull();
    expect(parseSSELine('')).toBeNull();
    expect(parseSSELine('random text')).toBeNull();
  });

  it('returns null for empty data lines', () => {
    expect(parseSSELine('data: ')).toBeNull();
    expect(parseSSELine('data:   ')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseSSELine('data: {not valid}')).toBeNull();
  });

  it('parses a valid message event', () => {
    const event = { event: 'message', answer: 'hello' };
    const result = parseSSELine(`data: ${JSON.stringify(event)}`);
    expect(result).toEqual(event);
  });

  it('parses a message_end event', () => {
    const event = { event: 'message_end', conversation_id: 'conv_1', message_id: 'msg_1' };
    const result = parseSSELine(`data: ${JSON.stringify(event)}`);
    expect(result).toEqual(event);
  });
});

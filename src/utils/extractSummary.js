import { ONBOARDING_CATEGORIES } from '../data/mockData';

export const SUMMARY_START_MARKER = '[ONBOARDING_SUMMARY]';
export const SUMMARY_END_MARKER = '[/ONBOARDING_SUMMARY]';

export function extractOnboardingSummary(responseText) {
  const startIdx = responseText.indexOf(SUMMARY_START_MARKER);
  if (startIdx === -1) return null;

  const jsonStart = startIdx + SUMMARY_START_MARKER.length;
  const endIdx = responseText.indexOf(SUMMARY_END_MARKER, jsonStart);
  if (endIdx === -1) return null;

  let jsonString = responseText.substring(jsonStart, endIdx).trim();

  // Strip markdown code fences if LLM wrapped the JSON in ```json ... ```
  jsonString = jsonString.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  // Fix trailing commas — most common LLM JSON error
  jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');

  console.debug('[extractSummary] Raw JSON between markers (first 500 chars):', jsonString.substring(0, 500));

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse onboarding summary JSON:', e, '\nRaw string:', jsonString.substring(0, 1000));
    return { error: 'parse_error', message: 'The summary data could not be parsed.' };
  }

  if (!parsed.categories || !Array.isArray(parsed.categories)) {
    console.warn('Onboarding summary missing categories array. Keys found:', Object.keys(parsed), '\nParsed object:', parsed);
    return { error: 'missing_categories', message: 'The summary is missing category data.' };
  }

  if (parsed.categories.length < 5) {
    console.warn(`Onboarding summary has only ${parsed.categories.length} categories`);
    return { error: 'too_few_categories', message: `Only ${parsed.categories.length} categories were returned.` };
  }

  const validIds = new Set(ONBOARDING_CATEGORIES.map(c => c.id));

  // Normalize each category: coerce types, derive status, ensure required fields
  parsed.categories = parsed.categories
    .filter(cat => cat && typeof cat === 'object' && validIds.has(cat.id))
    .map(cat => {
      const completeness = Math.max(0, Math.min(100, Math.round(Number(cat.completeness) || 0)));
      const status = completeness >= 70 ? 'complete' : completeness >= 40 ? 'needs_attention' : 'incomplete';
      const catDef = ONBOARDING_CATEGORIES.find(c => c.id === cat.id);

      return {
        ...cat,
        completeness,
        status,
        title: cat.title || catDef?.title || cat.id,
        highlights: Array.isArray(cat.highlights) ? cat.highlights.filter(h => typeof h === 'string') : [],
        gaps: Array.isArray(cat.gaps) ? cat.gaps.filter(g => typeof g === 'string') : [],
        keyMetrics: (cat.keyMetrics && typeof cat.keyMetrics === 'object') ? cat.keyMetrics : {},
        deepDivePrompt: typeof cat.deepDivePrompt === 'string' ? cat.deepDivePrompt
          : `Let's explore ${catDef?.title || 'this area'} in more detail.`,
      };
    });

  // Fill missing categories with placeholders
  const presentIds = new Set(parsed.categories.map(c => c.id));
  for (const catDef of ONBOARDING_CATEGORIES) {
    if (!presentIds.has(catDef.id)) {
      parsed.categories.push({
        id: catDef.id,
        title: catDef.title,
        summary: 'This area was not covered during the onboarding conversation.',
        completeness: 0,
        status: 'incomplete',
        highlights: [],
        gaps: ['Not yet discussed — click to explore this topic'],
        keyMetrics: {},
        deepDivePrompt: `We haven't discussed ${catDef.title} yet. Let's start by understanding your current situation in this area.`,
      });
    }
  }

  // Sort to match ONBOARDING_CATEGORIES order
  const orderMap = Object.fromEntries(ONBOARDING_CATEGORIES.map((c, i) => [c.id, i]));
  parsed.categories.sort((a, b) => (orderMap[a.id] ?? 99) - (orderMap[b.id] ?? 99));

  // Recalculate overall completeness
  parsed.overallCompleteness = Math.round(
    parsed.categories.reduce((sum, c) => sum + c.completeness, 0) / parsed.categories.length
  );
  parsed.companyName = parsed.companyName || 'Your Company';

  return parsed;
}

/**
 * Parse a single SSE line from a Dify streaming response.
 * Returns { event, answer, conversation_id, message_id } or null if the line is not a valid SSE event.
 */
export function parseSSELine(line) {
  if (!line.startsWith('data: ')) return null;
  const jsonStr = line.slice(6).trim();
  if (!jsonStr) return null;

  try {
    return JSON.parse(jsonStr);
  } catch (_e) {
    return null;
  }
}

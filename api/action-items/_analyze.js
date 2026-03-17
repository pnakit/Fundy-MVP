/**
 * LLM analysis helper for action item refresh.
 *
 * Calls OpenAI GPT-4o-mini to classify whether an action item has been
 * addressed based on evidence retrieved from the knowledge base.
 */

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

const VALID_STATUSES = new Set(['addressed', 'partially_addressed', 'not_addressed']);

const SYSTEM_PROMPT = `You are an AI assistant that assesses whether a startup action item has been addressed based on evidence from the company's knowledge base. Classify the action item's status and provide a brief explanation.

Respond with valid JSON only — no markdown fences, no extra text:
{
  "status": "addressed" | "partially_addressed" | "not_addressed",
  "confidence": <number between 0.0 and 1.0>,
  "summary": "<1-2 sentence explanation of what evidence was found and whether it addresses the action item>"
}`;

/**
 * Analyze a single action item against retrieved evidence chunks.
 *
 * @param {{ title: string, description?: string, priority?: string, status?: string }} actionItem
 * @param {Array<{ content: string, score?: number }>} evidenceChunks
 * @returns {Promise<{ status: string, confidence: number, summary: string }>}
 */
export async function analyzeActionItem(actionItem, evidenceChunks) {
  // No evidence → skip the LLM call entirely
  if (!evidenceChunks || evidenceChunks.length === 0) {
    return {
      status: 'insufficient_evidence',
      confidence: 0,
      summary: 'No relevant evidence found in knowledge base.',
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const evidenceText = evidenceChunks
    .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
    .join('\n\n');

  const userMessage = `ACTION ITEM:
Title: ${actionItem.title || '(untitled)'}
Description: ${actionItem.description || '(no description)'}
Priority: ${actionItem.priority || 'unknown'}
Current Status: ${actionItem.status || 'pending'}

EVIDENCE FROM KNOWLEDGE BASE (${evidenceChunks.length} results):
${evidenceText}

Based on this evidence, has this action item been addressed?`;

  const response = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 256,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI chat error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || '';

  return parseAnalysisResponse(rawContent);
}

/**
 * Parse and validate the LLM response JSON.
 * Handles markdown fences, malformed JSON, missing fields, and out-of-range values.
 *
 * @param {string} raw - Raw LLM output string
 * @returns {{ status: string, confidence: number, summary: string }}
 */
export function parseAnalysisResponse(raw) {
  let text = (raw || '').trim();

  // Strip markdown code fences (```json ... ```)
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_e) {
    return {
      status: 'not_addressed',
      confidence: 0,
      summary: 'Unable to parse analysis response.',
    };
  }

  // Validate and clamp fields
  const status = VALID_STATUSES.has(parsed.status) ? parsed.status : 'not_addressed';

  let confidence = parseFloat(parsed.confidence);
  if (isNaN(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));

  const summary = typeof parsed.summary === 'string' && parsed.summary.length > 0
    ? parsed.summary
    : 'No analysis summary provided.';

  return { status, confidence, summary };
}

/**
 * Dify Workflow API integration for evaluation generation.
 * Handles calling the Dify /workflows/run endpoint and transforming SSE events.
 */

import { getDifyBaseUrl } from '../_shared.js';

/**
 * Stream an evaluation workflow execution from Dify.
 * Yields transformed events as they arrive.
 *
 * @param {object} inputs - Workflow input variables (company_name + 10 context_* fields)
 * @param {string} apiKey - Dify workflow API key
 * @param {string} userId - User identifier for Dify
 * @yields {{type: string, data?: object, category_id?: string, metadata?: object}}
 */
export async function* streamEvaluation(inputs, apiKey, userId) {
  const baseUrl = getDifyBaseUrl();

  const response = await fetch(`${baseUrl}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs,
      response_mode: 'streaming',
      user: userId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    yield { type: 'error', message: `Dify API error (${response.status}): ${errorText}` };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line for next iteration

      for (const line of lines) {
        const event = parseSSELine(line);
        if (!event) continue;

        const transformed = transformDifyEvent(event);
        if (transformed) {
          yield transformed;
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const event = parseSSELine(buffer);
      if (event) {
        const transformed = transformDifyEvent(event);
        if (transformed) yield transformed;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse a single SSE line from the Dify stream.
 * Lines are in format: "data: {...JSON...}"
 */
function parseSSELine(line) {
  if (!line.startsWith('data: ')) return null;
  const jsonStr = line.slice(6).trim();
  if (!jsonStr) return null;

  try {
    return JSON.parse(jsonStr);
  } catch (_e) {
    return null;
  }
}

/**
 * Transform a Dify SSE event into an app-level evaluation event.
 *
 * Dify events we care about:
 * - node_started: LLM node begins → category_started
 * - node_finished: LLM node completes with outputs → category_complete
 * - workflow_finished: All branches done → workflow_complete
 * - error: Something failed → error
 */
function transformDifyEvent(event) {
  const eventType = event.event;

  if (eventType === 'node_started') {
    const nodeTitle = event.data?.title || '';
    const categoryId = extractCategoryFromNodeTitle(nodeTitle);
    if (categoryId) {
      return { type: 'category_started', category_id: categoryId };
    }
    return null;
  }

  if (eventType === 'node_finished') {
    const nodeTitle = event.data?.title || '';
    const categoryId = extractCategoryFromNodeTitle(nodeTitle);
    if (!categoryId) return null;

    // Extract the LLM output — Dify puts structured output in outputs.text or outputs.result
    const outputs = event.data?.outputs || {};
    const outputText = outputs.text || outputs.result || '';

    try {
      const categoryData = typeof outputText === 'string' ? JSON.parse(outputText) : outputText;
      return { type: 'category_complete', category_id: categoryId, data: categoryData };
    } catch (_e) {
      return {
        type: 'error',
        category_id: categoryId,
        message: `Failed to parse evaluation output for ${categoryId}`,
      };
    }
  }

  if (eventType === 'workflow_finished') {
    return {
      type: 'workflow_complete',
      metadata: {
        total_tokens: event.data?.total_tokens || 0,
        elapsed_time: event.data?.elapsed_time || 0,
      },
    };
  }

  if (eventType === 'error') {
    return { type: 'error', message: event.message || 'Unknown Dify workflow error' };
  }

  return null;
}

/**
 * Extract category ID from Dify node title.
 * Convention: nodes are named "eval_product_technology", "eval_market_traction", etc.
 */
function extractCategoryFromNodeTitle(title) {
  if (!title || !title.startsWith('eval_')) return null;
  return title.slice(5); // Remove "eval_" prefix
}

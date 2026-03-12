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
    console.error(`[_difyWorkflow] Dify API error ${response.status}: ${errorText}`);
    yield { type: 'error', message: `Dify API error (${response.status}): ${errorText}` };
    return;
  }

  console.log('[_difyWorkflow] Dify stream opened, reading events...');

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
 * - node_started: LLM node begins → category_started | investment_matching_started
 * - node_finished: LLM node completes with outputs → category_complete | maturity_calculated | investment_recommendations_complete
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
    if (nodeTitle === 'calculate_maturity') {
      return { type: 'investment_matching_started' };
    }
    return null;
  }

  if (eventType === 'node_finished') {
    const nodeTitle = event.data?.title || '';
    const outputs = event.data?.outputs || {};

    // Category evaluation node (eval_* prefix)
    const categoryId = extractCategoryFromNodeTitle(nodeTitle);
    if (categoryId) {
      // Extract the LLM output — Dify puts structured output in outputs.text or outputs.result.
      // structured_output is preferred (already parsed); text is the fallback JSON string.
      const rawOutput = outputs.structured_output || outputs.text || outputs.result || '';
      try {
        const categoryData = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
        // Override category_id with the node-title-derived value — the node title is the
        // source of truth. The LLM's category_id field may include the "eval_" prefix or
        // otherwise drift, so we never trust it.
        return { type: 'category_complete', category_id: categoryId, data: { ...categoryData, category_id: categoryId } };
      } catch (_e) {
        return {
          type: 'error',
          category_id: categoryId,
          message: `Failed to parse evaluation output for ${categoryId}`,
        };
      }
    }

    // Investment matching phase: maturity calculation node
    if (nodeTitle === 'calculate_maturity') {
      return {
        type: 'maturity_calculated',
        data: {
          maturity_score: outputs.maturity_score,
          maturity_stage: outputs.maturity_stage,
          maturity_label: outputs.maturity_label,
          performance_level: outputs.performance_level,
          performance_label: outputs.performance_label,
          overall_completeness: outputs.overall_completeness,
        },
      };
    }

    // Investment recommendations LLM node — detected by structured output shape
    if (outputs.investment_readiness_summary) {
      console.log('[_difyWorkflow] investment_recommendations_complete detected, keys:', Object.keys(outputs));
      return { type: 'investment_recommendations_complete', data: outputs };
    }

    // Kickstart nodes — fire at two silent points to keep the SSE connection alive:
    //   workflow_kickstart   → before KB Iteration (~1s in)
    //   workflow_evaluating  → after KB Iteration / before 10 LLMs (~10-20s in)
    if (nodeTitle === 'workflow_kickstart') {
      return { type: 'status', message: outputs.status || 'Retrieving knowledge base context...' };
    }
    if (nodeTitle === 'workflow_evaluating') {
      return { type: 'status', message: outputs.status || 'Evaluating categories...' };
    }

    return null;
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
 * Known category IDs — the source of truth for what evaluation categories exist.
 *
 * Naming contract:
 *   - App-level IDs (EVALUATION_DIMENSIONS, evaluationApi.js): bare form, e.g. "business_model"
 *   - Dify node titles: "eval_" prefix, e.g. "eval_business_model"
 *   - Dify context inputs: "context_" prefix, e.g. "context_business_model"
 *
 * To add a new category: add its bare ID here AND add it to EVALUATION_DIMENSIONS in App.jsx
 * AND create a Dify node named "eval_<id>".
 */
const VALID_CATEGORY_IDS = new Set([
  'product_technology',
  'market_traction',
  'business_model',
  'team_organization',
  'go_to_market',
  'financial_health',
  'fundraising_capital',
  'competitive_position',
  'operations',
  'legal_compliance',
]);

/**
 * Extract category ID from Dify node title.
 * Convention: nodes are named "eval_product_technology", "eval_market_traction", etc.
 * Returns null for unknown categories so they're silently ignored rather than corrupting data.
 */
function extractCategoryFromNodeTitle(title) {
  if (!title?.startsWith('eval_')) return null;
  const id = title.slice(5);
  return VALID_CATEGORY_IDS.has(id) ? id : null;
}

/**
 * LLM analysis helper for action item refresh.
 *
 * Uses AI SDK generateObject with Zod schema to classify whether an action
 * item has been addressed based on evidence retrieved from the knowledge base.
 */

import { generateObject } from 'ai';
import { getModel } from '../_llm.js';
import { z } from 'zod';

const AnalysisSchema = z.object({
  status: z.enum(['addressed', 'partially_addressed', 'not_addressed']),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
});

const SYSTEM_PROMPT = `You are an AI assistant that assesses whether a startup action item has been addressed based on evidence from the company's knowledge base. Classify the action item's status and provide a brief explanation.`;

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

  try {
    const model = getModel('LLM_ANALYSIS_MODEL');
    const { object } = await generateObject({
      model,
      schema: AnalysisSchema,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
    });
    return object;
  } catch (err) {
    return {
      status: 'not_addressed',
      confidence: 0,
      summary: `Analysis failed: ${err.message}`,
    };
  }
}

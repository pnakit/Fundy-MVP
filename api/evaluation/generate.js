/**
 * POST /api/evaluation/generate
 *
 * Main evaluation endpoint. Orchestrates:
 * 1. Deep dive conversation embedding (enriches KB before retrieval)
 * 2. Dify Workflow execution (streaming) — Dify iteration handles KB retrieval
 * 3. SSE stream transformation back to frontend
 *
 * Auth: User JWT (via _auth.js)
 * Response: text/event-stream (SSE)
 *
 * Mock mode: When DIFY_EVALUATION_API_KEY is not set, returns simulated
 * streaming results derived from the onboarding summary. This lets you
 * test the full pipeline (frontend → API → SSE) without a Dify workflow
 * configured.
 */

import { verifyAuth } from '../_auth.js';

export const config = { runtime: 'edge' };
import { getSupabaseAdmin } from '../_supabase.js';
import { resolveApiKey } from '../_shared.js';
import { chunkConversation } from '../_chunking.js';
import { generateEmbeddings } from '../knowledge/_embeddings.js';
import { streamEvaluation } from './_difyWorkflow.js';
import { generateObject } from 'ai';
import { getModel } from '../_llm.js';
import { buildEvalPrompt, EvalCategorySchema, CATEGORY_TITLES } from '../_prompts/evaluation.js';
import { buildInvestmentPrompt, InvestmentOutputSchema } from '../_prompts/investment.js';
import { calculateMaturity, generateInvestmentMatrix } from './_maturity.js';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Step 1: Authenticate user
  const auth = await verifyAuth(req);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = auth.user.sub;
  const { companyName, onboardingSummary, documentContext } = await req.json();

  if (!companyName) {
    return new Response(JSON.stringify({ error: 'companyName is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Step 2: Determine evaluation mode
  const useLLMDirect = !!process.env.LLM_EVAL_MODEL;

  // Only resolve Dify API key when not using direct LLM path
  let useMock = false;
  if (!useLLMDirect) {
    const { apiKey } = resolveApiKey('evaluation');
    useMock = !apiKey || apiKey === resolveApiKey('onboarding').apiKey;
  }

  // Set up SSE stream using Web Streams API (required for Edge Runtime)
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        if (useLLMDirect) {
          // ── Direct LLM evaluation path ──
          sendEvent({ type: 'status', message: 'Preparing knowledge base...' });
          await embedDeepDiveConversations(userId);

          sendEvent({ type: 'status', message: 'Evaluating across 10 dimensions...' });

          const CATEGORY_IDS = Object.keys(CATEGORY_TITLES);
          const evalModel = getModel('LLM_EVAL_MODEL');

          // 10 parallel evaluation calls
          const evalPromises = CATEGORY_IDS.map(async (categoryId) => {
            sendEvent({ type: 'category_started', category_id: categoryId });

            const { system, user } = buildEvalPrompt(
              categoryId,
              onboardingSummary ? JSON.stringify(onboardingSummary) : '',
              documentContext || '',
            );

            try {
              const { object } = await generateObject({
                model: evalModel,
                schema: EvalCategorySchema,
                messages: [
                  { role: 'system', content: system },
                  { role: 'user', content: user },
                ],
                temperature: 0.3,
              });

              object.category_id = categoryId;
              object.category_title = CATEGORY_TITLES[categoryId];

              sendEvent({ type: 'category_complete', category_id: categoryId, data: object });
              return { categoryId, data: object, error: null };
            } catch (err) {
              sendEvent({
                type: 'error',
                category_id: categoryId,
                message: `Failed to evaluate ${categoryId}: ${err.message}`,
              });
              return { categoryId, data: null, error: err.message };
            }
          });

          const evalResults = await Promise.allSettled(evalPromises);
          const categoryResults = {};
          for (const result of evalResults) {
            const val =
              result.status === 'fulfilled'
                ? result.value
                : { categoryId: 'unknown', data: null, error: result.reason };
            if (val.data) categoryResults[val.categoryId] = val.data;
          }

          // Maturity calculation (deterministic, no LLM)
          sendEvent({ type: 'status', message: 'Calculating maturity stage...' });
          const maturityData = calculateMaturity(categoryResults);
          sendEvent({ type: 'maturity_calculated', data: maturityData });

          // Phase 2: Investment recommendations
          const investmentMatrix = generateInvestmentMatrix(categoryResults, maturityData);
          sendEvent({ type: 'investment_matrix', data: investmentMatrix });

          sendEvent({ type: 'investment_matching_started' });
          sendEvent({ type: 'status', message: 'Matching investment profiles...' });

          try {
            const { system: invSystem, user: invUser } = buildInvestmentPrompt(
              categoryResults,
              maturityData,
              investmentMatrix,
            );

            const { object: investmentData } = await generateObject({
              model: evalModel,
              schema: InvestmentOutputSchema,
              messages: [
                { role: 'system', content: invSystem },
                { role: 'user', content: invUser },
              ],
              temperature: 0.3,
            });

            sendEvent({ type: 'investment_recommendations_complete', data: investmentData });
          } catch (err) {
            sendEvent({ type: 'error', message: `Investment matching failed: ${err.message}` });
          }

          sendEvent({
            type: 'workflow_complete',
            metadata: { total_categories: Object.keys(categoryResults).length },
          });
        } else if (useMock) {
          // ── Mock mode: simulate evaluation from onboarding summary ──
          sendEvent({ type: 'status', message: 'Mock mode — generating evaluation from onboarding data...' });

          await streamMockEvaluation(sendEvent, onboardingSummary);
        } else {
          // ── Real mode: embed deep dive conversations, then run Dify workflow ──
          // Dify's own iteration handles KB retrieval; we just ensure deep dive
          // conversations are embedded so they're available for vector search.
          sendEvent({ type: 'status', message: 'Preparing knowledge base...' });
          await embedDeepDiveConversations(userId);

          const { apiKey } = resolveApiKey('evaluation');

          const inputs = {
            company_name: companyName,
            user_id: userId,
          };

          sendEvent({ type: 'status', message: 'Starting evaluation workflow...' });
          console.log(`[generate] Calling Dify workflow for user ${userId}, company="${companyName}"`);

          for await (const event of streamEvaluation(inputs, apiKey, userId)) {
            if (event.type === 'error') {
              console.error(`[generate] Dify error event: ${event.message}`);
            }
            sendEvent(event);
            if (event.type === 'error' && !event.category_id) {
              break;
            }
          }

          console.log(`[generate] Dify workflow stream complete for user ${userId}`);
        }
      } catch (err) {
        console.error(`[generate] Uncaught error: ${err.message}`, err.stack);
        sendEvent({ type: 'error', message: err.message || 'Evaluation generation failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Mock evaluation: derives category results from the onboarding summary
 * with simulated delays (300-800ms per category) to test the streaming UX.
 */
async function streamMockEvaluation(sendEvent, onboardingSummary) {
  const categoriesMap = {};
  if (onboardingSummary?.categories) {
    for (const cat of onboardingSummary.categories) {
      categoriesMap[cat.id] = cat;
    }
  }

  const categoryIds = Object.keys(CATEGORY_TITLES);

  for (const categoryId of categoryIds) {
    sendEvent({ type: 'category_started', category_id: categoryId });

    // Simulated processing delay (300-800ms)
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));

    const onboardingCat = categoriesMap[categoryId];
    const completeness = onboardingCat?.completeness ?? Math.floor(Math.random() * 60 + 20);
    const status = completeness >= 70 ? 'complete' : completeness >= 40 ? 'needs_attention' : 'incomplete';

    sendEvent({
      type: 'category_complete',
      category_id: categoryId,
      data: {
        category_id: categoryId,
        category_title: CATEGORY_TITLES[categoryId],
        summary: onboardingCat?.summary || `Mock evaluation for ${CATEGORY_TITLES[categoryId]}.`,
        completeness,
        status,
        highlights: onboardingCat?.highlights || [],
        gaps: onboardingCat?.gaps || [],
        keyMetrics: onboardingCat?.keyMetrics || {},
        deepDivePrompt: onboardingCat?.deepDivePrompt || `Let's explore ${CATEGORY_TITLES[categoryId]} further.`,
      },
    });
  }

  // Phase 2 (investment matching) is handled by /api/evaluation/investment-match,
  // called by the client after this Phase 1 stream ends.
  sendEvent({
    type: 'workflow_complete',
    metadata: { total_tokens: 0, elapsed_time: 0, mock: true },
  });
}

/**
 * Embed all deep dive conversation messages for the user into the vector store.
 * Called before the Dify evaluation workflow so that KB retrieval inside Dify
 * can find category-specific deep dive content.
 *
 * Non-fatal — logs errors without throwing so evaluation can still proceed.
 */
async function embedDeepDiveConversations(userId) {
  try {
    const supabase = getSupabaseAdmin();

    const { data: convs } = await supabase
      .from('conversations')
      .select('id, category_id')
      .eq('user_id', userId)
      .eq('workflow', 'deepdive');

    if (!convs?.length) return;

    // Fetch messages for all deep dive conversations in parallel
    const convMessages = await Promise.all(
      convs.map(async (conv) => {
        const { data: msgs } = await supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', conv.id)
          .order('created_at');
        return { conv, msgs: msgs || [] };
      }),
    );

    // Chunk all conversations and batch embed in one OpenAI call
    const allChunks = [];
    const chunkConvMap = []; // tracks which conv each chunk belongs to

    for (const { conv, msgs } of convMessages) {
      if (msgs.length === 0) continue;
      const chunks = chunkConversation(msgs, { workflow: 'deepdive', category_id: conv.category_id });
      for (const chunk of chunks) {
        allChunks.push(chunk);
        chunkConvMap.push(conv);
      }
    }

    if (allChunks.length === 0) return;

    const embeddings = await generateEmbeddings(allChunks.map((c) => c.content));

    const rows = allChunks.map((chunk, i) => ({
      user_id: userId,
      source_type: 'conversation',
      source_id: chunkConvMap[i].id,
      chunk_index: chunk.chunk_index ?? i,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      metadata: chunk.metadata || {},
    }));

    // Delete stale deep-dive embeddings before inserting fresh ones
    // (prevents orphaned chunks if conversation length changed between runs)
    const convIds = [...new Set(chunkConvMap.map((c) => c.id))];
    for (const convId of convIds) {
      await supabase
        .from('document_embeddings')
        .delete()
        .eq('user_id', userId)
        .eq('source_type', 'conversation')
        .eq('source_id', convId);
    }

    const { error } = await supabase
      .from('document_embeddings')
      .upsert(rows, { onConflict: 'source_type,source_id,chunk_index' });

    if (error) {
      console.error('[generate] Failed to upsert deep dive embeddings:', error.message);
    } else {
      console.log(`[generate] Embedded ${rows.length} deep dive chunks for user ${userId}`);
    }
  } catch (err) {
    console.error('[generate] Deep dive embedding failed (non-fatal):', err.message);
  }
}

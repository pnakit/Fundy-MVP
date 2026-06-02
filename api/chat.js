import { resolveApiKey, getDifyBaseUrl } from './_shared.js';
import { verifyAuth } from './_auth.js';
import { getSupabaseAdmin } from './_supabase.js';
import { chunkFileText } from './_chunking.js';
import { generateEmbeddings } from './knowledge/_embeddings.js';
import { streamText } from 'ai';
import { getModel } from './_llm.js';
import { buildOnboardingMessages } from './_prompts/onboarding.js';
import { buildDeepDiveSystemPrompt, buildDeepDiveMessages } from './_prompts/deepdive.js';

// Title of the Code node in both Dify chatflows that passes through File Extractor text.
// The node emits a node_finished event with outputs.file_text = extracted file content.
const FILE_TEXT_RELAY_NODE = 'File Text Relay';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

const ACTION_ITEM_SYSTEM_PROMPT = `You are a startup advisor helping validate whether a specific action item has been completed.

Your role:
1. Ask targeted questions to understand what concrete steps have been taken
2. Request specific evidence or documentation (metrics, links, contracts, screenshots, dates)
3. Identify gaps if the item is only partially addressed
4. End conversations with a clear verdict: fully complete, partially complete, or not yet addressed

Keep responses short and direct. Ask one or two focused questions at a time. No fluff.`;

/**
 * Handle action item validation chat via OpenAI GPT-4o-mini.
 * Accepts conversation history in inputs.history so context persists across turns.
 * Emits Dify-compatible SSE events so the client parser needs no changes.
 */
async function handleActionItemChat(req, res, { query, inputs, response_mode, userId }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const { action_title = '', action_description = '', gap_type = 'table_stakes', history = [] } = inputs || {};
  const typeLabel = gap_type === 'stretch' ? 'stretch goal' : 'must-have milestone';

  const systemContent = `${ACTION_ITEM_SYSTEM_PROMPT}

Action item: ${action_title}
Details: ${action_description}
Type: ${typeLabel}`;

  // Build messages: system + prior history (skip the static welcome message) + current query
  const priorMessages = Array.isArray(history) ? history.slice(1) : []; // skip welcome
  const messages = [
    { role: 'system', content: systemContent },
    ...priorMessages,
    { role: 'user', content: query },
  ];

  const fakeConvId = `action-oai-${userId}`;
  const fakeMessageId = `msg-${Date.now()}`;

  if (response_mode === 'streaming') {
    let openaiRes;
    try {
      openaiRes = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.4, stream: true }),
      });
    } catch (err) {
      return res.status(502).json({ error: `OpenAI fetch failed: ${err.message}` });
    }
    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return res.status(openaiRes.status).json({ error: `OpenAI error: ${errText}` });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = openaiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const emitDify = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (raw === '[DONE]') continue;
          try {
            const chunk = JSON.parse(raw);
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              emitDify({ event: 'message', answer: delta, conversation_id: fakeConvId, message_id: fakeMessageId });
            }
          } catch (_) { /* ignore malformed chunks */ }
        }
      }
      emitDify({ event: 'message_end', conversation_id: fakeConvId, message_id: fakeMessageId });
    } finally {
      res.end();
    }
  } else {
    let openaiRes;
    try {
      openaiRes = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.4 }),
      });
    } catch (err) {
      return res.status(502).json({ error: `OpenAI fetch failed: ${err.message}` });
    }
    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return res.status(openaiRes.status).json({ error: `OpenAI error: ${errText}` });
    }
    const data = await openaiRes.json();
    const answer = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ answer, conversation_id: fakeConvId, message_id: fakeMessageId });
  }
}

/**
 * Handle onboarding chat via direct LLM (AI SDK streamText).
 * Feature-flagged: only called when LLM_CHAT_MODEL env var is set.
 * Loads conversation history from Supabase and emits Dify-compatible SSE events.
 */
async function handleOnboardingDirect(req, res, { query, userId }) {
  const model = getModel('LLM_CHAT_MODEL');
  const supabase = getSupabaseAdmin();

  // Load existing conversation history from Supabase
  const { data: convRow } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('workflow', 'onboarding')
    .maybeSingle();

  let conversationHistory = [];
  if (convRow) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', convRow.id)
      .order('created_at', { ascending: true });
    if (msgs) conversationHistory = msgs;
  }

  const messages = buildOnboardingMessages([
    ...conversationHistory,
    { role: 'user', content: query },
  ]);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const conversationId = `local-${Date.now()}`;
  const messageId = `msg-${Date.now()}`;

  try {
    const result = streamText({
      model,
      messages,
      temperature: 0.7,
    });

    for await (const chunk of result.textStream) {
      const event = {
        event: 'message',
        answer: chunk,
        conversation_id: conversationId,
      };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Send message_end event
    const endEvent = {
      event: 'message_end',
      conversation_id: conversationId,
      message_id: messageId,
    };
    res.write(`data: ${JSON.stringify(endEvent)}\n\n`);
  } catch (err) {
    console.error('[chat] Direct LLM error:', err.message);
    const errorEvent = { event: 'error', message: err.message };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
  } finally {
    res.end();
  }
}

/**
 * Handle deep-dive chat via direct LLM (AI SDK streamText).
 * Feature-flagged: only called when LLM_CHAT_MODEL env var is set.
 * Loads onboarding summary + category-specific conversation history from Supabase.
 * Emits Dify-compatible SSE events.
 */
async function handleDeepDiveDirect(req, res, { query, categoryId, userId }) {
  const model = getModel('LLM_CHAT_MODEL');
  const supabase = getSupabaseAdmin();

  // Load onboarding summary
  const { data: summaryRow } = await supabase
    .from('onboarding_summaries')
    .select('summary_data')
    .eq('user_id', userId)
    .maybeSingle();

  if (!summaryRow?.summary_data) {
    return res.status(400).json({ error: 'No onboarding summary found. Complete onboarding first.' });
  }

  const systemPrompt = buildDeepDiveSystemPrompt(categoryId, summaryRow.summary_data);

  // Load existing deep-dive conversation history for this category
  const { data: convRow } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('workflow', 'deepdive')
    .eq('category_id', categoryId)
    .maybeSingle();

  let conversationHistory = [];
  if (convRow) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', convRow.id)
      .order('created_at', { ascending: true });
    if (msgs) conversationHistory = msgs;
  }

  const messages = buildDeepDiveMessages(systemPrompt, [
    ...conversationHistory,
    { role: 'user', content: query },
  ]);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const conversationId = `local-${Date.now()}`;
  const messageId = `msg-${Date.now()}`;

  try {
    const result = streamText({ model, messages, temperature: 0.7 });

    for await (const chunk of result.textStream) {
      const event = { event: 'message', answer: chunk, conversation_id: conversationId };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    const endEvent = { event: 'message_end', conversation_id: conversationId, message_id: messageId };
    res.write(`data: ${JSON.stringify(endEvent)}\n\n`);
  } catch (err) {
    console.error('[chat] Deep-dive direct LLM error:', err.message);
    const errorEvent = { event: 'error', message: err.message };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
  } finally {
    res.end();
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const userId = auth.user.sub;
  const { workflow, query, conversation_id, user, files, response_mode, inputs } = req.body;
  console.log(`[chat] REQUEST workflow=${workflow} mode=${response_mode} files=${files?.length ?? 0}`);

  if (workflow === 'action_item') {
    return handleActionItemChat(req, res, { query, inputs, response_mode, userId });
  }

  // Feature flag: use direct LLM for onboarding when LLM_CHAT_MODEL is set
  const useLLMDirect = !!process.env.LLM_CHAT_MODEL;
  console.log(`[chat] LLM_CHAT_MODEL=${process.env.LLM_CHAT_MODEL ?? 'UNSET'} useLLMDirect=${useLLMDirect}`);

  if (useLLMDirect && workflow === 'onboarding') {
    return handleOnboardingDirect(req, res, { query, userId });
  }

  if (useLLMDirect && workflow === 'deepdive') {
    const categoryId = inputs?.category_id;
    if (!categoryId) return res.status(400).json({ error: 'category_id required for deep-dive' });
    return handleDeepDiveDirect(req, res, { query, categoryId, userId });
  }

  const { apiKey, usingFallback } = resolveApiKey(workflow || 'onboarding');

  if (!apiKey) {
    return res.status(500).json({ error: 'No Dify API keys configured' });
  }

  let difyResponse;
  try {
    difyResponse = await fetch(`${getDifyBaseUrl()}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: inputs || {},
        query,
        response_mode: response_mode || 'blocking',
        conversation_id: conversation_id || '',
        user: user || userId,
        files: files || [],
      }),
    });
  } catch (fetchErr) {
    console.error('[chat] Fetch to Dify failed:', fetchErr.message);
    return res.status(502).json({ error: `Failed to reach Dify: ${fetchErr.message}` });
  }

  if (!difyResponse.ok) {
    const errorText = await difyResponse.text();
    console.error(`[chat] Dify rejected request (${difyResponse.status}):`, errorText.substring(0, 500));
    return res.status(difyResponse.status).send(errorText);
  }

  if (response_mode === 'streaming') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (usingFallback) {
      res.setHeader('X-Dify-Fallback', 'true');
    }

    const reader = difyResponse.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    let capturedFileText = null;
    let capturedMessageId = null;

    try {
      const parseEvent = (line) => {
        if (!line.startsWith('data:')) return;
        try {
          const event = JSON.parse(line.slice(5).trim());
          if (event.event === 'node_finished') {
            console.log(`[chat] node_finished title="${event.data?.title}"`);
            if (event.data?.title === FILE_TEXT_RELAY_NODE) {
              capturedFileText = event.data?.outputs?.file_text || null;
              console.log(`[chat] captured file text length=${capturedFileText?.length}`);
            }
          } else if (event.event === 'message_end' || event.event === 'workflow_finished') {
            capturedMessageId = event.message_id || event.id || null;
            console.log(`[chat] ${event.event} captured, message_id=${capturedMessageId}`);
          }
        } catch (parseErr) {
          console.log(`[chat] SSE parse error: ${parseErr.message} line=${line.slice(0, 80)}`);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop();
        for (const line of lines) parseEvent(line);
      }

      // Flush any remaining buffered data (last event may lack trailing newline)
      if (sseBuffer.trim()) parseEvent(sseBuffer.trim());

      // Embed captured file text after stream completes, before closing the connection.
      // Adds ~1-2s latency only on messages that include files.
      console.log(`[chat] Post-stream: fileText=${!!capturedFileText} messageId=${capturedMessageId}`);
      if (capturedFileText && capturedMessageId) {
        try {
          const chunks = chunkFileText(capturedFileText, { file_name: `msg:${capturedMessageId}` });
          if (chunks.length > 0) {
            const embeddings = await generateEmbeddings(chunks.map((c) => c.content));
            const rows = chunks.map((chunk, i) => ({
              user_id: userId,
              source_type: 'file',
              source_id: capturedMessageId,
              chunk_index: chunk.chunk_index ?? i,
              content: chunk.content,
              embedding: JSON.stringify(embeddings[i]),
              metadata: { ...chunk.metadata, workflow: workflow || 'onboarding' },
            }));
            const supabase = getSupabaseAdmin();
            const { error } = await supabase
              .from('document_embeddings')
              .upsert(rows, { onConflict: 'source_type,source_id,chunk_index' });
            if (error) {
              console.error('[chat] File embedding upsert failed:', error.message);
            } else {
              console.log(`[chat] Embedded ${rows.length} file chunks for message ${capturedMessageId}`);
            }
          }
        } catch (embedErr) {
          console.error('[chat] File embedding failed (non-fatal):', embedErr.message);
        }
      }
    } finally {
      res.end();
    }
  } else {
    if (files?.length > 0) {
      console.warn(`[chat] Blocking mode with ${files.length} file(s) — file text cannot be embedded (no SSE node events). Switch to streaming mode to enable file embedding.`);
    }
    const data = await difyResponse.json();
    res.status(200).json({ ...data, _fallback: usingFallback });
  }
}

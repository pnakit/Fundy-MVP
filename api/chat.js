import { resolveApiKey, getDifyBaseUrl } from './_shared.js';
import { verifyAuth } from './_auth.js';
import { getSupabaseAdmin } from './_supabase.js';
import { chunkFileText } from './_chunking.js';
import { generateEmbeddings } from './knowledge/_embeddings.js';

// Title of the Code node in both Dify chatflows that passes through File Extractor text.
// The node emits a node_finished event with outputs.file_text = extracted file content.
const FILE_TEXT_RELAY_NODE = 'File Text Relay';

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

import { resolveApiKey, getDifyBaseUrl } from './_shared.js';
import { verifyAuth } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { workflow, query, conversation_id, user, files, response_mode, inputs } = req.body;
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
        user: user || auth.user.sub,
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
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);

        // Temporary diagnostic: log all SSE events
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const event = JSON.parse(line.slice(5).trim());
            if (event.event === 'node_finished') {
              console.log(`[chat/diag] node_finished title="${event.data?.title}" type="${event.data?.node_type}" outputs=${JSON.stringify(event.data?.outputs)}`);
            } else {
              console.log(`[chat/diag] event="${event.event}"`);
            }
          } catch (_) { /* ignore parse errors */ }
        }
      }
    } finally {
      res.end();
    }
  } else {
    const data = await difyResponse.json();
    res.status(200).json({ ...data, _fallback: usingFallback });
  }
}

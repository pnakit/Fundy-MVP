export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DIFY_API_KEY = process.env.DIFY_API_KEY;
  const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

  if (!DIFY_API_KEY) {
    return res.status(500).json({ error: 'DIFY_API_KEY not configured' });
  }

  const { query, conversation_id, user, files, response_mode, inputs } = req.body;

  const difyResponse = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: inputs || {},
      query,
      response_mode: response_mode || 'blocking',
      conversation_id: conversation_id || '',
      user: user || 'default-user',
      files: files || [],
    }),
  });

  if (!difyResponse.ok) {
    const errorText = await difyResponse.text();
    return res.status(difyResponse.status).send(errorText);
  }

  if (response_mode === 'streaming') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = difyResponse.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      res.end();
    }
  } else {
    const data = await difyResponse.json();
    res.status(200).json(data);
  }
}

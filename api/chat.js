const WORKFLOW_KEYS = {
  onboarding: () => process.env.DIFY_ONBOARDING_API_KEY,
  deepdive: () => process.env.DIFY_DEEPDIVE_API_KEY,
};

function resolveApiKey(workflow) {
  const getter = WORKFLOW_KEYS[workflow];
  const requestedKey = getter ? getter() : undefined;
  const fallbackKey = WORKFLOW_KEYS.onboarding();
  const apiKey = requestedKey || fallbackKey;
  const usingFallback = !requestedKey && workflow !== 'onboarding';
  return { apiKey, usingFallback };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
  const { workflow, query, conversation_id, user, files, response_mode, inputs } = req.body;

  const { apiKey, usingFallback } = resolveApiKey(workflow || 'onboarding');

  if (!apiKey) {
    return res.status(500).json({ error: 'No Dify API keys configured' });
  }

  const difyResponse = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
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
    if (usingFallback) {
      res.setHeader('X-Dify-Fallback', 'true');
    }

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
    res.status(200).json({ ...data, _fallback: usingFallback });
  }
}

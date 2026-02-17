const WORKFLOW_KEYS = {
  onboarding: () => process.env.DIFY_ONBOARDING_API_KEY,
  deepdive: () => process.env.DIFY_DEEPDIVE_API_KEY,
};

function resolveApiKey(workflow) {
  const getter = WORKFLOW_KEYS[workflow];
  const requestedKey = getter ? getter() : undefined;
  const fallbackKey = WORKFLOW_KEYS.onboarding();
  return requestedKey || fallbackKey;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
  const { workflow, task_id, user } = req.body;

  if (!task_id) {
    return res.status(400).json({ error: 'task_id is required' });
  }

  const apiKey = resolveApiKey(workflow || 'onboarding');

  if (!apiKey) {
    return res.status(500).json({ error: 'No Dify API keys configured' });
  }

  const response = await fetch(`${DIFY_BASE_URL}/chat-messages/${task_id}/stop`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user: user || 'default-user' }),
  });

  const data = await response.json();
  res.status(response.status).json(data);
}

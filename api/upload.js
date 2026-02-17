export const config = {
  api: {
    bodyParser: false,
  },
};

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
  const workflow = req.query.workflow || req.headers['x-dify-workflow'] || 'onboarding';
  const apiKey = resolveApiKey(workflow);

  if (!apiKey) {
    return res.status(500).json({ error: 'No Dify API keys configured' });
  }

  const response = await fetch(`${DIFY_BASE_URL}/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': req.headers['content-type'],
    },
    body: req,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return res.status(response.status).send(errorText);
  }

  const data = await response.json();
  res.status(200).json(data);
}

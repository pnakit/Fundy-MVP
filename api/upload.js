import { resolveApiKey, getDifyBaseUrl } from './_shared.js';
import { verifyAuth } from './_auth.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const workflow = req.query.workflow || req.headers['x-dify-workflow'] || 'onboarding';
  const { apiKey } = resolveApiKey(workflow);

  if (!apiKey) {
    return res.status(500).json({ error: 'No Dify API keys configured' });
  }

  const response = await fetch(`${getDifyBaseUrl()}/files/upload`, {
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

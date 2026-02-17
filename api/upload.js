export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DIFY_API_KEY = process.env.DIFY_API_KEY;
  const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

  if (!DIFY_API_KEY) {
    return res.status(500).json({ error: 'DIFY_API_KEY not configured' });
  }

  const response = await fetch(`${DIFY_BASE_URL}/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
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

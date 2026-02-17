export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DIFY_API_KEY = process.env.DIFY_API_KEY;
  const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

  if (!DIFY_API_KEY) {
    return res.status(500).json({ error: 'DIFY_API_KEY not configured' });
  }

  const { task_id, user } = req.body;

  if (!task_id) {
    return res.status(400).json({ error: 'task_id is required' });
  }

  const response = await fetch(`${DIFY_BASE_URL}/chat-messages/${task_id}/stop`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user: user || 'default-user' }),
  });

  const data = await response.json();
  res.status(response.status).json(data);
}

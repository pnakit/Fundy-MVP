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

  // Buffer the request body — streaming `req` directly into fetch can silently
  // fail in some Vercel Node.js environments when the stream is consumed too early.
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);

  let response;
  try {
    response = await fetch(`${getDifyBaseUrl()}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': req.headers['content-type'],
      },
      body,
    });
  } catch (fetchErr) {
    console.error('[upload] Fetch to Dify failed:', fetchErr.message);
    return res.status(502).json({ error: `Failed to reach Dify: ${fetchErr.message}` });
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[upload] Dify rejected upload (${response.status}):`, errorText);
    return res.status(response.status).send(errorText);
  }

  const data = await response.json();
  res.status(200).json(data);
}

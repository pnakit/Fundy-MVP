import { verifyAuth } from './_auth.js';
import { parseOfficeAsync } from 'officeparser';

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

  try {
    // Buffer the raw request body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    // Parse multipart form data to extract the file
    const boundary = req.headers['content-type']?.split('boundary=')[1];
    if (!boundary) {
      return res.status(400).json({ error: 'Missing multipart boundary' });
    }

    const { fileName, fileBuffer } = parseMultipart(body, boundary);

    // Extract text using officeparser
    const extractedText = await parseOfficeAsync(fileBuffer);

    return res.status(200).json({
      id: `file-${Date.now()}`,
      name: fileName,
      size: fileBuffer.length,
      extracted_text: extractedText || '',
    });
  } catch (err) {
    console.error('[upload] Error:', err.message);
    return res.status(500).json({ error: 'File processing failed' });
  }
}

function parseMultipart(body, boundary) {
  const boundaryBytes = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = body.indexOf(boundaryBytes) + boundaryBytes.length;

  while (start < body.length) {
    const nextBoundary = body.indexOf(boundaryBytes, start);
    if (nextBoundary === -1) break;

    const part = body.slice(start, nextBoundary);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) { start = nextBoundary + boundaryBytes.length; continue; }

    const headers = part.slice(0, headerEnd).toString('utf8');
    const content = part.slice(headerEnd + 4, part.length - 2); // trim trailing \r\n

    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);

    if (nameMatch && filenameMatch) {
      parts.push({ name: nameMatch[1], fileName: filenameMatch[1], buffer: content });
    }
    start = nextBoundary + boundaryBytes.length;
  }

  const filePart = parts.find(p => p.name === 'file');
  if (!filePart) throw new Error('No file field in multipart body');
  return { fileName: filePart.fileName, fileBuffer: filePart.buffer };
}

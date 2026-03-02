/**
 * Verify the Dify webhook secret from the request headers.
 * Returns { valid: true } on success or { error, status } on failure.
 *
 * Accepts the secret from either:
 *   - X-Webhook-Secret header (preferred)
 *   - Authorization: Bearer <secret> header (fallback)
 */
export function verifyWebhook(req) {
  const secret = process.env.DIFY_WEBHOOK_SECRET;
  if (!secret) {
    return { error: 'DIFY_WEBHOOK_SECRET not configured', status: 500 };
  }

  const provided =
    req.headers['x-webhook-secret'] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!provided) {
    return { error: 'Missing webhook secret', status: 401 };
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(provided, secret)) {
    return { error: 'Invalid webhook secret', status: 403 };
  }

  return { valid: true };
}

/**
 * Constant-time string comparison via XOR.
 * Returns false immediately if lengths differ (acceptable — length is not secret).
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let mismatch = 0;
  for (let i = 0; i < bufA.length; i++) {
    mismatch |= bufA[i] ^ bufB[i];
  }
  return mismatch === 0;
}

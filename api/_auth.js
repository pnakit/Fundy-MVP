import { createRemoteJWKSet, jwtVerify } from 'jose';

const supabaseUrl = process.env.SUPABASE_URL;

let jwks;
function getJWKS() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

/**
 * Verify the JWT from the Authorization header.
 * Returns { user } on success or { error, status } on failure.
 */
export async function verifyAuth(req) {
  if (!supabaseUrl) {
    return { error: 'SUPABASE_URL not configured', status: 500 };
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return { error: 'Missing authorization token', status: 401 };
  }

  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: `${supabaseUrl}/auth/v1`,
      audience: 'authenticated',
    });
    return { user: payload };
  } catch (err) {
    const message = err.code === 'ERR_JWT_EXPIRED' ? 'Token expired' : 'Invalid token';
    return { error: message, status: 401 };
  }
}

/**
 * CORS handling. The frontend may be served same-origin (no CORS needed) or
 * from a different domain. Allowed origins are configured via `ALLOWED_ORIGINS`
 * ("*" or a comma-separated list).
 */
import type { Env } from './types';

const ALLOWED_METHODS = 'POST, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, X-Session-Id';
const MAX_AGE = '86400';

function allowList(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '*')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/** Resolve the value for Access-Control-Allow-Origin, or null if disallowed. */
function resolveAllowedOrigin(env: Env, requestOrigin: string | null): string | null {
  const list = allowList(env);
  if (list.includes('*')) return '*';
  if (requestOrigin && list.includes(requestOrigin)) return requestOrigin;
  return null;
}

/**
 * Hard, server-side origin gate (CORS headers alone don't block non-browser
 * clients). Returns true if the request is permitted to call the API.
 * When the allow-list is "*", every origin is allowed.
 */
export function isOriginAllowed(env: Env, request: Request): boolean {
  const list = allowList(env);
  if (list.includes('*')) return true;
  const origin = request.headers.get('Origin');
  if (origin && list.includes(origin)) return true;
  // Fall back to Referer for environments that omit Origin on same-origin POSTs.
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      return list.includes(new URL(referer).origin);
    } catch {
      return false;
    }
  }
  return false;
}

export function corsHeaders(env: Env, request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get('Origin');
  const allowed = resolveAllowedOrigin(env, origin);
  if (allowed) {
    headers.set('Access-Control-Allow-Origin', allowed);
    if (allowed !== '*') headers.append('Vary', 'Origin');
  }
  return headers;
}

export function handlePreflight(env: Env, request: Request): Response {
  const headers = corsHeaders(env, request);
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  headers.set('Access-Control-Max-Age', MAX_AGE);
  return new Response(null, { status: 204, headers });
}

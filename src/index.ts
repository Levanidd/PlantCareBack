/**
 * Plant Care Agent — Cloudflare Worker backend.
 *
 * Skills-based agent: intent detection → content skills → composer → response.
 *
 * Routes:
 *   POST /analyze | /api/analyze        → AgentResponse
 *   GET  /health  | /api/health         → { ok: true }
 *   GET  /history | /api/history        → history list (X-Session-Id)
 *   GET  /history/:id                   → history item
 *   DELETE /history/:id                 → delete history item
 */
import {
  deleteHistoryItem,
  getHistoryItem,
  listHistory,
  runAgent,
} from './agent/orchestrator';
import { handleConfigRoute } from './config/routes';
import { corsHeaders, handlePreflight, isOriginAllowed } from './cors';
import { HttpError } from './errors';
import { checkRateLimit } from './ratelimit';
import type { Env } from './types';
import { parseAnalyzeRequest } from './validation';

const MAX_BODY_BYTES = 16 * 1024 * 1024;

function json(data: unknown, status: number, base?: Headers): Response {
  const headers = new Headers(base);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(message: string, status: number, base?: Headers): Response {
  return json({ message }, status, base);
}

function normalizePath(pathname: string): string {
  let p = pathname.replace(/\/+$/, '');
  if (p.startsWith('/api')) p = p.slice('/api'.length);
  return p === '' ? '/' : p;
}

function sessionId(request: Request): string {
  const id = request.headers.get('X-Session-Id')?.trim();
  if (!id) throw new HttpError(400, 'Missing X-Session-Id header.');
  return id;
}

function requireOrigin(env: Env, request: Request): void {
  if (!isOriginAllowed(env, request)) {
    throw new HttpError(403, 'Forbidden: requests are only allowed from the official app.');
  }
}

async function handleAnalyze(env: Env, request: Request, cors: Headers): Promise<Response> {
  requireOrigin(env, request);

  const rate = await checkRateLimit(env, request);
  if (!rate.allowed) {
    const headers = new Headers(cors);
    headers.set('Retry-After', String(rate.retryAfter));
    return errorResponse('Too many requests. Please slow down and try again shortly.', 429, headers);
  }

  const contentLength = Number.parseInt(request.headers.get('Content-Length') ?? '', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return errorResponse('Request is too large. Please use a smaller image.', 413, cors);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400, cors);
  }

  const maxImageBytes = Number.parseInt(env.MAX_IMAGE_BYTES ?? '', 10);
  const normalized = parseAnalyzeRequest(body, maxImageBytes);
  const sid = sessionId(request);
  const result = await runAgent(env, normalized, sid);
  return json(result, 200, cors);
}

async function handleHistoryList(env: Env, request: Request, cors: Headers): Promise<Response> {
  requireOrigin(env, request);
  const sid = sessionId(request);
  const items = await listHistory(env, sid);
  return json({ historyList: items }, 200, cors);
}

async function handleHistoryGet(
  env: Env,
  request: Request,
  cors: Headers,
  itemId: string,
): Promise<Response> {
  requireOrigin(env, request);
  const sid = sessionId(request);
  const item = await getHistoryItem(env, sid, itemId);
  if (!item) return errorResponse('History item not found.', 404, cors);
  return json({ historyItemDetails: item }, 200, cors);
}

async function handleHistoryDelete(
  env: Env,
  request: Request,
  cors: Headers,
  itemId: string,
): Promise<Response> {
  requireOrigin(env, request);
  const sid = sessionId(request);
  const deleted = await deleteHistoryItem(env, sid, itemId);
  if (!deleted) return errorResponse('History item not found.', 404, cors);
  return json({ deleteStatus: 'ok' }, 200, cors);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(env, request);

    if (request.method === 'OPTIONS') {
      return handlePreflight(env, request);
    }

    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    try {
      if (path === '/health') {
        if (request.method !== 'GET') return errorResponse('Method not allowed.', 405, cors);
        return json({ ok: true }, 200, cors);
      }

      if (path === '/analyze') {
        if (request.method !== 'POST') return errorResponse('Method not allowed.', 405, cors);
        return await handleAnalyze(env, request, cors);
      }

      if (path === '/history') {
        if (request.method !== 'GET') return errorResponse('Method not allowed.', 405, cors);
        return await handleHistoryList(env, request, cors);
      }

      const historyMatch = /^\/history\/([^/]+)$/.exec(path);
      if (historyMatch) {
        const itemId = decodeURIComponent(historyMatch[1]);
        if (request.method === 'GET') {
          return await handleHistoryGet(env, request, cors, itemId);
        }
        if (request.method === 'DELETE') {
          return await handleHistoryDelete(env, request, cors, itemId);
        }
        return errorResponse('Method not allowed.', 405, cors);
      }

      if (path.startsWith('/config')) {
        requireOrigin(env, request);
        const configResponse = await handleConfigRoute(env, request, path, (data, status) =>
          json(data, status, cors),
        (msg, status) => errorResponse(msg, status, cors),
        );
        if (configResponse) return configResponse;
      }

      return errorResponse('Not found.', 404, cors);
    } catch (err) {
      if (err instanceof HttpError) {
        return errorResponse(err.message, err.status, cors);
      }
      console.error('Unhandled error:', (err as Error)?.message);
      return errorResponse('Something went wrong. Please try again.', 500, cors);
    }
  },
};

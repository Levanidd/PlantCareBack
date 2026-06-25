/**
 * Plant Care Agent — Cloudflare Worker backend.
 *
 * Single responsibility: accept a question and/or photo, call Gemini
 * (server-side, key never exposed), and return a structured PlantCareResult.
 *
 * Routes (both bare and "/api" prefixed, so it works whether mounted at the
 * origin root or under /api/*):
 *   POST /analyze | /api/analyze   → PlantCareResult
 *   GET  /health  | /api/health    → { ok: true }
 */
import { corsHeaders, handlePreflight, isOriginAllowed } from './cors';
import { HttpError } from './errors';
import { analyzeWithGemini } from './gemini';
import { checkRateLimit } from './ratelimit';
import type { Env } from './types';
import { parseAnalyzeRequest } from './validation';

/** Generous cap on the whole JSON body (base64 image + envelope). */
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

async function handleAnalyze(env: Env, request: Request, cors: Headers): Promise<Response> {
  if (!isOriginAllowed(env, request)) {
    return errorResponse('Forbidden: requests are only allowed from the official app.', 403, cors);
  }

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
  const result = await analyzeWithGemini(env, normalized);
  return json(result, 200, cors);
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
        if (request.method !== 'GET') {
          return errorResponse('Method not allowed.', 405, cors);
        }
        return json({ ok: true }, 200, cors);
      }

      if (path === '/analyze') {
        if (request.method !== 'POST') {
          return errorResponse('Method not allowed.', 405, cors);
        }
        return await handleAnalyze(env, request, cors);
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

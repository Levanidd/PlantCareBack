/**
 * Low-level Gemini API client. All model calls go through here.
 * The API key never leaves the server.
 */
import { HttpError } from '../errors';
import type { Env } from '../types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 45_000;

export interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  promptFeedback?: { blockReason?: string };
}

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
];

export function requireApiKey(env: Env): string {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured.');
    throw new HttpError(500, 'The service is not configured correctly. Please try again later.');
  }
  return apiKey;
}

export async function callGeminiJson<T>(
  env: Env,
  options: {
    systemPrompt: string;
    userParts: GeminiPart[];
    responseSchema: Record<string, unknown>;
    temperature?: number;
    timeoutMs?: number;
  },
): Promise<T> {
  const apiKey = requireApiKey(env);
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const payload = {
    systemInstruction: { parts: [{ text: options.systemPrompt }] },
    contents: [{ role: 'user', parts: options.userParts }],
    generationConfig: {
      temperature: options.temperature ?? 0.35,
      responseMimeType: 'application/json',
      responseSchema: options.responseSchema,
    },
    safetySettings: SAFETY_SETTINGS,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if ((err as Error)?.name === 'AbortError') {
      throw new HttpError(504, 'The analysis timed out. Please try again.');
    }
    console.error('Gemini fetch failed:', (err as Error)?.message);
    throw new HttpError(502, 'Could not reach the analysis service. Please try again.');
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const status = response.status;
    console.error(`Gemini returned HTTP ${status}.`);
    if (status === 429) {
      throw new HttpError(429, 'The service is busy right now. Please try again in a moment.');
    }
    throw new HttpError(502, 'The analysis service returned an error. Please try again.');
  }

  let data: GeminiResponse;
  try {
    data = (await response.json()) as GeminiResponse;
  } catch {
    throw new HttpError(502, 'The analysis service returned an unreadable response.');
  }

  if (data.promptFeedback?.blockReason) {
    throw new HttpError(422, 'The request could not be processed. Try rephrasing or a different photo.');
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new HttpError(502, 'The analysis service returned an empty response. Please try again.');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(502, 'The analysis service returned malformed data. Please try again.');
  }
}

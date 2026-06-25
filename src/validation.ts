/**
 * Request parsing & validation for POST /analyze.
 *
 * Produces a normalized payload where the image (if any) is already decoded
 * from its data URL into a raw base64 string + mime type, with its size checked.
 */
import { HttpError } from './errors';
import type { AnalyzeRequest } from './types';

export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB decoded

export interface NormalizedImage {
  mimeType: string;
  /** Raw base64 (data URL prefix stripped) ready for the model. */
  base64: string;
  /** Decoded size in bytes. */
  byteLength: number;
}

export interface NormalizedRequest {
  question: string;
  image: NormalizedImage | null;
}

const DATA_URL_RE = /^data:([a-zA-Z0-9.+/-]+);base64,(.*)$/s;

/** Estimate the decoded byte length of a base64 string without allocating it. */
function base64ByteLength(b64: string): number {
  const len = b64.length;
  if (len === 0) return 0;
  let padding = 0;
  if (b64.endsWith('==')) padding = 2;
  else if (b64.endsWith('=')) padding = 1;
  return Math.floor((len * 3) / 4) - padding;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseAnalyzeRequest(raw: unknown, maxImageBytes: number): NormalizedRequest {
  if (!isPlainObject(raw)) {
    throw new HttpError(400, 'Invalid request body. Expected a JSON object.');
  }

  const body = raw as Partial<AnalyzeRequest>;
  const question = typeof body.question === 'string' ? body.question.trim() : '';

  let image: NormalizedImage | null = null;
  if (body.image !== null && body.image !== undefined) {
    if (!isPlainObject(body.image)) {
      throw new HttpError(400, 'Invalid "image" field.');
    }
    const { mimeType, dataUrl } = body.image as Record<string, unknown>;

    if (typeof dataUrl !== 'string' || dataUrl.length === 0) {
      throw new HttpError(400, 'Image is missing its data.');
    }

    const match = DATA_URL_RE.exec(dataUrl);
    if (!match) {
      throw new HttpError(400, 'Image must be a base64 data URL.');
    }

    // Prefer the declared mimeType, fall back to the data URL's own type.
    const declaredMime =
      typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : match[1];
    const normalizedMime = declaredMime.toLowerCase();

    if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(normalizedMime)) {
      throw new HttpError(400, 'Unsupported image format. Use JPEG, PNG, WEBP or HEIC.');
    }

    const base64 = match[2];
    const byteLength = base64ByteLength(base64);
    if (byteLength === 0) {
      throw new HttpError(400, 'Image data is empty.');
    }
    const limit = Number.isFinite(maxImageBytes) && maxImageBytes > 0
      ? maxImageBytes
      : DEFAULT_MAX_IMAGE_BYTES;
    if (byteLength > limit) {
      const mb = Math.round((limit / (1024 * 1024)) * 10) / 10;
      throw new HttpError(413, `Image is too large (max ${mb} MB). Please use a smaller photo.`);
    }

    image = { mimeType: normalizedMime, base64, byteLength };
  }

  // Hard rule: a question OR an image is required.
  if (question.length === 0 && image === null) {
    throw new HttpError(400, 'Provide a question or an image.');
  }

  return { question, image };
}

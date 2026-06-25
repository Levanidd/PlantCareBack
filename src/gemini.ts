/**
 * Gemini multimodal client.
 *
 * All Gemini access lives here. The API key comes from `env.GEMINI_API_KEY`
 * (a Worker secret) and is never returned to the client. We force structured
 * JSON output via `responseSchema` so the model returns a PlantCareResult.
 */
import { HttpError } from './errors';
import type { Env, PlantCareResult } from './types';
import type { NormalizedRequest } from './validation';
import { sanitizeResult } from './sanitize';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const REQUEST_TIMEOUT_MS = 45_000;

function systemInstruction(defaultLanguage: string): string {
  return `You are an expert botanist and houseplant-care assistant powering the
"Plant Care Agent" app. You receive a user's question and/or a photo of a plant
and must return ONE structured JSON object that conforms to the provided schema.

CORE RULES
- "summary" is mandatory: a clear, helpful main answer. Everything else is optional.
- Only include a block when it is relevant and you actually have grounded information
  for it. If you don't have data for a block, omit it (or leave its array empty).
- NEVER invent specifics (species, measurements, diagnoses). If you are unsure,
  set the relevant "confidence" to "low" and add concrete "warnings" explaining why
  (e.g. blurry photo, ambiguous question, multiple possible species).
- For image-only requests where the plant or problem is unclear, still produce a
  helpful summary, but be explicit about uncertainty.

CONTENT GUIDANCE
- Audience: an average home grower. Be detailed and practical, not oversimplified,
  and avoid jargon without explanation.
- Assume a generic indoor/houseplant context unless the user says otherwise.
- "careProfile" items: "key" MUST be one of
  watering | light | humidity | temperature | soil | fertilizer | size.
  Use each key at most once. "label" is a short human label, "value" is the headline
  (e.g. "Every 7–10 days"), "detail" is an optional one-line clarification.
- "diagnosis": include only when a problem is asked about or visible. Each issue has a
  "severity" of info | warning | critical.
- "actionPlan": concrete next steps. Each item needs a UNIQUE "id" (use "1","2","3"…)
  and a "priority" of low | medium | high.
- "followUps": 2–4 short natural follow-up questions the user might tap next.

LANGUAGE
- Reply in the SAME language as the user's question.
- If there is no question, or the language is unclear, reply in "${defaultLanguage}".

Return ONLY the JSON object. Do not wrap it in markdown.`;
}

/** OpenAPI-subset schema understood by Gemini's responseSchema. */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    confidence: { type: 'STRING', enum: ['low', 'medium', 'high'], nullable: true },
    warnings: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    identification: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        commonName: { type: 'STRING', nullable: true },
        scientificName: { type: 'STRING', nullable: true },
        alsoKnownAs: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
        confidence: { type: 'STRING', enum: ['low', 'medium', 'high'], nullable: true },
        description: { type: 'STRING', nullable: true },
      },
    },
    careProfile: {
      type: 'ARRAY',
      nullable: true,
      items: {
        type: 'OBJECT',
        properties: {
          key: {
            type: 'STRING',
            enum: ['watering', 'light', 'humidity', 'temperature', 'soil', 'fertilizer', 'size'],
          },
          label: { type: 'STRING' },
          value: { type: 'STRING' },
          detail: { type: 'STRING', nullable: true },
        },
        required: ['key', 'label', 'value'],
      },
    },
    diagnosis: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        healthStatus: { type: 'STRING', nullable: true },
        issues: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              severity: { type: 'STRING', enum: ['info', 'warning', 'critical'] },
              description: { type: 'STRING', nullable: true },
              likelyCause: { type: 'STRING', nullable: true },
            },
            required: ['title', 'severity'],
          },
        },
      },
    },
    wateringPlan: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        frequency: { type: 'STRING', nullable: true },
        amount: { type: 'STRING', nullable: true },
        method: { type: 'STRING', nullable: true },
        notes: { type: 'STRING', nullable: true },
      },
    },
    actionPlan: {
      type: 'ARRAY',
      nullable: true,
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          text: { type: 'STRING' },
          priority: { type: 'STRING', enum: ['low', 'medium', 'high'], nullable: true },
        },
        required: ['id', 'text'],
      },
    },
    followUps: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
  },
  required: ['summary'],
} as const;

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

function buildUserParts(req: NormalizedRequest): GeminiPart[] {
  const parts: GeminiPart[] = [];

  const promptLines: string[] = [];
  if (req.question) {
    promptLines.push(`User question: ${req.question}`);
  } else {
    promptLines.push('The user did not type a question.');
  }
  if (req.image) {
    promptLines.push('A photo of the plant is attached. Use it for identification and diagnosis.');
  } else {
    promptLines.push('No photo was provided; base your answer on the text only.');
  }
  parts.push({ text: promptLines.join('\n') });

  if (req.image) {
    parts.push({ inline_data: { mime_type: req.image.mimeType, data: req.image.base64 } });
  }

  return parts;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

export async function analyzeWithGemini(
  env: Env,
  req: NormalizedRequest,
): Promise<PlantCareResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    // Configuration problem — don't leak details to the client.
    console.error('GEMINI_API_KEY is not configured.');
    throw new HttpError(500, 'The service is not configured correctly. Please try again later.');
  }

  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const defaultLanguage = env.DEFAULT_LANGUAGE || 'ru';
  const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`;

  const payload = {
    systemInstruction: { parts: [{ text: systemInstruction(defaultLanguage) }] },
    contents: [{ role: 'user', parts: buildUserParts(req) }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      // Key travels in a header, not the URL, so it stays out of logs.
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
    // Log status only; never echo upstream bodies (may contain the key context).
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(502, 'The analysis service returned malformed data. Please try again.');
  }

  const result = sanitizeResult(parsed);
  if (!result) {
    throw new HttpError(502, 'The analysis service returned an incomplete result. Please try again.');
  }
  return result;
}

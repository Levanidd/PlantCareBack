/**
 * Shared helpers for building skill user messages.
 */
import type { GeminiPart } from '../gemini/client';
import type { IntentDetectionOutput, SkillContext } from './types';

const LANGUAGE_LABELS: Record<string, string> = {
  ru: 'Russian',
  en: 'English',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  uk: 'Ukrainian',
  pl: 'Polish',
};

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code.toLowerCase()] ?? code;
}

/** Human-readable current date for seasonal care, localized to output language. */
export function currentDateLabel(lang: string): string {
  const now = new Date();
  const locale = lang.toLowerCase() === 'ru' ? 'ru-RU' : lang;
  try {
    return now.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function buildBaseContextText(ctx: SkillContext): string {
  const lines: string[] = [];
  lines.push(`User message: ${ctx.question || '(no text — image only)'}`);
  lines.push(`Default language (fallback): ${ctx.defaultLanguage}`);
  lines.push(`Output language: ${ctx.detectedLanguage}`);
  lines.push(`Current date: ${currentDateLabel(ctx.detectedLanguage)} (use for seasonal advice)`);
  lines.push(`Photo attached: ${ctx.image ? 'yes' : 'no'}`);

  const intent = ctx.results['intent-detection'] as IntentDetectionOutput | undefined;
  if (intent?.detectedIntent) {
    lines.push(`Detected intent: ${intent.detectedIntent}`);
    lines.push(`Intent confidence: ${intent.confidence ?? 'unknown'}`);
    if (intent.ownershipTag) {
      lines.push(`Ownership tag: ${intent.ownershipTag} (new=just bought, existing=already at home)`);
    }
  }

  const identification = ctx.results['plant-identification'] as
    | { commonName?: string; scientificName?: string; confidence?: number }
    | undefined;
  if (identification?.commonName) {
    lines.push(`Identified plant: ${identification.commonName}`);
    if (identification.scientificName) {
      lines.push(`Scientific name: ${identification.scientificName}`);
    }
  }

  return lines.join('\n');
}

export function buildUserParts(ctx: SkillContext, extra?: string): GeminiPart[] {
  const parts: GeminiPart[] = [];
  const text = extra ? `${buildBaseContextText(ctx)}\n\n${extra}` : buildBaseContextText(ctx);
  parts.push({ text });
  if (ctx.image) {
    parts.push({ inline_data: { mime_type: ctx.image.mimeType, data: ctx.image.base64 } });
  }
  return parts;
}

export function languageRule(ctx: SkillContext): string {
  const label = languageLabel(ctx.detectedLanguage);
  return (
    `Write all user-facing text in ${label} (ISO code "${ctx.detectedLanguage}"). ` +
    `System instructions are in English; output text must use the output language above.`
  );
}

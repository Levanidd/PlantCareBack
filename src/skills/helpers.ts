/**
 * Shared helpers for building skill user messages.
 */
import type { GeminiPart } from '../gemini/client';
import type { IntentDetectionOutput, SkillContext } from './types';

/** Human-readable current date for seasonal care (UTC, Russian month names optional). */
export function currentDateLabel(): string {
  const now = new Date();
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  const d = now.getUTCDate();
  const m = months[now.getUTCMonth()];
  const y = now.getUTCFullYear();
  return `${d} ${m} ${y}`;
}

export function buildBaseContextText(ctx: SkillContext): string {
  const lines: string[] = [];
  lines.push(`User message: ${ctx.question || '(no text — image only)'}`);
  lines.push(`Detected language for user-facing output: ${ctx.detectedLanguage}`);
  lines.push(`Current date: ${currentDateLabel()} (use for seasonal advice)`);
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
  const lang = ctx.detectedLanguage === 'ru' ? 'Russian' : ctx.detectedLanguage;
  return `Write all user-facing text in ${lang}. System instructions are in English; output text must match the user's language.`;
}

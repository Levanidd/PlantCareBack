/**
 * Shared helpers for building skill user messages.
 */
import type { GeminiPart } from '../gemini/client';
import type { SkillContext } from './types';

export function buildBaseContextText(ctx: SkillContext): string {
  const lines: string[] = [];
  lines.push(`User message: ${ctx.question || '(no text — image only)'}`);
  lines.push(`Detected language for user-facing output: ${ctx.detectedLanguage}`);
  lines.push(`Photo attached: ${ctx.image ? 'yes' : 'no'}`);

  const intent = ctx.results['intent-detection'] as
    | { detectedIntent?: string; confidence?: string; needsClarification?: boolean }
    | undefined;
  if (intent?.detectedIntent) {
    lines.push(`Detected intent: ${intent.detectedIntent}`);
    lines.push(`Intent confidence: ${intent.confidence ?? 'unknown'}`);
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
  return `Write all user-facing text in "${ctx.detectedLanguage}". System instructions are in English; output text must match the user's language.`;
}

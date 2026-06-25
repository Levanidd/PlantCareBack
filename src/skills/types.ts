/**
 * Skill system types. Each skill lives in its own folder with prompt + schema files.
 */
import type { GeminiPart } from '../gemini/client';
import type { NormalizedImage } from '../validation';

export const SKILL_IDS = [
  'intent-detection',
  'plant-identification',
  // Consolidated experts (replace the previous granular content skills).
  'care-expert',
  'diagnosis-safety',
  'follow-up-questions',
  'frontend-response-composer',
  'history',
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

export type SkillConfidence = 'low' | 'medium' | 'high';

/** Shared context passed through the agent pipeline. */
export interface SkillContext {
  question: string;
  image: NormalizedImage | null;
  defaultLanguage: string;
  sessionId: string;
  /** Populated after intent detection. */
  detectedLanguage: string;
  /** Results keyed by skill id. */
  results: Partial<Record<SkillId, unknown>>;
}

export interface LlmSkillDefinition<TOutput = unknown> {
  id: SkillId;
  name: string;
  /** MVP skills are always available; others may be gated later. */
  mvp: boolean;
  usesImage: boolean;
  systemPrompt: string;
  responseSchema: Record<string, unknown>;
  buildUserParts: (ctx: SkillContext) => GeminiPart[];
  /** Optional post-parse validation/normalization. */
  normalize?: (raw: unknown) => TOutput | null;
}

export type SkillRunner = {
  runLlmSkill: <T>(skill: LlmSkillDefinition<T>, ctx: SkillContext) => Promise<T>;
};

export interface IntentDetectionOutput {
  detectedIntent: string;
  skillsToRun: SkillId[];
  confidence: SkillConfidence;
  needsClarification: boolean;
  detectedLanguage: string;
  clarificationReason?: string;
}

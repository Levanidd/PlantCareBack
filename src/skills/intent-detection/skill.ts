import { buildUserParts } from '../helpers';
import type { IntentDetectionOutput, LlmSkillDefinition, SkillContext } from '../types';
import { PROMPT } from './prompt';
import { SCHEMA } from './schema';

const RUNNABLE_SKILLS = new Set([
  'plant-identification',
  'care-expert',
  'diagnosis-safety',
]);

function normalize(raw: unknown, ctx: SkillContext): IntentDetectionOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const detectedIntent = typeof o.detectedIntent === 'string' ? o.detectedIntent.trim() : '';
  const confidence = o.confidence;
  const needsClarification = o.needsClarification === true;
  const fallbackLang = ctx.defaultLanguage?.trim().toLowerCase() || 'en';
  const detectedLanguage =
    typeof o.detectedLanguage === 'string' && o.detectedLanguage.trim()
      ? o.detectedLanguage.trim().toLowerCase()
      : fallbackLang;
  if (!detectedIntent) return null;
  if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') return null;

  const skillsToRun = Array.isArray(o.skillsToRun)
    ? [...new Set(o.skillsToRun.filter((s): s is string => typeof s === 'string' && RUNNABLE_SKILLS.has(s)))]
    : [];

  if (skillsToRun.length === 0) {
    skillsToRun.push('care-expert', 'diagnosis-safety');
  }

  if (!skillsToRun.includes('care-expert')) skillsToRun.push('care-expert');
  if (!skillsToRun.includes('diagnosis-safety')) skillsToRun.push('diagnosis-safety');

  const ownershipTag =
    o.ownershipTag === 'new' || o.ownershipTag === 'existing' || o.ownershipTag === 'unknown'
      ? o.ownershipTag
      : 'unknown';

  return {
    detectedIntent,
    skillsToRun: skillsToRun as IntentDetectionOutput['skillsToRun'],
    confidence,
    needsClarification,
    detectedLanguage,
    ownershipTag,
    clarificationReason:
      typeof o.clarificationReason === 'string' ? o.clarificationReason.trim() : undefined,
  };
}

export const intentDetectionSkill: LlmSkillDefinition<IntentDetectionOutput> = {
  id: 'intent-detection',
  name: 'Intent Detection Skill',
  mvp: true,
  usesImage: true,
  systemPrompt: PROMPT,
  responseSchema: SCHEMA,
  buildUserParts: (ctx) =>
    buildUserParts(
      ctx,
      'Analyze the request and return intent detection JSON. Photo is attached if indicated above.',
    ),
  normalize,
};

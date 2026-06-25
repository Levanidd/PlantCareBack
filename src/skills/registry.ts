import * as careExpert from './care-expert';
import * as composer from './frontend-response-composer';
import * as diagnosisSafety from './diagnosis-safety';
import { defineContentSkill } from './factory';
import { buildUserParts, languageRule } from './helpers';
import { intentDetectionSkill } from './intent-detection/skill';
export { intentDetectionSkill };
import * as followUp from './follow-up-questions';
import { plantIdentificationSkill } from './plant-identification/skill';
import type { LlmSkillDefinition, SkillId } from './types';

export const composerSkill: LlmSkillDefinition = {
  id: 'frontend-response-composer',
  name: 'Frontend Response Composer Skill',
  mvp: true,
  usesImage: false,
  systemPrompt: composer.PROMPT,
  responseSchema: composer.SCHEMA,
  buildUserParts: (ctx) => {
    const upstream = Object.fromEntries(
      Object.entries(ctx.results).filter(([k]) => k !== 'frontend-response-composer'),
    );
    return buildUserParts(
      ctx,
      `${languageRule(ctx)}\n\nUpstream skill outputs (JSON):\n${JSON.stringify(upstream, null, 2)}\n\nCompose the final frontend response.`,
    );
  },
};

export const CONTENT_SKILLS: LlmSkillDefinition[] = [
  plantIdentificationSkill,
  defineContentSkill('care-expert', 'Care Expert Skill', true, true, careExpert),
  defineContentSkill('diagnosis-safety', 'Diagnosis & Safety Skill', true, true, diagnosisSafety),
  defineContentSkill('follow-up-questions', 'Follow-up Question Skill', false, false, followUp),
  composerSkill,
];

export const SKILL_BY_ID: Record<SkillId, LlmSkillDefinition | undefined> = {
  'intent-detection': intentDetectionSkill,
  ...Object.fromEntries(CONTENT_SKILLS.map((s) => [s.id, s])),
  history: undefined,
} as Record<SkillId, LlmSkillDefinition | undefined>;

export function getSkill(id: SkillId): LlmSkillDefinition | undefined {
  return SKILL_BY_ID[id];
}

export const SKILL_DISPLAY_NAMES: Record<SkillId, string> = {
  'intent-detection': 'Intent Detection Skill',
  'plant-identification': 'Plant Identification Skill',
  'care-expert': 'Care Expert Skill',
  'diagnosis-safety': 'Diagnosis & Safety Skill',
  'follow-up-questions': 'Follow-up Question Skill',
  'frontend-response-composer': 'Frontend Response Composer Skill',
  history: 'History Skill',
};

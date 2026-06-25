import * as careGuide from './plant-care-guide';
import * as composer from './frontend-response-composer';
import * as diagnosis from './disease-pest-diagnosis';
import * as existingHealth from './existing-plant-health-check';
import * as fertilizing from './fertilizing';
import * as followUp from './follow-up-questions';
import { defineContentSkill } from './factory';
import { buildUserParts, languageRule } from './helpers';
import { intentDetectionSkill } from './intent-detection/skill';
export { intentDetectionSkill };
import * as lightPlacement from './light-placement';
import * as newOnboarding from './new-plant-onboarding';
import { plantIdentificationSkill } from './plant-identification/skill';
import * as repotting from './repotting';
import * as seasonal from './seasonal-care';
import * as toxicity from './toxicity-safety';
import type { LlmSkillDefinition, SkillId } from './types';
import * as watering from './watering';

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
  defineContentSkill('plant-care-guide', 'Plant Care Guide Skill', true, false, careGuide),
  defineContentSkill('new-plant-onboarding', 'New Plant Onboarding Skill', true, false, newOnboarding),
  defineContentSkill(
    'existing-plant-health-check',
    'Existing Plant Health Check Skill',
    false,
    false,
    existingHealth,
  ),
  defineContentSkill('watering', 'Watering Skill', false, false, watering),
  defineContentSkill('light-placement', 'Light & Placement Skill', false, false, lightPlacement),
  defineContentSkill('repotting', 'Repotting Skill', false, false, repotting),
  defineContentSkill('fertilizing', 'Fertilizing Skill', false, false, fertilizing),
  defineContentSkill(
    'disease-pest-diagnosis',
    'Disease & Pest Diagnosis Skill',
    true,
    true,
    diagnosis,
  ),
  defineContentSkill('seasonal-care', 'Seasonal Care Skill', false, false, seasonal),
  defineContentSkill('toxicity-safety', 'Toxicity & Safety Skill', true, false, toxicity),
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
  'plant-care-guide': 'Plant Care Guide Skill',
  'new-plant-onboarding': 'New Plant Onboarding Skill',
  'existing-plant-health-check': 'Existing Plant Health Check Skill',
  watering: 'Watering Skill',
  'light-placement': 'Light & Placement Skill',
  repotting: 'Repotting Skill',
  fertilizing: 'Fertilizing Skill',
  'disease-pest-diagnosis': 'Disease & Pest Diagnosis Skill',
  'seasonal-care': 'Seasonal Care Skill',
  'toxicity-safety': 'Toxicity & Safety Skill',
  'follow-up-questions': 'Follow-up Question Skill',
  'frontend-response-composer': 'Frontend Response Composer Skill',
  history: 'History Skill',
};

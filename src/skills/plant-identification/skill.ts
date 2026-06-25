import { buildUserParts, languageRule } from '../helpers';
import type { LlmSkillDefinition } from '../types';
import { PROMPT } from './prompt';
import { SCHEMA } from './schema';

export interface PlantIdentificationOutput {
  commonName?: string;
  scientificName?: string;
  confidence: number;
  confidenceLabel: 'low' | 'medium' | 'high';
  alternativePlants?: string[];
  identificationNotes?: string;
}

export const plantIdentificationSkill: LlmSkillDefinition<PlantIdentificationOutput> = {
  id: 'plant-identification',
  name: 'Plant Identification Skill',
  mvp: true,
  usesImage: true,
  systemPrompt: PROMPT,
  responseSchema: SCHEMA,
  buildUserParts: (ctx) =>
    buildUserParts(ctx, `${languageRule(ctx)}\n\nIdentify the plant and return JSON.`),
};

import { buildUserParts, languageRule } from './helpers';
import type { LlmSkillDefinition, SkillId } from './types';

interface SkillModule {
  PROMPT: string;
  SCHEMA: Record<string, unknown>;
}

export function defineContentSkill(
  id: SkillId,
  name: string,
  mvp: boolean,
  usesImage: boolean,
  mod: SkillModule,
): LlmSkillDefinition {
  return {
    id,
    name,
    mvp,
    usesImage,
    systemPrompt: mod.PROMPT,
    responseSchema: mod.SCHEMA,
    buildUserParts: (ctx) =>
      buildUserParts(ctx, `${languageRule(ctx)}\n\nExecute your skill and return JSON.`),
  };
}

/**
 * Resolves runtime skill definitions by merging code defaults with active KV versions.
 */
import type { Env } from '../types';
import { getActiveVersion } from './store';
import type { SkillConfigContent } from './types';
import { buildUserParts, languageRule } from '../skills/helpers';
import { getSkill } from '../skills/registry';
import type { LlmSkillDefinition, SkillContext, SkillId } from '../skills/types';

export async function resolveSkillDefinition(
  env: Env,
  skillId: SkillId,
): Promise<LlmSkillDefinition | undefined> {
  const base = getSkill(skillId);
  if (!base) return undefined;

  if (!env.CONFIG_KV) return base;

  const active = await getActiveVersion<SkillConfigContent>(env, 'skill', skillId);
  if (!active) return base;

  const cfg = active.content;
  const userSuffix = cfg.userMessageSuffix?.trim();

  return {
    ...base,
    systemPrompt: cfg.systemPrompt,
    responseSchema: cfg.responseSchema,
    mvp: cfg.mvp,
    usesImage: cfg.usesImage,
    buildUserParts: (ctx: SkillContext) => {
      const suffix = userSuffix
        ? `${languageRule(ctx)}\n\n${userSuffix}`
        : `${languageRule(ctx)}\n\nExecute your skill and return JSON.`;
      // Composer keeps its special upstream JSON wiring from code.
      if (skillId === 'frontend-response-composer') {
        return base.buildUserParts(ctx);
      }
      return buildUserParts(ctx, suffix);
    },
  };
}

export async function resolveSkillDefinitions(
  env: Env,
  skillIds: SkillId[],
): Promise<Map<SkillId, LlmSkillDefinition>> {
  const map = new Map<SkillId, LlmSkillDefinition>();
  await Promise.all(
    skillIds.map(async (id) => {
      const def = await resolveSkillDefinition(env, id);
      if (def) map.set(id, def);
    }),
  );
  return map;
}

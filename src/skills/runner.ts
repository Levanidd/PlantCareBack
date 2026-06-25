/**
 * Executes a single LLM skill via Gemini.
 */
import { callGeminiJson } from '../gemini/client';
import type { Env } from '../types';
import type { LlmSkillDefinition, SkillContext } from './types';

export async function runLlmSkill<T>(
  env: Env,
  skill: LlmSkillDefinition<T>,
  ctx: SkillContext,
): Promise<T> {
  const raw = await callGeminiJson<unknown>(env, {
    systemPrompt: skill.systemPrompt,
    userParts: skill.buildUserParts(ctx),
    responseSchema: skill.responseSchema,
  });
  if (skill.normalize) {
    const normalized = skill.normalize(raw);
    if (normalized === null) {
      throw new Error(`Skill "${skill.id}" returned invalid output.`);
    }
    return normalized;
  }
  return raw as T;
}

/**
 * Plant Care Agent orchestrator — uses active agent + skill versions from CONFIG_KV.
 */
import { getActiveAgent } from '../config/service';
import { resolveSkillDefinition } from '../config/resolve';
import { HttpError } from '../errors';
import { deleteHistoryItem, getHistoryItem, listHistory, saveHistoryItem } from '../history/store';
import { sanitizeResult } from '../sanitize';
import { runLlmSkill } from '../skills/runner';
import type { IntentDetectionOutput, SkillContext, SkillId } from '../skills/types';
import type { Env, PlantCareResult } from '../types';
import type { NormalizedRequest } from '../validation';
import { composeResult } from './compose';

const ORCHESTRATOR_SKILLS = new Set<SkillId>([
  'intent-detection',
  'frontend-response-composer',
  'history',
]);

const PHASE2_PARALLEL_EXCLUDE = new Set<SkillId>([
  'plant-identification',
  'frontend-response-composer',
  'history',
]);

function buildContext(
  req: NormalizedRequest,
  sessionId: string,
  defaultLanguage: string,
): SkillContext {
  return {
    question: req.question,
    image: req.image,
    defaultLanguage,
    sessionId,
    detectedLanguage: defaultLanguage,
    results: {},
  };
}

function skillsForPhase(intent: IntentDetectionOutput, ctx: SkillContext): SkillId[] {
  const selected = new Set(intent.skillsToRun);
  if (ctx.image && !selected.has('plant-identification')) {
    selected.add('plant-identification');
  }
  return [...selected].filter((id) => !ORCHESTRATOR_SKILLS.has(id));
}

export async function runAgent(
  env: Env,
  req: NormalizedRequest,
  sessionId: string,
): Promise<PlantCareResult> {
  const { agent } = await getActiveAgent(env);
  const agentCfg = agent.activeVersion.content;
  const defaultLanguage =
    agentCfg.defaultLanguage || env.DEFAULT_LANGUAGE || 'en';
  const ctx = buildContext(req, sessionId, defaultLanguage);

  const intentSkillId = agentCfg.pipeline.intentSkillId;

  const intentSkill = await resolveSkillDefinition(env, intentSkillId);
  if (!intentSkill) {
    throw new HttpError(500, 'Intent detection skill is not configured.');
  }

  const intent = (await runLlmSkill(env, intentSkill, ctx)) as IntentDetectionOutput;
  ctx.results['intent-detection'] = intent;
  // Image-only or empty text → agent defaultLanguage; otherwise detect from message.
  ctx.detectedLanguage = req.question.trim()
    ? intent.detectedLanguage || defaultLanguage
    : defaultLanguage;

  let toRun = skillsForPhase(intent, ctx).filter((id) =>
    agentCfg.availableSkillIds.includes(id),
  );

  for (const id of agentCfg.pipeline.alwaysAfterIntent ?? []) {
    if (agentCfg.availableSkillIds.includes(id) && !toRun.includes(id)) {
      toRun.push(id);
    }
  }

  // Guarantee at least one content-producing skill so the composed summary is
  // never empty (e.g. a clarification-only intent).
  const CONTENT_SKILLS: SkillId[] = ['care-expert', 'diagnosis-safety', 'plant-identification'];
  if (!toRun.some((id) => CONTENT_SKILLS.includes(id)) && agentCfg.availableSkillIds.includes('care-expert')) {
    toRun.push('care-expert');
  }

  if (toRun.includes('plant-identification')) {
    const skill = await resolveSkillDefinition(env, 'plant-identification');
    if (skill) {
      ctx.results['plant-identification'] = await runLlmSkill(env, skill, ctx);
    }
  }

  const parallelIds = toRun.filter((id) => !PHASE2_PARALLEL_EXCLUDE.has(id));
  await Promise.all(
    parallelIds.map(async (id) => {
      const skill = await resolveSkillDefinition(env, id);
      if (!skill) return;
      ctx.results[id] = await runLlmSkill(env, skill, ctx);
    }),
  );

  // Deterministic composition into the legacy PlantCareResult contract — no
  // extra LLM call. Guarantees the exact output shape the frontend expects.
  const composed = composeResult(ctx);
  const sanitized = sanitizeResult(composed);
  if (!sanitized) {
    throw new HttpError(502, 'The analysis service returned an incomplete result. Please try again.');
  }

  await saveHistoryItem(env, sessionId, req.question, req.image !== null, sanitized);

  return sanitized;
}

export { listHistory, getHistoryItem, deleteHistoryItem };

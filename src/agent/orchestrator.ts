/**
 * Plant Care Agent orchestrator — uses active agent + skill versions from CONFIG_KV.
 */
import { getActiveAgent } from '../config/service';
import { resolveSkillDefinition } from '../config/resolve';
import { HttpError } from '../errors';
import { deleteHistoryItem, getHistoryItem, listHistory, saveHistoryItem } from '../history/store';
import { sanitizeAgentResponse } from '../sanitize';
import { SKILL_DISPLAY_NAMES } from '../skills/registry';
import { runLlmSkill } from '../skills/runner';
import type { IntentDetectionOutput, SkillContext, SkillId } from '../skills/types';
import type { AgentResponse, Env } from '../types';
import type { NormalizedRequest } from '../validation';

const ORCHESTRATOR_SKILLS = new Set<SkillId>([
  'intent-detection',
  'frontend-response-composer',
  'history',
]);

const PHASE2_PARALLEL_EXCLUDE = new Set<SkillId>([
  'plant-identification',
  'follow-up-questions',
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
): Promise<AgentResponse> {
  const { agent } = await getActiveAgent(env);
  const agentCfg = agent.activeVersion.content;
  const defaultLanguage =
    agentCfg.defaultLanguage || env.DEFAULT_LANGUAGE || 'ru';
  const ctx = buildContext(req, sessionId, defaultLanguage);

  const intentSkillId = agentCfg.pipeline.intentSkillId;
  const composerSkillId = agentCfg.pipeline.composerSkillId;

  const intentSkill = await resolveSkillDefinition(env, intentSkillId);
  if (!intentSkill) {
    throw new HttpError(500, 'Intent detection skill is not configured.');
  }

  const intent = (await runLlmSkill(env, intentSkill, ctx)) as IntentDetectionOutput;
  ctx.results['intent-detection'] = intent;
  ctx.detectedLanguage = intent.detectedLanguage || defaultLanguage;

  const toRun = skillsForPhase(intent, ctx).filter((id) =>
    agentCfg.availableSkillIds.includes(id),
  );

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

  if (toRun.includes('follow-up-questions')) {
    const skill = await resolveSkillDefinition(env, 'follow-up-questions');
    if (skill) {
      ctx.results['follow-up-questions'] = await runLlmSkill(env, skill, ctx);
    }
  }

  const composerSkill = await resolveSkillDefinition(env, composerSkillId);
  if (!composerSkill) {
    throw new HttpError(500, 'Response composer skill is not configured.');
  }

  const composed = await runLlmSkill<unknown>(env, composerSkill, ctx);
  const sanitized = sanitizeAgentResponse(composed, ctx.detectedLanguage);
  if (!sanitized) {
    throw new HttpError(502, 'The analysis service returned an incomplete result. Please try again.');
  }

  sanitized.metadata.detectedIntent =
    sanitized.metadata.detectedIntent ?? intent.detectedIntent;
  sanitized.metadata.overallConfidence =
    sanitized.metadata.overallConfidence ?? intent.confidence;
  if (sanitized.metadata.usedSkills.length === 0) {
    sanitized.metadata.usedSkills = toRun
      .map((id) => SKILL_DISPLAY_NAMES[id])
      .concat(SKILL_DISPLAY_NAMES['frontend-response-composer']);
  }

  const historyId = await saveHistoryItem(
    env,
    sessionId,
    req.question,
    req.image !== null,
    sanitized,
  );
  if (historyId) {
    sanitized.metadata.historyItemId = historyId;
  }

  return sanitized;
}

export { listHistory, getHistoryItem, deleteHistoryItem };

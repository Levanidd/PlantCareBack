/**
 * Deterministic frontend-response composer.
 *
 * Assembles the legacy `PlantCareResult` (the original pre-skills contract)
 * from the structured outputs of the skill pipeline. This replaces the
 * LLM-based composer: it is faster, cheaper (one fewer Gemini call), and
 * guarantees the exact output shape the frontend expects.
 *
 * The loose object produced here is passed through `sanitizeResult`, which
 * enforces enums, drops empty blocks, and assigns action-plan ids.
 */
import type { IntentDetectionOutput, SkillContext } from '../skills/types';

type Dict = Record<string, unknown>;

function asObj(v: unknown): Dict | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Dict) : null;
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asStr(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

interface LooseAction {
  text: string;
  priority?: string;
}

/** Build a PlantCareResult-shaped object from the pipeline's skill results. */
export function composeResult(ctx: SkillContext): Dict {
  const care = asObj(ctx.results['care-expert']);
  const diag = asObj(ctx.results['diagnosis-safety']);
  const ident = asObj(ctx.results['plant-identification']);
  const followUp = asObj(ctx.results['follow-up-questions']);
  const intent = ctx.results['intent-detection'] as IntentDetectionOutput | undefined;

  /* summary — prefer the care expert, then diagnosis, then identification. */
  const summary =
    asStr(care?.summary) ??
    asStr(diag?.healthStatus) ??
    asStr(ident?.commonName) ??
    asStr(ident?.identificationNotes);

  /* confidence — identification label first, otherwise intent confidence. */
  const confidence = asStr(ident?.confidenceLabel) ?? intent?.confidence;

  /* identification block. */
  let identification: Dict | undefined;
  if (ident) {
    identification = {
      commonName: ident.commonName,
      scientificName: ident.scientificName,
      alsoKnownAs: ident.alternativePlants,
      confidence: ident.confidenceLabel,
      description: ident.identificationNotes,
    };
  }

  /* diagnosis block. */
  let diagnosis: Dict | undefined;
  if (diag && (asStr(diag.healthStatus) || asArr(diag.issues).length > 0)) {
    diagnosis = { healthStatus: diag.healthStatus, issues: diag.issues };
  }

  /* action plan — care actions + onboarding steps + treatment steps. */
  const actionPlan: LooseAction[] = [];
  for (const raw of asArr(care?.actionItems)) {
    const o = asObj(raw);
    const text = asStr(o?.text);
    if (text) actionPlan.push({ text, priority: asStr(o?.priority) });
  }
  for (const raw of asArr(care?.onboardingSteps)) {
    const text = asStr(raw);
    if (text) actionPlan.push({ text, priority: 'medium' });
  }
  const urgency = asStr(diag?.urgencyLevel);
  const treatmentPriority = urgency === 'critical' || urgency === 'high' ? 'high' : 'medium';
  for (const raw of asArr(diag?.treatmentSteps)) {
    const text = asStr(raw);
    if (text) actionPlan.push({ text, priority: treatmentPriority });
  }

  /* follow-ups — care expert + dedicated follow-up skill, de-duplicated. */
  const followUps: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...asArr(care?.followUps), ...asArr(followUp?.followUpQuestions)]) {
    const text = asStr(raw);
    if (text && !seen.has(text)) {
      seen.add(text);
      followUps.push(text);
    }
  }

  /* warnings — diagnosis/safety skill already phrases these in the user's language. */
  const warnings = asArr(diag?.warnings)
    .map(asStr)
    .filter((x): x is string => x !== undefined);

  return {
    summary,
    confidence,
    warnings,
    identification,
    careProfile: care?.careProfile,
    diagnosis,
    wateringPlan: care?.wateringPlan,
    actionPlan,
    followUps,
  };
}

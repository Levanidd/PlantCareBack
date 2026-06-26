/**
 * Deterministic frontend-response composer.
 *
 * Assembles the legacy `PlantCareResult` from structured skill outputs.
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

  const summary =
    asStr(care?.summary) ??
    asStr(diag?.healthStatus) ??
    asStr(ident?.commonName) ??
    asStr(ident?.identificationNotes);

  const confidence = asStr(ident?.confidenceLabel) ?? intent?.confidence;

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

  let diagnosis: Dict | undefined;
  if (diag && (asStr(diag.healthStatus) || asArr(diag.issues).length > 0)) {
    diagnosis = { healthStatus: diag.healthStatus, issues: diag.issues };
  }

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

  const followUps: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...asArr(care?.followUps), ...asArr(followUp?.followUpQuestions)]) {
    const text = asStr(raw);
    if (text && !seen.has(text)) {
      seen.add(text);
      followUps.push(text);
    }
  }

  const warnings = [...asArr(diag?.warnings).map(asStr).filter((x): x is string => x !== undefined)];

  const toxicity =
    diag &&
    (diag.toxicToCats || diag.toxicToDogs || diag.riskForChildren || diag.safetyAdvice)
      ? {
          toxicToCats: diag.toxicToCats,
          toxicToDogs: diag.toxicToDogs,
          riskForChildren: diag.riskForChildren,
          possibleSymptoms: diag.possibleSymptoms,
          safetyAdvice: diag.safetyAdvice,
        }
      : undefined;

  const healthCheck = care?.healthCheck;
  const onboarding = care?.onboardingSteps;

  return {
    summary,
    confidence,
    warnings: warnings.length > 0 ? warnings : undefined,
    identification,
    careProfile: care?.careProfile,
    diagnosis,
    wateringPlan: care?.wateringPlan,
    actionPlan,
    followUps,
    difficultyLevel: care?.difficultyLevel,
    seasonalAdvice: care?.seasonalAdvice,
    healthCheck,
    onboarding,
    toxicity,
    preventionTips: diag?.preventionTips,
  };
}

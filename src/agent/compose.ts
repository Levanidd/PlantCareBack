/**
 * Deterministic frontend-response composer.
 *
 * Assembles the legacy `PlantCareResult` from structured skill outputs.
 */
import type { SkillContext } from '../skills/types';

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

/** Map care-expert score (1–10), with legacy easy/medium/hard fallback. */
function resolveCareDifficultyScore(care: Dict | null): number | undefined {
  if (!care) return undefined;
  const raw = care.careDifficultyScore;
  let n: number | undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    n = Math.round(raw);
  } else if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number.parseInt(raw.trim(), 10);
    if (Number.isFinite(parsed)) n = parsed;
  }
  if (n !== undefined && n >= 1 && n <= 10) return n;
  const level = asStr(care.difficultyLevel);
  if (level === 'easy') return 3;
  if (level === 'medium') return 5;
  if (level === 'hard') return 8;
  return undefined;
}

interface LooseCareTile {
  key: string;
  label: string;
  value: string;
  detail?: string;
}

/** Trim careProfile watering tile when wateringPlan carries the full detail. */
function dedupeCareProfile(
  careProfile: unknown,
  wateringPlan: Dict | undefined,
): LooseCareTile[] | undefined {
  if (!Array.isArray(careProfile) || careProfile.length === 0) return undefined;
  const planFreq = wateringPlan ? asStr(wateringPlan.frequency) : undefined;
  const out: LooseCareTile[] = [];
  for (const raw of careProfile) {
    const o = asObj(raw);
    if (!o) continue;
    const key = asStr(o.key);
    const label = asStr(o.label);
    const value = asStr(o.value);
    if (!key || !label || !value) continue;
    if (key === 'watering' && planFreq) {
      out.push({ key, label, value: planFreq });
      continue;
    }
    const tile: LooseCareTile = { key, label, value };
    const detail = asStr(o.detail);
    if (detail) tile.detail = detail;
    out.push(tile);
  }
  return out.length > 0 ? out : undefined;
}

/** Build a PlantCareResult-shaped object from the pipeline's skill results. */
export function composeResult(ctx: SkillContext): Dict {
  const care = asObj(ctx.results['care-expert']);
  const diag = asObj(ctx.results['diagnosis-safety']);
  const ident = asObj(ctx.results['plant-identification']);
  const intent = asObj(ctx.results['intent-detection']);

  const blockOrder = Array.isArray(intent?.sectionOrder)
    ? (intent!.sectionOrder as unknown[]).filter((s): s is string => typeof s === 'string')
    : undefined;

  const wateringPlanRaw = care?.wateringPlan;
  const wateringPlanObj = asObj(wateringPlanRaw);
  const careProfile = dedupeCareProfile(care?.careProfile, wateringPlanObj ?? undefined);

  const summary =
    asStr(care?.summary) ??
    asStr(diag?.healthStatus) ??
    asStr(ident?.commonName) ??
    asStr(ident?.identificationNotes);

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

  const careDifficultyScore = resolveCareDifficultyScore(care);

  return {
    summary,
    careDifficultyScore,
    blockOrder: blockOrder && blockOrder.length > 0 ? blockOrder : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    identification,
    careProfile,
    diagnosis,
    wateringPlan: wateringPlanRaw,
    actionPlan,
    seasonalAdvice: care?.seasonalAdvice,
    healthCheck,
    onboarding,
    toxicity,
    preventionTips: diag?.preventionTips,
  };
}

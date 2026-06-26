/**
 * Normalizes composer output into a strict PlantCareResult (legacy frontend contract).
 */
import type {
  ActionItem,
  CareProfileItem,
  Confidence,
  DiagnosisIssue,
  DiagnosisSection,
  DifficultyLevel,
  HealthCheckSection,
  PlantCareResult,
  PlantIdentification,
  Priority,
  Severity,
  ToxicitySection,
  TriState,
  WateringPlan,
} from './types';

const CONFIDENCES: readonly Confidence[] = ['low', 'medium', 'high'];
const SEVERITIES: readonly Severity[] = ['info', 'warning', 'critical'];
const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high'];
const DIFFICULTIES: readonly DifficultyLevel[] = ['easy', 'medium', 'hard'];
const TRISTATE: readonly TriState[] = ['yes', 'no', 'unknown'];
const CARE_KEYS = [
  'watering',
  'light',
  'humidity',
  'temperature',
  'soil',
  'fertilizer',
  'size',
] as const;

function obj(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function strArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.map(str).filter((x): x is string => x !== undefined);
  return out.length > 0 ? out : undefined;
}

function enumVal<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : undefined;
}

function identification(v: unknown): PlantIdentification | undefined {
  const o = obj(v);
  if (!o) return undefined;
  const id: PlantIdentification = {};
  const commonName = str(o.commonName);
  const scientificName = str(o.scientificName);
  const alsoKnownAs = strArray(o.alsoKnownAs);
  const confidence = enumVal(o.confidence, CONFIDENCES);
  const description = str(o.description);
  if (commonName) id.commonName = commonName;
  if (scientificName) id.scientificName = scientificName;
  if (alsoKnownAs) id.alsoKnownAs = alsoKnownAs;
  if (confidence) id.confidence = confidence;
  if (description) id.description = description;
  return Object.keys(id).length > 0 ? id : undefined;
}

function careProfile(v: unknown): CareProfileItem[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set<string>();
  const out: CareProfileItem[] = [];
  for (const raw of v) {
    const o = obj(raw);
    if (!o) continue;
    const key = str(o.key);
    const value = str(o.value);
    if (!key || !value || !CARE_KEYS.includes(key as (typeof CARE_KEYS)[number]) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const label = str(o.label) ?? key;
    const item: CareProfileItem = { key, label, value };
    const detail = str(o.detail);
    if (detail) item.detail = detail;
    out.push(item);
  }
  return out.length > 0 ? out : undefined;
}

function diagnosis(v: unknown): DiagnosisSection | undefined {
  const o = obj(v);
  if (!o) return undefined;
  const issues: DiagnosisIssue[] = [];
  if (Array.isArray(o.issues)) {
    for (const raw of o.issues) {
      const io = obj(raw);
      if (!io) continue;
      const title = str(io.title);
      const severity = enumVal(io.severity, SEVERITIES);
      if (!title || !severity) continue;
      const issue: DiagnosisIssue = { title, severity };
      const description = str(io.description);
      const likelyCause = str(io.likelyCause);
      if (description) issue.description = description;
      if (likelyCause) issue.likelyCause = likelyCause;
      issues.push(issue);
    }
  }
  const healthStatus = str(o.healthStatus);
  if (issues.length === 0 && !healthStatus) return undefined;
  const section: DiagnosisSection = { issues };
  if (healthStatus) section.healthStatus = healthStatus;
  return section;
}

function wateringPlan(v: unknown): WateringPlan | undefined {
  const o = obj(v);
  if (!o) return undefined;
  const plan: WateringPlan = {};
  const frequency = str(o.frequency);
  const amount = str(o.amount);
  const method = str(o.method);
  const notes = str(o.notes);
  if (frequency) plan.frequency = frequency;
  if (amount) plan.amount = amount;
  if (method) plan.method = method;
  if (notes) plan.notes = notes;
  return Object.keys(plan).length > 0 ? plan : undefined;
}

function actionPlan(v: unknown): ActionItem[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const used = new Set<string>();
  const out: ActionItem[] = [];
  let auto = 1;
  for (const raw of v) {
    const o = obj(raw);
    if (!o) continue;
    const text = str(o.text);
    if (!text) continue;
    let id = str(o.id);
    if (!id || used.has(id)) {
      do {
        id = String(auto++);
      } while (used.has(id));
    }
    used.add(id);
    const item: ActionItem = { id, text };
    const priority = enumVal(o.priority, PRIORITIES);
    if (priority) item.priority = priority;
    out.push(item);
  }
  return out.length > 0 ? out : undefined;
}

function healthCheck(v: unknown): HealthCheckSection | undefined {
  const o = obj(v);
  if (!o) return undefined;
  const section: HealthCheckSection = {};
  const healthySigns = strArray(o.healthySigns);
  const warningSigns = strArray(o.warningSigns);
  const monthlyChecklist = strArray(o.monthlyChecklist);
  if (healthySigns) section.healthySigns = healthySigns;
  if (warningSigns) section.warningSigns = warningSigns;
  if (monthlyChecklist) section.monthlyChecklist = monthlyChecklist;
  return Object.keys(section).length > 0 ? section : undefined;
}

function toxicity(v: unknown): ToxicitySection | undefined {
  const o = obj(v);
  if (!o) return undefined;
  const section: ToxicitySection = {};
  const toxicToCats = enumVal(o.toxicToCats, TRISTATE);
  const toxicToDogs = enumVal(o.toxicToDogs, TRISTATE);
  const riskForChildren = enumVal(o.riskForChildren, TRISTATE);
  const possibleSymptoms = strArray(o.possibleSymptoms);
  const safetyAdvice = str(o.safetyAdvice);
  if (toxicToCats) section.toxicToCats = toxicToCats;
  if (toxicToDogs) section.toxicToDogs = toxicToDogs;
  if (riskForChildren) section.riskForChildren = riskForChildren;
  if (possibleSymptoms) section.possibleSymptoms = possibleSymptoms;
  if (safetyAdvice) section.safetyAdvice = safetyAdvice;
  return Object.keys(section).length > 0 ? section : undefined;
}

/** Coerce warnings — accepts string[] or legacy { message }[] objects. */
function warnings(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const raw of v) {
    if (typeof raw === 'string') {
      const t = raw.trim();
      if (t) out.push(t);
    } else {
      const o = obj(raw);
      const message = o ? str(o.message) : undefined;
      if (message) out.push(message);
    }
  }
  return out.length > 0 ? out : undefined;
}

export function sanitizeResult(input: unknown): PlantCareResult | null {
  const o = obj(input);
  if (!o) return null;

  const summary = str(o.summary);
  if (!summary) return null;

  const result: PlantCareResult = { summary };

  const confidence = enumVal(o.confidence, CONFIDENCES);
  if (confidence) result.confidence = confidence;

  const w = warnings(o.warnings);
  if (w) result.warnings = w;

  const id = identification(o.identification);
  if (id) result.identification = id;

  const care = careProfile(o.careProfile);
  if (care) result.careProfile = care;

  const diag = diagnosis(o.diagnosis);
  if (diag) result.diagnosis = diag;

  const water = wateringPlan(o.wateringPlan);
  if (water) result.wateringPlan = water;

  const actions = actionPlan(o.actionPlan);
  if (actions) result.actionPlan = actions;

  const followUps = strArray(o.followUps);
  if (followUps) result.followUps = followUps;

  const difficultyLevel = enumVal(o.difficultyLevel, DIFFICULTIES);
  if (difficultyLevel) result.difficultyLevel = difficultyLevel;

  const seasonalAdvice = str(o.seasonalAdvice);
  if (seasonalAdvice) result.seasonalAdvice = seasonalAdvice;

  const hc = healthCheck(o.healthCheck);
  if (hc) result.healthCheck = hc;

  const onboarding = strArray(o.onboarding);
  if (onboarding) result.onboarding = onboarding;

  const tox = toxicity(o.toxicity);
  if (tox) result.toxicity = tox;

  const preventionTips = strArray(o.preventionTips);
  if (preventionTips) result.preventionTips = preventionTips;

  return result;
}

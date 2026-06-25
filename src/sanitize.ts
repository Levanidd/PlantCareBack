/**
 * Defensive normalization of the model's JSON into a strict PlantCareResult.
 *
 * Even with a responseSchema, we never trust raw model output: we coerce types,
 * drop unknown/empty fields, validate enums, ensure unique actionPlan ids, and
 * guarantee that `summary` is present. Returns null only if there is no usable
 * summary (the one mandatory field).
 */
import {
  CARE_PROFILE_KEYS,
  type ActionItem,
  type CareProfileItem,
  type Confidence,
  type DiagnosisIssue,
  type DiagnosisSection,
  type PlantCareResult,
  type PlantIdentification,
  type Priority,
  type Severity,
  type WateringPlan,
} from './types';

const CONFIDENCES: readonly Confidence[] = ['low', 'medium', 'high'];
const SEVERITIES: readonly Severity[] = ['info', 'warning', 'critical'];
const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high'];
const CARE_KEYS: readonly string[] = CARE_PROFILE_KEYS;

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
    if (!key || !value || !CARE_KEYS.includes(key) || seen.has(key)) continue;
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

export function sanitizeResult(input: unknown): PlantCareResult | null {
  const o = obj(input);
  if (!o) return null;

  const summary = str(o.summary);
  if (!summary) return null;

  const result: PlantCareResult = { summary };

  const confidence = enumVal(o.confidence, CONFIDENCES);
  if (confidence) result.confidence = confidence;

  const warnings = strArray(o.warnings);
  if (warnings) result.warnings = warnings;

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

  return result;
}

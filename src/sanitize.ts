/**
 * Normalizes composer output into a strict AgentResponse.
 */
import type {
  AgentResponse,
  ConfidenceLabel,
  ResponseMetadata,
  SummarySection,
  WarningItem,
} from './types';

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function obj(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function summary(v: unknown): SummarySection | null {
  const o = obj(v);
  if (!o) return null;
  const title = str(o.title);
  const shortAnswer = str(o.shortAnswer);
  if (!title || !shortAnswer) return null;
  return { title, shortAnswer };
}

function metadata(v: unknown, fallbackLang: string): ResponseMetadata | null {
  const o = obj(v);
  if (!o) return null;
  const language = str(o.language) ?? fallbackLang;
  const usedSkills = Array.isArray(o.usedSkills)
    ? o.usedSkills.map(str).filter((s): s is string => !!s)
    : [];
  const overall = o.overallConfidence;
  const meta: ResponseMetadata = {
    usedSkills,
    language,
    responseType: 'plant-care-analysis',
  };
  const detectedIntent = str(o.detectedIntent);
  if (detectedIntent) meta.detectedIntent = detectedIntent;
  if (overall === 'low' || overall === 'medium' || overall === 'high') {
    meta.overallConfidence = overall;
  }
  const historyItemId = str(o.historyItemId);
  if (historyItemId) meta.historyItemId = historyItemId;
  return meta;
}

function warnings(v: unknown): WarningItem[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: WarningItem[] = [];
  for (const raw of v) {
    const o = obj(raw);
    if (!o) continue;
    const type = o.type;
    const message = str(o.message);
    if (
      message &&
      (type === 'toxicity' || type === 'urgency' || type === 'confidence' || type === 'general')
    ) {
      out.push({ type, message });
    }
  }
  return out.length > 0 ? out : undefined;
}

function passThroughSection(v: unknown): Record<string, unknown> | undefined {
  const o = obj(v);
  if (!o || Object.keys(o).length === 0) return undefined;
  return o;
}

export function sanitizeAgentResponse(raw: unknown, fallbackLang: string): AgentResponse | null {
  const o = obj(raw);
  if (!o) return null;
  const sum = summary(o.summary);
  const meta = metadata(o.metadata, fallbackLang);
  if (!sum || !meta) return null;

  const result: AgentResponse = { summary: sum, metadata: meta };

  const plantCard = passThroughSection(o.plantCard);
  if (plantCard) result.plantCard = plantCard as AgentResponse['plantCard'];

  const careGuide = passThroughSection(o.careGuide);
  if (careGuide) result.careGuide = careGuide as AgentResponse['careGuide'];

  const onboarding = passThroughSection(o.onboarding);
  if (onboarding) result.onboarding = onboarding as AgentResponse['onboarding'];

  const healthCheck = passThroughSection(o.healthCheck);
  if (healthCheck) result.healthCheck = healthCheck as AgentResponse['healthCheck'];

  const watering = passThroughSection(o.watering);
  if (watering) result.watering = watering as AgentResponse['watering'];

  const lightAndPlacement = passThroughSection(o.lightAndPlacement);
  if (lightAndPlacement) result.lightAndPlacement = lightAndPlacement as AgentResponse['lightAndPlacement'];

  const repotting = passThroughSection(o.repotting);
  if (repotting) result.repotting = repotting as AgentResponse['repotting'];

  const fertilizing = passThroughSection(o.fertilizing);
  if (fertilizing) result.fertilizing = fertilizing as AgentResponse['fertilizing'];

  const diagnosis = passThroughSection(o.diagnosis);
  if (diagnosis) result.diagnosis = diagnosis as AgentResponse['diagnosis'];

  const seasonalCare = passThroughSection(o.seasonalCare);
  if (seasonalCare) result.seasonalCare = seasonalCare as AgentResponse['seasonalCare'];

  const toxicity = passThroughSection(o.toxicity);
  if (toxicity) result.toxicity = toxicity as AgentResponse['toxicity'];

  if (Array.isArray(o.actionPlan) && o.actionPlan.length > 0) {
    result.actionPlan = o.actionPlan as AgentResponse['actionPlan'];
  }

  const w = warnings(o.warnings);
  if (w) result.warnings = w;

  if (Array.isArray(o.followUpQuestions)) {
    const qs = o.followUpQuestions.map(str).filter((q): q is string => !!q);
    if (qs.length > 0) result.followUpQuestions = qs;
  }

  return result;
}

export function defaultConfidenceFromIntent(
  confidence: ConfidenceLabel | undefined,
): ConfidenceLabel {
  return confidence ?? 'medium';
}

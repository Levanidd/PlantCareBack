/**
 * API contract types — request, agent response, environment.
 */

/* ------------------------------------------------------------------ */
/* Request                                                             */
/* ------------------------------------------------------------------ */

export interface UploadedImage {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface AnalyzeRequest {
  question: string;
  image: UploadedImage | null;
}

/* ------------------------------------------------------------------ */
/* Analyze response — PlantCareResult (frontend contract)                */
/* ------------------------------------------------------------------ */

export type Confidence = 'low' | 'medium' | 'high';
export type Severity = 'info' | 'warning' | 'critical';
export type Priority = 'low' | 'medium' | 'high';

export const CARE_PROFILE_KEYS = [
  'watering',
  'light',
  'humidity',
  'temperature',
  'soil',
  'fertilizer',
  'size',
] as const;

export interface PlantIdentification {
  commonName?: string;
  scientificName?: string;
  alsoKnownAs?: string[];
  confidence?: Confidence;
  description?: string;
}

export interface CareProfileItem {
  key: string;
  label: string;
  value: string;
  detail?: string;
}

export interface DiagnosisIssue {
  title: string;
  severity: Severity;
  description?: string;
  likelyCause?: string;
}

export interface DiagnosisSection {
  healthStatus?: string;
  issues: DiagnosisIssue[];
}

export interface WateringPlan {
  frequency?: string;
  amount?: string;
  method?: string;
  notes?: string;
}

export interface ActionItem {
  id: string;
  text: string;
  priority?: Priority;
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type TriState = 'yes' | 'no' | 'unknown';

export interface HealthCheckSection {
  healthySigns?: string[];
  warningSigns?: string[];
  monthlyChecklist?: string[];
}

export interface ToxicitySection {
  toxicToCats?: TriState;
  toxicToDogs?: TriState;
  riskForChildren?: TriState;
  possibleSymptoms?: string[];
  safetyAdvice?: string;
}

/** Legacy frontend response from POST /analyze. Only summary is guaranteed. */
export interface PlantCareResult {
  summary: string;
  /** Care difficulty 1 (very easy) – 10 (very demanding). Shown as a ring near summary. */
  careDifficultyScore?: number;
  warnings?: string[];
  identification?: PlantIdentification;
  careProfile?: CareProfileItem[];
  diagnosis?: DiagnosisSection;
  wateringPlan?: WateringPlan;
  actionPlan?: ActionItem[];
  followUps?: string[];
  /** Seasonal care note for the current period. */
  seasonalAdvice?: string;
  /** Monthly health checklist (existing plants). */
  healthCheck?: HealthCheckSection;
  /** First steps after buying a new plant. */
  onboarding?: string[];
  /** Pet/child safety assessment. */
  toxicity?: ToxicitySection;
  /** Diagnosis prevention tips. */
  preventionTips?: string[];
}

/* ------------------------------------------------------------------ */
/* Extended agent response (config / future use)                         */
/* ------------------------------------------------------------------ */

export type ConfidenceLabel = 'low' | 'medium' | 'high';
export type ActionPriority = 'low' | 'medium' | 'high';
export type WarningType = 'toxicity' | 'urgency' | 'confidence' | 'general';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SummarySection {
  title: string;
  shortAnswer: string;
}

export interface PlantCardSection {
  commonName?: string;
  scientificName?: string;
  confidence?: number;
  confidenceLabel?: ConfidenceLabel;
  alternativePlants?: string[];
}

export interface CareGuideSection {
  difficultyLevel?: DifficultyLevel;
  intro?: string;
  basicCareTips?: string[];
}

export interface OnboardingSection {
  quarantineAdvice?: string;
  firstWateringAdvice?: string;
  repottingTiming?: string;
  storeSoilAdvice?: string;
  firstTwoWeeksChecklist?: string[];
}

export interface HealthCheckSection {
  healthySigns?: string[];
  warningSigns?: string[];
  monthlyChecklist?: string[];
  preventionTips?: string[];
}

export interface WateringSection {
  summerFrequency?: string;
  winterFrequency?: string;
  howToCheckSoil?: string;
  waterType?: string;
  commonMistakes?: string[];
  overwateringRisk?: string;
  underwateringRisk?: string;
}

export interface LightPlacementSection {
  lightType?: string;
  bestPlacement?: string;
  placesToAvoid?: string[];
  balconyAdvice?: string;
  directSunRisk?: string;
}

export interface RepottingSection {
  repottingFrequency?: string;
  bestSeason?: string;
  potMaterial?: string;
  potSizeIncrease?: string;
  drainageRequired?: boolean;
  soilMix?: string;
  plantingLayers?: string[];
  cachepotWarning?: string;
}

export interface FertilizingSection {
  fertilizerType?: string;
  fertilizingFrequency?: string;
  activeSeasonAdvice?: string;
  restSeasonAdvice?: string;
  whenNotToFertilize?: string;
  overfertilizingWarning?: string;
}

export interface DiagnosisSection {
  likelyProblems?: string[];
  symptomsObserved?: string[];
  possibleCauses?: string[];
  treatmentPlan?: string[];
  preventionPlan?: string[];
  urgencyLevel?: UrgencyLevel;
}

export interface SeasonalCareSection {
  currentSeason?: string;
  wateringAdjustment?: string;
  fertilizingAdjustment?: string;
  lightAdjustment?: string;
  seasonalRisks?: string[];
  nextMonthsAdvice?: string[];
}

export interface ToxicitySection {
  toxicToCats?: TriState;
  toxicToDogs?: TriState;
  riskForChildren?: TriState;
  possibleSymptoms?: string[];
  safetyAdvice?: string;
  severityLevel?: ConfidenceLabel;
}

export interface ActionPlanItem {
  priority: ActionPriority;
  title: string;
  description: string;
  timeframe?: string;
}

export interface WarningItem {
  type: WarningType;
  message: string;
}

export interface ResponseMetadata {
  usedSkills: string[];
  language: string;
  responseType: 'plant-care-analysis';
  detectedIntent?: string;
  overallConfidence?: ConfidenceLabel;
  historyItemId?: string;
}

/** Full structured response for frontend rendering. */
export interface AgentResponse {
  summary: SummarySection;
  plantCard?: PlantCardSection;
  careGuide?: CareGuideSection;
  onboarding?: OnboardingSection;
  healthCheck?: HealthCheckSection;
  watering?: WateringSection;
  lightAndPlacement?: LightPlacementSection;
  repotting?: RepottingSection;
  fertilizing?: FertilizingSection;
  diagnosis?: DiagnosisSection;
  seasonalCare?: SeasonalCareSection;
  toxicity?: ToxicitySection;
  actionPlan?: ActionPlanItem[];
  warnings?: WarningItem[];
  followUpQuestions?: string[];
  metadata: ResponseMetadata;
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

export interface HistoryListItem {
  id: string;
  createdAt: string;
  question: string;
  hasImage: boolean;
  preview: string;
  plantName?: string;
}

export interface HistoryItemDetails extends HistoryListItem {
  response: PlantCareResult;
}

/* ------------------------------------------------------------------ */
/* Worker environment                                                  */
/* ------------------------------------------------------------------ */

export interface Env {
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  DEFAULT_LANGUAGE?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  MAX_IMAGE_BYTES?: string;
  RATE_LIMIT_KV?: KVNamespace;
  /** Optional KV for session history (History Skill). */
  HISTORY_KV?: KVNamespace;
  /** Versioned skills / tools / agents configuration. */
  CONFIG_KV?: KVNamespace;
}

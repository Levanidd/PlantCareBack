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
/* Agent response (frontend-ready sections)                            */
/* ------------------------------------------------------------------ */

export type ConfidenceLabel = 'low' | 'medium' | 'high';
export type ActionPriority = 'low' | 'medium' | 'high';
export type WarningType = 'toxicity' | 'urgency' | 'confidence' | 'general';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type TriState = 'yes' | 'no' | 'unknown';

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
  response: AgentResponse;
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

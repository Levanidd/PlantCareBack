/**
 * Contract types shared with the Plant Care Agent frontend.
 *
 * The backend is the ONLY place that talks to Gemini. It returns a
 * `PlantCareResult` that the frontend renders verbatim — the frontend never
 * generates plant-care content itself.
 */

export type Confidence = 'low' | 'medium' | 'high';
export type Severity = 'info' | 'warning' | 'critical';
export type Priority = 'low' | 'medium' | 'high';

/** Stable keys the frontend maps to icons in the care-profile grid. */
export const CARE_PROFILE_KEYS = [
  'watering',
  'light',
  'humidity',
  'temperature',
  'soil',
  'fertilizer',
  'size',
] as const;

/* ------------------------------------------------------------------ */
/* Request                                                             */
/* ------------------------------------------------------------------ */

export interface UploadedImage {
  name: string;
  mimeType: string;
  /** Size in bytes of the original (pre-compression) file. */
  size: number;
  /** Base64 data URL (already downscaled on the client). */
  dataUrl: string;
}

export interface AnalyzeRequest {
  question: string;
  image: UploadedImage | null;
}

/* ------------------------------------------------------------------ */
/* Response — PlantCareResult                                          */
/* ------------------------------------------------------------------ */

export interface PlantIdentification {
  commonName?: string;
  scientificName?: string;
  alsoKnownAs?: string[];
  confidence?: Confidence;
  description?: string;
}

export interface CareProfileItem {
  /** One of CARE_PROFILE_KEYS. */
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

export interface PlantCareResult {
  /** Mandatory main answer. */
  summary: string;
  confidence?: Confidence;
  warnings?: string[];
  identification?: PlantIdentification;
  careProfile?: CareProfileItem[];
  diagnosis?: DiagnosisSection;
  wateringPlan?: WateringPlan;
  actionPlan?: ActionItem[];
  followUps?: string[];
}

/* ------------------------------------------------------------------ */
/* Worker environment                                                  */
/* ------------------------------------------------------------------ */

export interface Env {
  /** Secret — never returned to the client. */
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  DEFAULT_LANGUAGE?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  MAX_IMAGE_BYTES?: string;
  /** Optional KV namespace for durable rate limiting. */
  RATE_LIMIT_KV?: KVNamespace;
}

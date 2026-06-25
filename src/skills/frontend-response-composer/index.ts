export const PROMPT = `You are the Frontend Response Composer Skill for the Plant Care Agent.

You do NOT provide new plant expertise. You merge outputs from upstream skills into ONE JSON object
in the legacy PlantCareResult format expected by the frontend.

INPUT: JSON blobs from skills already executed (intent, identification, care guide, diagnosis, etc.).

OUTPUT — PlantCareResult (only "summary" is mandatory):

{
  "summary": "string",              // REQUIRED. Main answer in the user's language.
  "confidence": "low|medium|high",  // overall confidence
  "warnings": ["string"],           // plain-text warnings (low confidence, toxicity, urgency)
  "identification": {
    "commonName": "string",
    "scientificName": "string",
    "alsoKnownAs": ["string"],
    "confidence": "low|medium|high",
    "description": "string"
  },
  "careProfile": [
    {
      "key": "watering|light|humidity|temperature|soil|fertilizer|size",
      "label": "Watering",
      "value": "Every 7–10 days",
      "detail": "optional one-liner"
    }
  ],
  "diagnosis": {
    "healthStatus": "string",
    "issues": [
      {
        "title": "string",
        "severity": "info|warning|critical",
        "description": "string",
        "likelyCause": "string"
      }
    ]
  },
  "wateringPlan": {
    "frequency": "string",
    "amount": "string",
    "method": "string",
    "notes": "string"
  },
  "actionPlan": [
    { "id": "1", "text": "string", "priority": "low|medium|high" }
  ],
  "followUps": ["string"]
}

MAPPING RULES (from upstream skills):
- identification ← plant-identification (map confidenceLabel to confidence enum; alternativePlants → alsoKnownAs)
- summary ← care-expert.summary (refine to address the user's question; keep it one string)
- careProfile ← care-expert.careProfile (already keyed: watering/light/humidity/temperature/soil/fertilizer/size)
- wateringPlan ← care-expert.wateringPlan
- diagnosis ← diagnosis-safety (healthStatus + issues; map severities as given)
- actionPlan ← care-expert.actionItems + diagnosis-safety.treatmentSteps + onboardingSteps
  (assign unique string ids "1","2",… and priorities; urgent diagnosis steps = high priority)
- followUps ← care-expert.followUps and/or follow-up-questions skill
- warnings ← diagnosis-safety.warnings, toxicity risks (toxicToCats/Dogs/Children = "yes"),
  critical urgencyLevel, and low overall confidence (as plain strings)
- confidence ← intent confidence or identification confidence (whichever is lower if unsure)

RULES:
- summary MUST be a single string (not an object).
- warnings MUST be an array of strings, NOT objects.
- actionPlan[].id MUST be unique strings ("1", "2", "3"…).
- Include a block only when upstream data supports it; omit empty blocks.
- Do not invent facts not present in upstream skill outputs.
- User-facing text in the user's language.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    confidence: { type: 'STRING', enum: ['low', 'medium', 'high'], nullable: true },
    warnings: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    identification: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        commonName: { type: 'STRING', nullable: true },
        scientificName: { type: 'STRING', nullable: true },
        alsoKnownAs: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
        confidence: { type: 'STRING', enum: ['low', 'medium', 'high'], nullable: true },
        description: { type: 'STRING', nullable: true },
      },
    },
    careProfile: {
      type: 'ARRAY',
      nullable: true,
      items: {
        type: 'OBJECT',
        properties: {
          key: {
            type: 'STRING',
            enum: ['watering', 'light', 'humidity', 'temperature', 'soil', 'fertilizer', 'size'],
          },
          label: { type: 'STRING' },
          value: { type: 'STRING' },
          detail: { type: 'STRING', nullable: true },
        },
        required: ['key', 'label', 'value'],
      },
    },
    diagnosis: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        healthStatus: { type: 'STRING', nullable: true },
        issues: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              severity: { type: 'STRING', enum: ['info', 'warning', 'critical'] },
              description: { type: 'STRING', nullable: true },
              likelyCause: { type: 'STRING', nullable: true },
            },
            required: ['title', 'severity'],
          },
        },
      },
    },
    wateringPlan: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        frequency: { type: 'STRING', nullable: true },
        amount: { type: 'STRING', nullable: true },
        method: { type: 'STRING', nullable: true },
        notes: { type: 'STRING', nullable: true },
      },
    },
    actionPlan: {
      type: 'ARRAY',
      nullable: true,
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          text: { type: 'STRING' },
          priority: { type: 'STRING', enum: ['low', 'medium', 'high'], nullable: true },
        },
        required: ['id', 'text'],
      },
    },
    followUps: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
  },
  required: ['summary'],
} as const;

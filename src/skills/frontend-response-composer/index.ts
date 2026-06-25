export const PROMPT = `You are the Frontend Response Composer Skill for the Plant Care Agent.

You do NOT provide new plant expertise. You merge outputs from upstream skills into ONE frontend-ready JSON object.

INPUT: You receive JSON blobs from skills already executed (intent, identification, care guide, diagnosis, etc.).

OUTPUT RULES:
- Return structured sections only — no long plain-text essay.
- summary is REQUIRED: { title, shortAnswer } — concise, in the user's language.
- Include only sections that have real data from upstream skills; omit empty sections.
- Remove duplicates across sections.
- If overall confidence is low, add a warnings entry with type "confidence".
- If toxicity risk for pets/children, add warnings with type "toxicity".
- If diagnosis urgency is high or critical, add high-priority actionPlan items.
- actionPlan: concrete steps with priority, title, description, optional timeframe.
- followUpQuestions: merge from follow-up skill if present (max 4).
- metadata.usedSkills: list human-readable skill names that contributed data.
- metadata.language: user's language code.
- metadata.responseType: always "plant-care-analysis".
- metadata.overallConfidence: low | medium | high.
- metadata.detectedIntent: from intent skill.

SECTION MAPPING (map upstream skill outputs into these blocks):
- plantCard ← plant-identification
- careGuide ← plant-care-guide
- onboarding ← new-plant-onboarding
- healthCheck ← existing-plant-health-check
- watering ← watering skill
- lightAndPlacement ← light-placement
- repotting ← repotting
- fertilizing ← fertilizing
- diagnosis ← disease-pest-diagnosis
- seasonalCare ← seasonal-care
- toxicity ← toxicity-safety

Do not invent data not supported by upstream skill outputs.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        shortAnswer: { type: 'STRING' },
      },
      required: ['title', 'shortAnswer'],
    },
    plantCard: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        commonName: { type: 'STRING', nullable: true },
        scientificName: { type: 'STRING', nullable: true },
        confidence: { type: 'NUMBER', nullable: true },
        confidenceLabel: { type: 'STRING', enum: ['low', 'medium', 'high'], nullable: true },
        alternativePlants: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
      },
    },
    careGuide: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        difficultyLevel: { type: 'STRING', enum: ['easy', 'medium', 'hard'], nullable: true },
        intro: { type: 'STRING', nullable: true },
        basicCareTips: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
      },
    },
    onboarding: { type: 'OBJECT', nullable: true, properties: {} },
    healthCheck: { type: 'OBJECT', nullable: true, properties: {} },
    watering: { type: 'OBJECT', nullable: true, properties: {} },
    lightAndPlacement: { type: 'OBJECT', nullable: true, properties: {} },
    repotting: { type: 'OBJECT', nullable: true, properties: {} },
    fertilizing: { type: 'OBJECT', nullable: true, properties: {} },
    diagnosis: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        likelyProblems: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
        urgencyLevel: { type: 'STRING', enum: ['low', 'medium', 'high', 'critical'], nullable: true },
      },
    },
    seasonalCare: { type: 'OBJECT', nullable: true, properties: {} },
    toxicity: { type: 'OBJECT', nullable: true, properties: {} },
    actionPlan: {
      type: 'ARRAY',
      nullable: true,
      items: {
        type: 'OBJECT',
        properties: {
          priority: { type: 'STRING', enum: ['low', 'medium', 'high'] },
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          timeframe: { type: 'STRING', nullable: true },
        },
        required: ['priority', 'title', 'description'],
      },
    },
    warnings: {
      type: 'ARRAY',
      nullable: true,
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['toxicity', 'urgency', 'confidence', 'general'] },
          message: { type: 'STRING' },
        },
        required: ['type', 'message'],
      },
    },
    followUpQuestions: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    metadata: {
      type: 'OBJECT',
      properties: {
        usedSkills: { type: 'ARRAY', items: { type: 'STRING' } },
        language: { type: 'STRING' },
        responseType: { type: 'STRING' },
        detectedIntent: { type: 'STRING', nullable: true },
        overallConfidence: { type: 'STRING', enum: ['low', 'medium', 'high'], nullable: true },
      },
      required: ['usedSkills', 'language', 'responseType'],
    },
  },
  required: ['summary', 'metadata'],
} as const;

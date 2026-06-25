export const PROMPT = `You are the Diagnosis & Safety Skill for the Plant Care Agent.

You combine two responsibilities in ONE response:
1. DIAGNOSIS — identify likely diseases, pests, or care problems from symptoms and/or photo.
2. SAFETY — assess toxicity for cats, dogs, and children.

WHAT TO PRODUCE:
- "healthStatus": one-line overall assessment of the plant's condition.
- "issues": problems found. Each: { title, severity: info|warning|critical, description?, likelyCause? }.
- "treatmentSteps": ordered, concrete treatment actions.
- "preventionTips": how to prevent recurrence.
- "urgencyLevel": low | medium | high | critical.
- "toxicToCats", "toxicToDogs", "riskForChildren": yes | no | unknown.
- "possibleSymptoms": symptoms if the plant is ingested (when toxic).
- "safetyAdvice": short safety recommendation.
- "warnings": plain-text warnings to surface (e.g. toxicity, urgent issue, low confidence).

RULES:
- Diagnose only when symptoms are described or visible; if nothing is wrong, return an empty
  "issues" array and a reassuring "healthStatus".
- List multiple possibilities when uncertain; do not assert a single diagnosis as fact unless confident.
- Use the photo's visual cues when available.
- If the plant is unknown, set toxicity fields to "unknown" and add a warning.
- Mark "urgencyLevel" critical for fast spread, rot, or severe infestation.
- All user-facing text MUST be in the user's language (provided in context).`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    healthStatus: { type: 'STRING', nullable: true },
    issues: {
      type: 'ARRAY',
      nullable: true,
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
    treatmentSteps: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    preventionTips: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    urgencyLevel: { type: 'STRING', enum: ['low', 'medium', 'high', 'critical'], nullable: true },
    toxicToCats: { type: 'STRING', enum: ['yes', 'no', 'unknown'], nullable: true },
    toxicToDogs: { type: 'STRING', enum: ['yes', 'no', 'unknown'], nullable: true },
    riskForChildren: { type: 'STRING', enum: ['yes', 'no', 'unknown'], nullable: true },
    possibleSymptoms: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    safetyAdvice: { type: 'STRING', nullable: true },
    warnings: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
  },
} as const;

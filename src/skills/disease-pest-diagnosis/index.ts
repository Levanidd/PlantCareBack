export const PROMPT = `You are the Disease & Pest Diagnosis Skill for the Plant Care Agent.

Diagnose likely problems from symptoms and/or photo.

Cover: likely problems, observed symptoms, possible causes, treatment plan (steps), prevention plan, urgency level (low | medium | high | critical).

RULES:
- List multiple possibilities when uncertain; do not state a single diagnosis as fact unless confident.
- Use photo visual cues when available.
- urgencyLevel critical for rapid spread, rot, severe pest infestation.
- User-facing text in the user's language.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    likelyProblems: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    symptomsObserved: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    possibleCauses: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    treatmentPlan: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    preventionPlan: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    urgencyLevel: { type: 'STRING', enum: ['low', 'medium', 'high', 'critical'], nullable: true },
  },
} as const;

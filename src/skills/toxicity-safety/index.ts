export const PROMPT = `You are the Toxicity & Safety Skill for the Plant Care Agent.

Assess safety for cats, dogs, and children.

Cover: toxicToCats, toxicToDogs, riskForChildren (each: yes | no | unknown), possible symptoms if ingested, safety advice, severity level (low | medium | high).

RULES:
- If plant is unknown, set fields to unknown and warn.
- Always add safety advice when any toxicity risk exists.
- User-facing text in the user's language.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    toxicToCats: { type: 'STRING', enum: ['yes', 'no', 'unknown'], nullable: true },
    toxicToDogs: { type: 'STRING', enum: ['yes', 'no', 'unknown'], nullable: true },
    riskForChildren: { type: 'STRING', enum: ['yes', 'no', 'unknown'], nullable: true },
    possibleSymptoms: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    safetyAdvice: { type: 'STRING', nullable: true },
    severityLevel: { type: 'STRING', enum: ['low', 'medium', 'high'], nullable: true },
  },
} as const;

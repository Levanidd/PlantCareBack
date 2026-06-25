export const PROMPT = `You are the Light & Placement Skill for the Plant Care Agent.

Recommend where to place the plant indoors (or balcony/outdoor if relevant).

Cover: light type, best placement, places to avoid, balcony advice, direct sun risk.

RULES:
- Consider window direction, season, and draft/radiator risks when relevant.
- User-facing text in the user's language.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    lightType: { type: 'STRING', nullable: true },
    bestPlacement: { type: 'STRING', nullable: true },
    placesToAvoid: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    balconyAdvice: { type: 'STRING', nullable: true },
    directSunRisk: { type: 'STRING', nullable: true },
  },
} as const;

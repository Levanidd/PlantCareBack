export const PROMPT = `You are the Watering Skill for the Plant Care Agent.

Provide watering recommendations for the plant and situation described.

Cover: summer/winter frequency, how to check soil moisture, water type, common mistakes, overwatering and underwatering risks.

RULES:
- Adapt to season, light, and pot type when mentioned.
- User-facing text in the user's language.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    summerFrequency: { type: 'STRING', nullable: true },
    winterFrequency: { type: 'STRING', nullable: true },
    howToCheckSoil: { type: 'STRING', nullable: true },
    waterType: { type: 'STRING', nullable: true },
    commonMistakes: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    overwateringRisk: { type: 'STRING', nullable: true },
    underwateringRisk: { type: 'STRING', nullable: true },
  },
} as const;

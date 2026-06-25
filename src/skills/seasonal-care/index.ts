export const PROMPT = `You are the Seasonal Care Skill for the Plant Care Agent.

Adapt care advice to the current season (infer from context or use Northern Hemisphere defaults and note assumption).

Cover: current season, watering/fertilizing/light adjustments, seasonal risks, advice for upcoming months.

RULES:
- State which season you assumed if the user did not provide location/date.
- User-facing text in the user's language.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    currentSeason: { type: 'STRING', nullable: true },
    wateringAdjustment: { type: 'STRING', nullable: true },
    fertilizingAdjustment: { type: 'STRING', nullable: true },
    lightAdjustment: { type: 'STRING', nullable: true },
    seasonalRisks: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    nextMonthsAdvice: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
  },
} as const;

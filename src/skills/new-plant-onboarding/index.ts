export const PROMPT = `You are the New Plant Onboarding Skill for the Plant Care Agent.

The user just acquired a new plant. Provide first-week guidance.

Cover: quarantine advice, first watering, repotting timing, store-bought soil advice, and a first-two-weeks checklist.

RULES:
- Practical steps for an average home grower.
- Warn about common post-purchase issues (pests, shock, overwatering).
- User-facing text in the user's language.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    quarantineAdvice: { type: 'STRING', nullable: true },
    firstWateringAdvice: { type: 'STRING', nullable: true },
    repottingTiming: { type: 'STRING', nullable: true },
    storeSoilAdvice: { type: 'STRING', nullable: true },
    firstTwoWeeksChecklist: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
  },
} as const;

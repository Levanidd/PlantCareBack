export const PROMPT = `You are the Fertilizing Skill for the Plant Care Agent.

Provide fertilizer and feeding guidance.

Cover: fertilizer type, frequency, active/rest season advice, when not to fertilize, over-fertilizing warning.

RULES:
- Never recommend heavy feeding for stressed or sick plants without warning.
- User-facing text in the user's language.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    fertilizerType: { type: 'STRING', nullable: true },
    fertilizingFrequency: { type: 'STRING', nullable: true },
    activeSeasonAdvice: { type: 'STRING', nullable: true },
    restSeasonAdvice: { type: 'STRING', nullable: true },
    whenNotToFertilize: { type: 'STRING', nullable: true },
    overfertilizingWarning: { type: 'STRING', nullable: true },
  },
} as const;

export const PROMPT = `You are the Repotting Skill for the Plant Care Agent.

Provide repotting, pot, and soil guidance.

Cover: repotting frequency, best season, pot material, pot size increase, drainage, soil mix, planting layers, cachepot warnings.

RULES:
- Warn against pots without drainage holes.
- User-facing text in the user's language.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    repottingFrequency: { type: 'STRING', nullable: true },
    bestSeason: { type: 'STRING', nullable: true },
    potMaterial: { type: 'STRING', nullable: true },
    potSizeIncrease: { type: 'STRING', nullable: true },
    drainageRequired: { type: 'BOOLEAN', nullable: true },
    soilMix: { type: 'STRING', nullable: true },
    plantingLayers: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    cachepotWarning: { type: 'STRING', nullable: true },
  },
} as const;

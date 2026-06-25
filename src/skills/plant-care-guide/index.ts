export const PROMPT = `You are the Plant Care Guide Skill for the Plant Care Agent.

Produce a practical care guide for the identified or named houseplant.

Cover: short introduction, difficulty level (easy | medium | hard), watering, light, humidity, temperature, and basic care tips.

RULES:
- Base advice on the specific plant when known; otherwise give cautious generic houseplant guidance and note uncertainty.
- Do not invent precise measurements you are unsure about.
- User-facing text must be in the user's language (provided in context).`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    shortIntroduction: { type: 'STRING', nullable: true },
    difficultyLevel: { type: 'STRING', enum: ['easy', 'medium', 'hard'], nullable: true },
    wateringAdvice: { type: 'STRING', nullable: true },
    lightAdvice: { type: 'STRING', nullable: true },
    humidityAdvice: { type: 'STRING', nullable: true },
    temperatureAdvice: { type: 'STRING', nullable: true },
    basicCareTips: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
  },
} as const;

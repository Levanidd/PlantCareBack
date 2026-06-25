export const PROMPT = `You are the Care Expert Skill for the Plant Care Agent.

You are a consolidated houseplant care specialist. In ONE response you cover everything
about general care for the plant in question: introduction, difficulty, watering, light,
humidity, temperature, soil, fertilizer, repotting, seasonal adjustments, new-plant
onboarding (if just acquired), and an ongoing health-check routine.

WHAT TO PRODUCE:
- "summary": a clear, helpful main answer to the user's request, in their language.
- "difficultyLevel": easy | medium | hard.
- "careProfile": metric tiles. Each item: { key, label, value, detail? }.
  "key" MUST be one of: watering | light | humidity | temperature | soil | fertilizer | size.
  Use each key at most once. "value" is the headline (e.g. "Every 7–10 days").
- "wateringPlan": { frequency, amount, method, notes } — practical watering routine.
- "onboardingSteps": first steps ONLY if the user just bought/received the plant; else omit.
- "healthCheck": { healthySigns[], warningSigns[], monthlyChecklist[] } — what to monitor.
- "seasonalAdvice": short note adapting care to the current season (state assumed season).
- "careTips": a few extra practical tips.
- "actionItems": concrete next steps, each { text, priority: low|medium|high }.
- "followUps": 2–4 short follow-up questions the user might ask next.

RULES:
- Base advice on the specific plant when known (see identified plant in context).
- If the plant is unknown, give cautious generic houseplant guidance and say so in summary.
- Do NOT invent precise numbers you are unsure about; keep ranges realistic.
- Only include blocks relevant to the request; omit empty ones.
- All user-facing text MUST be in the user's language (provided in context).`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    difficultyLevel: { type: 'STRING', enum: ['easy', 'medium', 'hard'], nullable: true },
    careProfile: {
      type: 'ARRAY',
      nullable: true,
      items: {
        type: 'OBJECT',
        properties: {
          key: {
            type: 'STRING',
            enum: ['watering', 'light', 'humidity', 'temperature', 'soil', 'fertilizer', 'size'],
          },
          label: { type: 'STRING' },
          value: { type: 'STRING' },
          detail: { type: 'STRING', nullable: true },
        },
        required: ['key', 'label', 'value'],
      },
    },
    wateringPlan: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        frequency: { type: 'STRING', nullable: true },
        amount: { type: 'STRING', nullable: true },
        method: { type: 'STRING', nullable: true },
        notes: { type: 'STRING', nullable: true },
      },
    },
    onboardingSteps: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    healthCheck: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        healthySigns: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
        warningSigns: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
        monthlyChecklist: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
      },
    },
    seasonalAdvice: { type: 'STRING', nullable: true },
    careTips: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    actionItems: {
      type: 'ARRAY',
      nullable: true,
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          priority: { type: 'STRING', enum: ['low', 'medium', 'high'], nullable: true },
        },
        required: ['text'],
      },
    },
    followUps: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
  },
  required: ['summary'],
} as const;

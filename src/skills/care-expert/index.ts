export const PROMPT = `You are the Care Expert Skill for the Plant Care Agent.

You are a warm, knowledgeable houseplant specialist.
Write all user-facing text in the output language from context (see "Output language" line).
Do NOT hardcode a language — follow context every request.

CRITICAL — NO DUPLICATE CONTENT
Each fact appears in exactly ONE place. The frontend shows summary, careProfile tiles,
and wateringPlan side by side; repeating the same advice in multiple fields is forbidden.

FIELD ROLES (single source of truth):

| Field | What goes here | What must NOT go here |
|-------|----------------|----------------------|
| summary | 2–4 sentences ONLY: plant character, who it suits, direct answer to the user's question | NO difficulty score (use careDifficultyScore), NO watering/light/soil details |
| careProfile | Short metric tiles: "value" = headline (≤10 words), "detail" = optional ONE short line (≤15 words) | NO paragraphs, NO content that duplicates wateringPlan or seasonalAdvice |
| wateringPlan | ALL watering depth: summer/winter in frequency, how to check in method, water type in amount, mistakes in notes | Do not repeat this in summary or careProfile.detail |
| seasonalAdvice | Seasonal changes for current date + next 2–3 months | Not in summary or careProfile |
| careProfile.soil | Repotting ONLY here (pot, mix, layers, cachepot) in value + detail | Not in summary |
| onboarding / healthCheck | First steps OR monthly checklist | Not in summary |
| careTips | Tips not covered anywhere else | No repeats |
| actionItems | Next steps | No repeats |

careDifficultyScore — REQUIRED when giving a plant care guide. Integer 1–10:
  1–2 very easy (beginner-friendly), 3–4 easy, 5–6 moderate, 7–8 demanding, 9–10 expert/challenging.
  Base on the specific plant's real care needs, not generic defaults.

careProfile "watering" tile when wateringPlan is present:
- value = one headline only, e.g. "Every 5–7 days in summer"
- detail = omit or leave empty (full info is in wateringPlan)

OWNERSHIP TAG (from context):
- "new" → onboardingSteps only (no healthCheck focus)
- "existing" → healthCheck only (no onboardingSteps)
- "unknown" → infer from message

CURRENT DATE is in context — use for seasonalAdvice only.

Fill all applicable structured fields with depth, but keep summary short and non-overlapping.

RULES:
- Be specific with numbers in the correct field only.
- Base advice on the identified plant when known.
- Symptoms: brief mention in summary only; diagnosis is diagnosis-safety's job.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    careDifficultyScore: { type: 'INTEGER', nullable: true },
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
  },
  required: ['summary'],
} as const;

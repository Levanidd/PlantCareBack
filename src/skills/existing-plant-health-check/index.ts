export const PROMPT = `You are the Existing Plant Health Check Skill for the Plant Care Agent.

The plant has been at home for a while. Provide a health assessment framework.

Cover: healthy signs, warning signs, monthly checklist, prevention tips.

RULES:
- Do not diagnose without symptoms; focus on what to inspect.
- User-facing text in the user's language.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    healthySigns: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    warningSigns: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    monthlyChecklist: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    preventionTips: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
  },
} as const;

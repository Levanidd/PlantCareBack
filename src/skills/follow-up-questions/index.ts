export const PROMPT = `You are the Follow-up Question Skill for the Plant Care Agent.

Generate clarifying questions when information is missing or ambiguous.

Cover: 2–4 followUpQuestions, requestedPhotos (what photo would help), missingInformation list.

RULES:
- Questions must be short and tappable (one sentence each).
- Do not repeat information already provided.
- User-facing text in the user's language.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    followUpQuestions: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    requestedPhotos: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    missingInformation: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
  },
} as const;

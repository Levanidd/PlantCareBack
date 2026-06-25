export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    detectedIntent: { type: 'STRING' },
    skillsToRun: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
    needsClarification: { type: 'BOOLEAN' },
    detectedLanguage: { type: 'STRING' },
    clarificationReason: { type: 'STRING', nullable: true },
  },
  required: ['detectedIntent', 'skillsToRun', 'confidence', 'needsClarification', 'detectedLanguage'],
} as const;

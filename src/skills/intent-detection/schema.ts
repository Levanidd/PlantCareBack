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
    ownershipTag: { type: 'STRING', enum: ['new', 'existing', 'unknown'], nullable: true },
    clarificationReason: { type: 'STRING', nullable: true },
    sectionOrder: {
      type: 'ARRAY',
      nullable: true,
      items: {
        type: 'STRING',
        enum: [
          'identification',
          'diagnosis',
          'careProfile',
          'watering',
          'toxicity',
          'seasonal',
          'actionPlan',
        ],
      },
    },
  },
  required: ['detectedIntent', 'skillsToRun', 'confidence', 'needsClarification', 'detectedLanguage'],
} as const;

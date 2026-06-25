export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    commonName: { type: 'STRING', nullable: true },
    scientificName: { type: 'STRING', nullable: true },
    confidence: { type: 'NUMBER' },
    confidenceLabel: { type: 'STRING', enum: ['low', 'medium', 'high'] },
    alternativePlants: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    identificationNotes: { type: 'STRING', nullable: true },
  },
  required: ['confidence', 'confidenceLabel'],
} as const;

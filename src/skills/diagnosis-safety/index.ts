export const PROMPT = `You are the Diagnosis & Safety Skill for the Plant Care Agent.

You combine disease/pest diagnosis with pet and child safety assessment.
Write all user-facing text in the output language from context (see "Output language" line).

ALWAYS ASSESS TOXICITY — even when the user did not ask about pets or children.
For every request involving a named or identified plant, you MUST set:
toxicToCats, toxicToDogs, riskForChildren (yes | no | unknown).
If any is "yes", add a clear warning to "warnings" and fill possibleSymptoms
and safetyAdvice.

DIAGNOSIS (when symptoms are described or visible in photo):
- healthStatus — one-line assessment.
- issues[] — each: title (e.g. "Likely: ..."), severity info|warning|critical,
  description (symptoms), likelyCause (cause).
- treatmentSteps — ordered concrete steps; include product names or folk remedies
  when appropriate.
- preventionTips — how to prevent recurrence.
- urgencyLevel — low | medium | high | critical.
- Add urgent issues to "warnings".

WHEN NO PROBLEM IS VISIBLE:
- Empty issues[], reassuring healthStatus.
- Still complete toxicity assessment.

RULES:
- Multiple possibilities when uncertain — do not state one diagnosis as fact unless confident.
- Use photo visual cues when available.
- Unknown plant → toxicity fields "unknown", warning in warnings.
- critical urgency for fast-spreading pests, rot, severe infestation.`;

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    healthStatus: { type: 'STRING', nullable: true },
    issues: {
      type: 'ARRAY',
      nullable: true,
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          severity: { type: 'STRING', enum: ['info', 'warning', 'critical'] },
          description: { type: 'STRING', nullable: true },
          likelyCause: { type: 'STRING', nullable: true },
        },
        required: ['title', 'severity'],
      },
    },
    treatmentSteps: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    preventionTips: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    urgencyLevel: { type: 'STRING', enum: ['low', 'medium', 'high', 'critical'], nullable: true },
    toxicToCats: { type: 'STRING', enum: ['yes', 'no', 'unknown'], nullable: true },
    toxicToDogs: { type: 'STRING', enum: ['yes', 'no', 'unknown'], nullable: true },
    riskForChildren: { type: 'STRING', enum: ['yes', 'no', 'unknown'], nullable: true },
    possibleSymptoms: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    safetyAdvice: { type: 'STRING', nullable: true },
    warnings: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
  },
} as const;

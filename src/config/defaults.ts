/**
 * Built-in defaults seeded into CONFIG_KV on first use.
 */
import * as careExpert from '../skills/care-expert';
import * as composer from '../skills/frontend-response-composer';
import * as diagnosisSafety from '../skills/diagnosis-safety';
import * as followUp from '../skills/follow-up-questions';
import { PROMPT as INTENT_PROMPT } from '../skills/intent-detection/prompt';
import { SCHEMA as INTENT_SCHEMA } from '../skills/intent-detection/schema';
import { PROMPT as ID_PROMPT } from '../skills/plant-identification/prompt';
import { SCHEMA as ID_SCHEMA } from '../skills/plant-identification/schema';
import { SKILL_DISPLAY_NAMES } from '../skills/registry';
import type { SkillId } from '../skills/types';
import type {
  AgentConfigContent,
  EntityMeta,
  SkillConfigContent,
  ToolConfigContent,
  VersionRecord,
} from './types';
import { putEntity, listEntityIds, setActiveAgentPointer } from './store';

interface SkillSeed {
  id: SkillId;
  prompt: string;
  schema: Record<string, unknown>;
  mvp: boolean;
  usesImage: boolean;
  description?: string;
}

const SKILL_SEEDS: SkillSeed[] = [
  {
    id: 'intent-detection',
    prompt: INTENT_PROMPT,
    schema: INTENT_SCHEMA as Record<string, unknown>,
    mvp: true,
    usesImage: true,
    description: 'Detects user intent and selects skills to run.',
  },
  {
    id: 'plant-identification',
    prompt: ID_PROMPT,
    schema: ID_SCHEMA as Record<string, unknown>,
    mvp: true,
    usesImage: true,
    description: 'Identifies plant from photo or description.',
  },
  {
    id: 'care-expert',
    prompt: careExpert.PROMPT,
    schema: careExpert.SCHEMA as Record<string, unknown>,
    mvp: true,
    usesImage: true,
    description:
      'Consolidated care specialist: care guide, watering, light, humidity, soil, fertilizer, repotting, seasonal care, onboarding, health checks.',
  },
  {
    id: 'diagnosis-safety',
    prompt: diagnosisSafety.PROMPT,
    schema: diagnosisSafety.SCHEMA as Record<string, unknown>,
    mvp: true,
    usesImage: true,
    description: 'Disease/pest diagnosis combined with pet and child safety assessment.',
  },
  {
    id: 'follow-up-questions',
    prompt: followUp.PROMPT,
    schema: followUp.SCHEMA as Record<string, unknown>,
    mvp: false,
    usesImage: false,
    description: 'Clarifying follow-up questions.',
  },
  {
    id: 'frontend-response-composer',
    prompt: composer.PROMPT,
    schema: composer.SCHEMA as Record<string, unknown>,
    mvp: true,
    usesImage: false,
    description: 'Merges skill outputs into frontend response.',
  },
];

const TOOL_SEEDS: Array<{ id: string; content: ToolConfigContent; name: string }> = [
  {
    id: 'image-quality-check',
    name: 'Image Quality Check',
    content: {
      description: 'Assess whether an uploaded plant photo is clear enough for identification.',
      kind: 'llm',
      inputSchema: {
        type: 'OBJECT',
        properties: { hasImage: { type: 'BOOLEAN' } },
      },
      outputSchema: {
        type: 'OBJECT',
        properties: {
          isAcceptable: { type: 'BOOLEAN' },
          issues: { type: 'ARRAY', items: { type: 'STRING' } },
          recommendations: { type: 'ARRAY', items: { type: 'STRING' } },
        },
      },
      systemPrompt:
        'You assess plant photo quality. Return JSON with isAcceptable, issues, and recommendations. Be concise.',
    },
  },
  {
    id: 'plant-name-normalizer',
    name: 'Plant Name Normalizer',
    content: {
      description: 'Normalize informal or misspelled plant names to common and scientific names.',
      kind: 'llm',
      inputSchema: {
        type: 'OBJECT',
        properties: { rawName: { type: 'STRING' } },
      },
      outputSchema: {
        type: 'OBJECT',
        properties: {
          commonName: { type: 'STRING' },
          scientificName: { type: 'STRING', nullable: true },
          confidence: { type: 'NUMBER' },
        },
      },
      systemPrompt:
        'Normalize plant names. Return commonName, optional scientificName, and confidence 0-1.',
    },
  },
  {
    id: 'urgency-scorer',
    name: 'Urgency Scorer',
    content: {
      description: 'Score how urgently the user should act on a plant health issue.',
      kind: 'builtin',
      builtinId: 'urgency-scorer',
      inputSchema: {
        type: 'OBJECT',
        properties: { symptoms: { type: 'ARRAY', items: { type: 'STRING' } } },
      },
      outputSchema: {
        type: 'OBJECT',
        properties: { urgencyLevel: { type: 'STRING' } },
      },
    },
  },
];

const DEFAULT_AGENT_ID = 'plant-care-agent';

const ALL_SKILL_IDS: SkillId[] = SKILL_SEEDS.map((s) => s.id);

function seedVersion<T>(content: T, versionNumber: number): VersionRecord<T> {
  const versionId = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    versionId,
    versionNumber,
    createdAt: now,
    label: 'v1 (built-in)',
    changelog: 'Initial built-in version seeded from code.',
    content,
  };
}

function seedMeta(
  id: string,
  kind: 'skill' | 'tool' | 'agent',
  name: string,
  versionId: string,
  description?: string,
): EntityMeta {
  const now = new Date().toISOString();
  return {
    id,
    kind,
    name,
    description,
    activeVersionId: versionId,
    latestVersionNumber: 1,
    createdAt: now,
    updatedAt: now,
    builtIn: true,
  };
}

export async function seedDefaults(env: import('../types').Env): Promise<{ seeded: boolean }> {
  if (!env.CONFIG_KV) return { seeded: false };

  const existing = await listEntityIds(env, 'skill');
  if (existing.length > 0) return { seeded: false };

  const skillIds: string[] = [];
  for (const seed of SKILL_SEEDS) {
    const content: SkillConfigContent = {
      systemPrompt: seed.prompt,
      responseSchema: seed.schema,
      mvp: seed.mvp,
      usesImage: seed.usesImage,
    };
    const version = seedVersion(content, 1);
    const meta = seedMeta(
      seed.id,
      'skill',
      SKILL_DISPLAY_NAMES[seed.id],
      version.versionId,
      seed.description,
    );
    // putEntity appends meta.id to skillIds and writes the index itself.
    await putEntity(env, 'skill', meta, version, [version], skillIds);
  }

  const toolIds: string[] = [];
  for (const seed of TOOL_SEEDS) {
    const version = seedVersion(seed.content, 1);
    const meta = seedMeta(seed.id, 'tool', seed.name, version.versionId, seed.content.description);
    await putEntity(env, 'tool', meta, version, [version], toolIds);
  }

  const agentContent: AgentConfigContent = {
    description: 'Default Plant Care Agent — intent-driven skills pipeline.',
    defaultLanguage: env.DEFAULT_LANGUAGE || 'ru',
    availableSkillIds: ALL_SKILL_IDS.filter(
      (id) => id !== 'intent-detection' && id !== 'frontend-response-composer',
    ),
    toolIds: TOOL_SEEDS.map((t) => t.id),
    pipeline: {
      intentSkillId: 'intent-detection',
      composerSkillId: 'frontend-response-composer',
      alwaysAfterIntent: [],
    },
  };
  const agentVersion = seedVersion(agentContent, 1);
  const agentMeta = seedMeta(
    DEFAULT_AGENT_ID,
    'agent',
    'Plant Care Agent',
    agentVersion.versionId,
    agentContent.description,
  );
  const agentIds: string[] = [];
  await putEntity(env, 'agent', agentMeta, agentVersion, [agentVersion], agentIds);

  await setActiveAgentPointer(env, {
    agentId: DEFAULT_AGENT_ID,
    versionId: agentVersion.versionId,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  });

  return { seeded: true };
}

export { DEFAULT_AGENT_ID, SKILL_SEEDS, TOOL_SEEDS };

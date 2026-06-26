/**
 * Config service — list, read, version, activate skills/tools/agents.
 */
import { HttpError } from '../errors';
import type { Env } from '../types';
import { DEFAULT_AGENT_ID, seedDefaults, SKILL_SEEDS, TOOL_SEEDS } from './defaults';
import {
  clearStore,
  createVersion,
  deleteEntity,
  getActiveAgentPointer,
  getActiveVersion,
  getEntityMeta,
  getVersion,
  isStoreEmpty,
  listEntityIds,
  listVersionMetas,
  setActiveAgentPointer,
  setActiveVersion,
} from './store';
import type {
  ActiveAgentPointer,
  AgentConfigContent,
  CatalogResponse,
  ConfigEntityKind,
  CreateVersionInput,
  EntityDetail,
  EntityMeta,
  EntitySummary,
  SkillConfigContent,
  ToolConfigContent,
  VersionMeta,
  VersionRecord,
} from './types';
import { SKILL_DISPLAY_NAMES } from '../skills/registry';

async function ensureReady(env: Env): Promise<void> {
  if (!env.CONFIG_KV) return;
  if (await isStoreEmpty(env)) {
    await seedDefaults(env);
  }
}

function syntheticVersion<T>(content: T, label: string): VersionRecord<T> {
  return {
    versionId: 'builtin-v1',
    versionNumber: 1,
    createdAt: new Date(0).toISOString(),
    label,
    changelog: 'Built-in code default (read-only until CONFIG_KV is bound).',
    content,
  };
}

function syntheticSkillSummaries(): EntitySummary[] {
  return SKILL_SEEDS.map((s) => ({
    id: s.id,
    kind: 'skill' as const,
    name: SKILL_DISPLAY_NAMES[s.id],
    description: s.description,
    activeVersionId: 'builtin-v1',
    latestVersionNumber: 1,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    builtIn: true,
    activeVersion: {
      versionId: 'builtin-v1',
      versionNumber: 1,
      createdAt: new Date(0).toISOString(),
      label: 'v1 (built-in)',
    },
  }));
}

function syntheticToolSummaries(): EntitySummary[] {
  return TOOL_SEEDS.map((t) => ({
    id: t.id,
    kind: 'tool' as const,
    name: t.name,
    description: t.content.description,
    activeVersionId: 'builtin-v1',
    latestVersionNumber: 1,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    builtIn: true,
    activeVersion: {
      versionId: 'builtin-v1',
      versionNumber: 1,
      createdAt: new Date(0).toISOString(),
      label: 'v1 (built-in)',
    },
  }));
}

async function toSummary(env: Env, kind: ConfigEntityKind, id: string): Promise<EntitySummary | null> {
  const meta = await getEntityMeta(env, kind, id);
  if (!meta) return null;
  const versions = await listVersionMetas(env, kind, id);
  const active = versions.find((v) => v.versionId === meta.activeVersionId) ?? versions[0];
  if (!active) return null;
  return { ...meta, activeVersion: active };
}

async function listSummaries(env: Env, kind: ConfigEntityKind): Promise<EntitySummary[]> {
  await ensureReady(env);
  if (!env.CONFIG_KV) {
    if (kind === 'skill') return syntheticSkillSummaries();
    if (kind === 'tool') return syntheticToolSummaries();
    return [];
  }
  const ids = await listEntityIds(env, kind);
  const out: EntitySummary[] = [];
  for (const id of ids) {
    const s = await toSummary(env, kind, id);
    if (s) out.push(s);
  }
  return out;
}

export async function getCatalog(env: Env): Promise<CatalogResponse> {
  await ensureReady(env);
  const [skills, tools, agents] = await Promise.all([
    listSummaries(env, 'skill'),
    listSummaries(env, 'tool'),
    listSummaries(env, 'agent'),
  ]);
  const activeAgent = env.CONFIG_KV
    ? await getActiveAgentPointer(env)
    : {
        agentId: DEFAULT_AGENT_ID,
        versionId: 'builtin-v1',
        updatedAt: new Date(0).toISOString(),
        updatedBy: 'system',
      };
  return { skills, tools, agents, activeAgent };
}

export async function getSkillDetail(env: Env, id: string): Promise<EntityDetail<SkillConfigContent>> {
  await ensureReady(env);
  if (!env.CONFIG_KV) {
    const seed = SKILL_SEEDS.find((s) => s.id === id);
    if (!seed) throw new HttpError(404, `Skill "${id}" not found.`);
    const content: SkillConfigContent = {
      systemPrompt: seed.prompt,
      responseSchema: seed.schema,
      mvp: seed.mvp,
      usesImage: seed.usesImage,
    };
    return {
      id: seed.id,
      kind: 'skill',
      name: SKILL_DISPLAY_NAMES[seed.id],
      description: seed.description,
      activeVersionId: 'builtin-v1',
      latestVersionNumber: 1,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      builtIn: true,
      activeVersion: syntheticVersion(content, 'v1 (built-in)'),
    };
  }
  const meta = await getEntityMeta(env, 'skill', id);
  if (!meta) throw new HttpError(404, `Skill "${id}" not found.`);
  const active = await getActiveVersion<SkillConfigContent>(env, 'skill', id);
  if (!active) throw new HttpError(404, `Active version for skill "${id}" not found.`);
  return { ...meta, activeVersion: active };
}

export async function getToolDetail(env: Env, id: string): Promise<EntityDetail<ToolConfigContent>> {
  await ensureReady(env);
  if (!env.CONFIG_KV) {
    const seed = TOOL_SEEDS.find((t) => t.id === id);
    if (!seed) throw new HttpError(404, `Tool "${id}" not found.`);
    return {
      id: seed.id,
      kind: 'tool',
      name: seed.name,
      description: seed.content.description,
      activeVersionId: 'builtin-v1',
      latestVersionNumber: 1,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      builtIn: true,
      activeVersion: syntheticVersion(seed.content, 'v1 (built-in)'),
    };
  }
  const meta = await getEntityMeta(env, 'tool', id);
  if (!meta) throw new HttpError(404, `Tool "${id}" not found.`);
  const active = await getActiveVersion<ToolConfigContent>(env, 'tool', id);
  if (!active) throw new HttpError(404, `Active version for tool "${id}" not found.`);
  return { ...meta, activeVersion: active };
}

export async function getAgentDetail(env: Env, id: string): Promise<EntityDetail<AgentConfigContent>> {
  await ensureReady(env);
  if (!env.CONFIG_KV) {
    if (id !== DEFAULT_AGENT_ID) throw new HttpError(404, `Agent "${id}" not found.`);
    const content: AgentConfigContent = {
      description: 'Default Plant Care Agent',
      defaultLanguage: env.DEFAULT_LANGUAGE || 'ru',
      availableSkillIds: SKILL_SEEDS.map((s) => s.id).filter(
        (sid) =>
          sid !== 'intent-detection' &&
          sid !== 'frontend-response-composer' &&
          sid !== 'follow-up-questions',
      ) as AgentConfigContent['availableSkillIds'],
      toolIds: TOOL_SEEDS.map((t) => t.id),
      pipeline: {
        intentSkillId: 'intent-detection',
        composerSkillId: 'frontend-response-composer',
        alwaysAfterIntent: ['diagnosis-safety'],
      },
    };
    return {
      id: DEFAULT_AGENT_ID,
      kind: 'agent',
      name: 'Plant Care Agent',
      description: content.description,
      activeVersionId: 'builtin-v1',
      latestVersionNumber: 1,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      builtIn: true,
      activeVersion: syntheticVersion(content, 'v1 (built-in)'),
    };
  }
  const meta = await getEntityMeta(env, 'agent', id);
  if (!meta) throw new HttpError(404, `Agent "${id}" not found.`);
  const active = await getActiveVersion<AgentConfigContent>(env, 'agent', id);
  if (!active) throw new HttpError(404, `Active version for agent "${id}" not found.`);
  return { ...meta, activeVersion: active };
}

export async function listVersions(
  env: Env,
  kind: ConfigEntityKind,
  id: string,
): Promise<VersionMeta[]> {
  await ensureReady(env);
  if (!env.CONFIG_KV) {
    return [
      {
        versionId: 'builtin-v1',
        versionNumber: 1,
        createdAt: new Date(0).toISOString(),
        label: 'v1 (built-in)',
        changelog: 'Read-only built-in default.',
      },
    ];
  }
  const meta = await getEntityMeta(env, kind, id);
  if (!meta) throw new HttpError(404, `${kind} "${id}" not found.`);
  return listVersionMetas(env, kind, id);
}

export async function getVersionDetail<TContent>(
  env: Env,
  kind: ConfigEntityKind,
  id: string,
  versionId: string,
): Promise<VersionRecord<TContent>> {
  await ensureReady(env);
  if (!env.CONFIG_KV || versionId === 'builtin-v1') {
    if (kind === 'skill') {
      const d = await getSkillDetail(env, id);
      return d.activeVersion as VersionRecord<TContent>;
    }
    if (kind === 'tool') {
      const d = await getToolDetail(env, id);
      return d.activeVersion as VersionRecord<TContent>;
    }
    const d = await getAgentDetail(env, id);
    return d.activeVersion as VersionRecord<TContent>;
  }
  const version = await getVersion<TContent>(env, kind, id, versionId);
  if (!version) throw new HttpError(404, `Version "${versionId}" not found.`);
  return version;
}

export async function saveSkillVersion(
  env: Env,
  id: string,
  input: CreateVersionInput<SkillConfigContent>,
): Promise<VersionRecord<SkillConfigContent>> {
  await ensureReady(env);
  return createVersion(env, 'skill', id, input);
}

export async function saveToolVersion(
  env: Env,
  id: string,
  input: CreateVersionInput<ToolConfigContent>,
): Promise<VersionRecord<ToolConfigContent>> {
  await ensureReady(env);
  return createVersion(env, 'tool', id, input);
}

export async function saveAgentVersion(
  env: Env,
  id: string,
  input: CreateVersionInput<AgentConfigContent>,
): Promise<VersionRecord<AgentConfigContent>> {
  await ensureReady(env);
  return createVersion(env, 'agent', id, input);
}

export async function activateSkillVersion(
  env: Env,
  id: string,
  versionId: string,
): Promise<EntityMeta> {
  await ensureReady(env);
  return setActiveVersion(env, 'skill', id, versionId);
}

export async function activateToolVersion(
  env: Env,
  id: string,
  versionId: string,
): Promise<EntityMeta> {
  await ensureReady(env);
  return setActiveVersion(env, 'tool', id, versionId);
}

export async function activateAgentVersion(
  env: Env,
  id: string,
  versionId: string,
): Promise<EntityMeta> {
  await ensureReady(env);
  return setActiveVersion(env, 'agent', id, versionId);
}

export async function getActiveAgent(env: Env): Promise<{
  pointer: ActiveAgentPointer;
  agent: EntityDetail<AgentConfigContent>;
}> {
  await ensureReady(env);
  const pointer =
    (env.CONFIG_KV ? await getActiveAgentPointer(env) : null) ?? {
      agentId: DEFAULT_AGENT_ID,
      versionId: 'builtin-v1',
      updatedAt: new Date(0).toISOString(),
      updatedBy: 'system',
    };
  const agent = await getAgentDetail(env, pointer.agentId);
  return { pointer, agent };
}

export async function setActiveAgent(
  env: Env,
  agentId: string,
  versionId: string,
  updatedBy?: string,
): Promise<ActiveAgentPointer> {
  await ensureReady(env);
  const meta = await setActiveVersion(env, 'agent', agentId, versionId);
  return setActiveAgentPointer(env, {
    agentId,
    versionId: meta.activeVersionId,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });
}

export async function deleteConfigEntity(
  env: Env,
  kind: ConfigEntityKind,
  id: string,
): Promise<{ deleted: boolean }> {
  if (!env.CONFIG_KV) {
    throw new HttpError(
      503,
      'Configuration storage is not available. Bind CONFIG_KV to delete entities. Built-in code defaults cannot be deleted.',
    );
  }
  await ensureReady(env);
  const deleted = await deleteEntity(env, kind, id);
  if (!deleted) throw new HttpError(404, `${kind} "${id}" not found.`);
  return { deleted: true };
}

/**
 * Drop every stored config entity and re-seed from the current code defaults.
 * This is the clean way to remove stale skill IDs after a refactor.
 */
export async function resetConfig(env: Env): Promise<{ reset: boolean; seeded: boolean }> {
  if (!env.CONFIG_KV) {
    throw new HttpError(
      503,
      'Configuration storage is not available. Bind CONFIG_KV to reset configuration.',
    );
  }
  await clearStore(env);
  const { seeded } = await seedDefaults(env);
  return { reset: true, seeded };
}

export { seedDefaults, ensureReady };

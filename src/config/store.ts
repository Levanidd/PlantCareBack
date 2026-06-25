/**
 * Generic versioned KV store for config entities (skills, tools, agents).
 */
import { HttpError } from '../errors';
import type { Env } from '../types';
import type {
  ActiveAgentPointer,
  ConfigEntityKind,
  CreateVersionInput,
  EntityMeta,
  VersionMeta,
  VersionRecord,
} from './types';

const MAX_VERSIONS = 50;

function requireKv(env: Env): KVNamespace {
  if (!env.CONFIG_KV) {
    throw new HttpError(
      503,
      'Configuration storage is not available. Bind CONFIG_KV to enable editing.',
    );
  }
  return env.CONFIG_KV;
}

function indexKey(kind: ConfigEntityKind): string {
  return `config:${kind}:index`;
}

function metaKey(kind: ConfigEntityKind, id: string): string {
  return `config:${kind}:${id}:meta`;
}

function versionsIndexKey(kind: ConfigEntityKind, id: string): string {
  return `config:${kind}:${id}:versions:index`;
}

function versionKey(kind: ConfigEntityKind, id: string, versionId: string): string {
  return `config:${kind}:${id}:version:${versionId}`;
}

const ACTIVE_AGENT_KEY = 'config:agent:active';

function createVersionId(): string {
  return crypto.randomUUID();
}

export async function listEntityIds(env: Env, kind: ConfigEntityKind): Promise<string[]> {
  const kv = requireKv(env);
  return (await kv.get<string[]>(indexKey(kind), 'json')) ?? [];
}

export async function getEntityMeta(
  env: Env,
  kind: ConfigEntityKind,
  id: string,
): Promise<EntityMeta | null> {
  const kv = requireKv(env);
  return kv.get<EntityMeta>(metaKey(kind, id), 'json');
}

export async function listVersionMetas(
  env: Env,
  kind: ConfigEntityKind,
  id: string,
): Promise<VersionMeta[]> {
  const kv = requireKv(env);
  return (await kv.get<VersionMeta[]>(versionsIndexKey(kind, id), 'json')) ?? [];
}

export async function getVersion<TContent>(
  env: Env,
  kind: ConfigEntityKind,
  id: string,
  versionId: string,
): Promise<VersionRecord<TContent> | null> {
  const kv = requireKv(env);
  return kv.get<VersionRecord<TContent>>(versionKey(kind, id, versionId), 'json');
}

export async function getActiveVersion<TContent>(
  env: Env,
  kind: ConfigEntityKind,
  id: string,
): Promise<VersionRecord<TContent> | null> {
  const meta = await getEntityMeta(env, kind, id);
  if (!meta) return null;
  return getVersion<TContent>(env, kind, id, meta.activeVersionId);
}

export async function putEntity<TContent>(
  env: Env,
  kind: ConfigEntityKind,
  meta: EntityMeta,
  version: VersionRecord<TContent>,
  allVersions: VersionMeta[],
  entityIds: string[],
): Promise<void> {
  const kv = requireKv(env);
  await kv.put(metaKey(kind, meta.id), JSON.stringify(meta));
  await kv.put(versionKey(kind, meta.id, version.versionId), JSON.stringify(version));
  await kv.put(versionsIndexKey(kind, meta.id), JSON.stringify(allVersions));
  if (!entityIds.includes(meta.id)) {
    entityIds.push(meta.id);
    await kv.put(indexKey(kind), JSON.stringify(entityIds));
  }
}

export async function createVersion<TContent>(
  env: Env,
  kind: ConfigEntityKind,
  entityId: string,
  input: CreateVersionInput<TContent>,
): Promise<VersionRecord<TContent>> {
  const kv = requireKv(env);
  const meta = await getEntityMeta(env, kind, entityId);
  if (!meta) throw new HttpError(404, `${kind} "${entityId}" not found.`);

  const versionId = createVersionId();
  const versionNumber = meta.latestVersionNumber + 1;
  const now = new Date().toISOString();

  const version: VersionRecord<TContent> = {
    versionId,
    versionNumber,
    createdAt: now,
    createdBy: input.createdBy,
    changelog: input.changelog,
    label: input.label ?? `v${versionNumber}`,
    content: input.content,
  };

  const versions = await listVersionMetas(env, kind, entityId);
  const nextVersions = [version, ...versions].slice(0, MAX_VERSIONS);

  const updatedMeta: EntityMeta = {
    ...meta,
    latestVersionNumber: versionNumber,
    updatedAt: now,
    activeVersionId: input.setActive !== false ? versionId : meta.activeVersionId,
  };

  if (input.setActive !== false) {
    updatedMeta.activeVersionId = versionId;
  }

  const ids = await listEntityIds(env, kind);
  await putEntity(env, kind, updatedMeta, version, nextVersions, ids);

  // Trim old version blobs (best-effort).
  for (const old of versions.slice(MAX_VERSIONS - 1)) {
    if (old.versionId !== updatedMeta.activeVersionId) {
      await kv.delete(versionKey(kind, entityId, old.versionId));
    }
  }

  return version;
}

export async function setActiveVersion(
  env: Env,
  kind: ConfigEntityKind,
  entityId: string,
  versionId: string,
): Promise<EntityMeta> {
  const kv = requireKv(env);
  const meta = await getEntityMeta(env, kind, entityId);
  if (!meta) throw new HttpError(404, `${kind} "${entityId}" not found.`);

  const version = await getVersion(env, kind, entityId, versionId);
  if (!version) throw new HttpError(404, `Version "${versionId}" not found.`);

  const updated: EntityMeta = {
    ...meta,
    activeVersionId: versionId,
    updatedAt: new Date().toISOString(),
  };
  await kv.put(metaKey(kind, entityId), JSON.stringify(updated));
  return updated;
}

export async function getActiveAgentPointer(env: Env): Promise<ActiveAgentPointer | null> {
  if (!env.CONFIG_KV) return null;
  return env.CONFIG_KV.get<ActiveAgentPointer>(ACTIVE_AGENT_KEY, 'json');
}

export async function setActiveAgentPointer(
  env: Env,
  pointer: ActiveAgentPointer,
): Promise<ActiveAgentPointer> {
  const kv = requireKv(env);
  await kv.put(ACTIVE_AGENT_KEY, JSON.stringify(pointer));
  return pointer;
}

export async function isStoreEmpty(env: Env): Promise<boolean> {
  if (!env.CONFIG_KV) return true;
  const skills = await env.CONFIG_KV.get(indexKey('skill'), 'json');
  return !skills;
}

/**
 * Permanently remove an entity, all of its version blobs, and its index entry.
 * Returns false if the entity does not exist.
 */
export async function deleteEntity(
  env: Env,
  kind: ConfigEntityKind,
  id: string,
): Promise<boolean> {
  const kv = requireKv(env);
  const meta = await getEntityMeta(env, kind, id);
  const versions = await listVersionMetas(env, kind, id);
  const existedInIndex = (await listEntityIds(env, kind)).includes(id);
  if (!meta && versions.length === 0 && !existedInIndex) return false;

  for (const v of versions) {
    await kv.delete(versionKey(kind, id, v.versionId));
  }
  await kv.delete(versionsIndexKey(kind, id));
  await kv.delete(metaKey(kind, id));

  const ids = (await listEntityIds(env, kind)).filter((x) => x !== id);
  await kv.put(indexKey(kind), JSON.stringify(ids));

  if (kind === 'agent') {
    const pointer = await getActiveAgentPointer(env);
    if (pointer?.agentId === id) {
      await kv.delete(ACTIVE_AGENT_KEY);
    }
  }
  return true;
}

/**
 * Wipe every config entity (skills, tools, agents) plus the active-agent
 * pointer. Used by reset/reseed flows.
 */
export async function clearStore(env: Env): Promise<void> {
  const kv = requireKv(env);
  for (const kind of ['skill', 'tool', 'agent'] as const) {
    const ids = await listEntityIds(env, kind);
    for (const id of ids) {
      await deleteEntity(env, kind, id);
    }
    await kv.delete(indexKey(kind));
  }
  await kv.delete(ACTIVE_AGENT_KEY);
}

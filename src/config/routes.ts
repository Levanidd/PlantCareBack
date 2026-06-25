/**
 * HTTP routes for versioned skills / tools / agents configuration.
 */
import { HttpError } from '../errors';
import type { Env } from '../types';
import {
  activateAgentVersion,
  activateSkillVersion,
  activateToolVersion,
  getActiveAgent,
  getAgentDetail,
  getCatalog,
  getSkillDetail,
  getToolDetail,
  getVersionDetail,
  listVersions,
  saveAgentVersion,
  saveSkillVersion,
  saveToolVersion,
  seedDefaults,
  setActiveAgent,
} from './service';
import type {
  AgentConfigContent,
  ConfigEntityKind,
  CreateVersionInput,
  SkillConfigContent,
  ToolConfigContent,
} from './types';

type JsonFn = (data: unknown, status: number) => Response;
type ErrFn = (message: string, status: number) => Response;

function parseJson<T>(raw: unknown): T {
  if (!raw || typeof raw !== 'object') {
    throw new HttpError(400, 'Expected a JSON object body.');
  }
  return raw as T;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

function sessionIdOptional(request: Request): string | undefined {
  return request.headers.get('X-Session-Id')?.trim() || undefined;
}

const KIND_SEGMENT: Record<string, ConfigEntityKind> = {
  skills: 'skill',
  tools: 'tool',
  agents: 'agent',
};

export async function handleConfigRoute(
  env: Env,
  request: Request,
  path: string,
  json: JsonFn,
  error: ErrFn,
): Promise<Response | null> {
  // POST /config/seed
  if (path === '/config/seed' && request.method === 'POST') {
    const result = await seedDefaults(env);
    return json({ ...result, message: result.seeded ? 'Defaults seeded.' : 'Already initialized.' }, 200);
  }

  // GET /config/catalog
  if (path === '/config/catalog' && request.method === 'GET') {
    return json(await getCatalog(env), 200);
  }

  // GET /config/agents/active
  if (path === '/config/agents/active' && request.method === 'GET') {
    return json(await getActiveAgent(env), 200);
  }

  // PUT /config/agents/active
  if (path === '/config/agents/active' && request.method === 'PUT') {
    const body = parseJson<{ agentId: string; versionId: string }>(await readJson(request));
    if (!body.agentId || !body.versionId) {
      return error('agentId and versionId are required.', 400);
    }
    const pointer = await setActiveAgent(env, body.agentId, body.versionId, sessionIdOptional(request));
    return json({ activeAgent: pointer }, 200);
  }

  // /config/{skills|tools|agents}
  const listMatch = /^\/config\/(skills|tools|agents)$/.exec(path);
  if (listMatch && request.method === 'GET') {
    const kind = KIND_SEGMENT[listMatch[1]];
    const catalog = await getCatalog(env);
    if (kind === 'skill') return json({ items: catalog.skills }, 200);
    if (kind === 'tool') return json({ items: catalog.tools }, 200);
    return json({ items: catalog.agents }, 200);
  }

  // /config/{kind}/:id
  const detailMatch = /^\/config\/(skills|tools|agents)\/([^/]+)$/.exec(path);
  if (detailMatch) {
    const kind = KIND_SEGMENT[detailMatch[1]];
    const id = decodeURIComponent(detailMatch[2]);

    if (request.method === 'GET') {
      if (kind === 'skill') return json(await getSkillDetail(env, id), 200);
      if (kind === 'tool') return json(await getToolDetail(env, id), 200);
      return json(await getAgentDetail(env, id), 200);
    }
    return error('Method not allowed.', 405);
  }

  // /config/{kind}/:id/versions
  const versionsMatch = /^\/config\/(skills|tools|agents)\/([^/]+)\/versions$/.exec(path);
  if (versionsMatch) {
    const kind = KIND_SEGMENT[versionsMatch[1]];
    const id = decodeURIComponent(versionsMatch[2]);

    if (request.method === 'GET') {
      const versions = await listVersions(env, kind, id);
      const meta =
        kind === 'skill'
          ? await getSkillDetail(env, id)
          : kind === 'tool'
            ? await getToolDetail(env, id)
            : await getAgentDetail(env, id);
      return json({ entityId: id, kind, activeVersionId: meta.activeVersionId, versions }, 200);
    }

    if (request.method === 'POST') {
      const body = parseJson<CreateVersionInput<unknown>>(await readJson(request));
      if (!body.content) return error('content is required.', 400);
      const input = { ...body, createdBy: sessionIdOptional(request) };

      if (kind === 'skill') {
        const version = await saveSkillVersion(env, id, input as CreateVersionInput<SkillConfigContent>);
        return json({ version }, 201);
      }
      if (kind === 'tool') {
        const version = await saveToolVersion(env, id, input as CreateVersionInput<ToolConfigContent>);
        return json({ version }, 201);
      }
      const version = await saveAgentVersion(env, id, input as CreateVersionInput<AgentConfigContent>);
      return json({ version }, 201);
    }
    return error('Method not allowed.', 405);
  }

  // /config/{kind}/:id/versions/:versionId
  const versionDetailMatch = /^\/config\/(skills|tools|agents)\/([^/]+)\/versions\/([^/]+)$/.exec(path);
  if (versionDetailMatch && request.method === 'GET') {
    const kind = KIND_SEGMENT[versionDetailMatch[1]];
    const id = decodeURIComponent(versionDetailMatch[2]);
    const versionId = decodeURIComponent(versionDetailMatch[3]);
    const version = await getVersionDetail(env, kind, id, versionId);
    return json({ version }, 200);
  }

  // PUT /config/{kind}/:id/active-version
  const activeMatch = /^\/config\/(skills|tools|agents)\/([^/]+)\/active-version$/.exec(path);
  if (activeMatch && request.method === 'PUT') {
    const kind = KIND_SEGMENT[activeMatch[1]];
    const id = decodeURIComponent(activeMatch[2]);
    const body = parseJson<{ versionId: string }>(await readJson(request));
    if (!body.versionId) return error('versionId is required.', 400);

    let meta;
    if (kind === 'skill') meta = await activateSkillVersion(env, id, body.versionId);
    else if (kind === 'tool') meta = await activateToolVersion(env, id, body.versionId);
    else meta = await activateAgentVersion(env, id, body.versionId);

    return json({ entity: meta }, 200);
  }

  return null;
}

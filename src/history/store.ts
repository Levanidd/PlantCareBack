/**
 * Persists and retrieves per-session analysis history via optional KV.
 */
import type { HistoryItemDetails, HistoryListItem, PlantCareResult } from '../types';
import type { Env } from '../types';

const MAX_ITEMS = 50;
const INDEX_SUFFIX = ':index';

function indexKey(sessionId: string): string {
  return `history:${sessionId}${INDEX_SUFFIX}`;
}

function itemKey(sessionId: string, itemId: string): string {
  return `history:${sessionId}:${itemId}`;
}

function createId(): string {
  return crypto.randomUUID();
}

export async function saveHistoryItem(
  env: Env,
  sessionId: string,
  question: string,
  hasImage: boolean,
  response: PlantCareResult,
): Promise<string | null> {
  if (!env.HISTORY_KV) return null;

  const id = createId();
  const createdAt = new Date().toISOString();
  const plantName = response.identification?.commonName;
  const preview = response.summary.slice(0, 160);

  const listItem: HistoryListItem = {
    id,
    createdAt,
    question,
    hasImage,
    preview,
    plantName,
  };

  const details: HistoryItemDetails = { ...listItem, response };

  const idxKey = indexKey(sessionId);
  const existing = (await env.HISTORY_KV.get<HistoryListItem[]>(idxKey, 'json')) ?? [];
  const next = [listItem, ...existing].slice(0, MAX_ITEMS);

  await env.HISTORY_KV.put(itemKey(sessionId, id), JSON.stringify(details));
  await env.HISTORY_KV.put(idxKey, JSON.stringify(next));

  // Drop trimmed items from KV (best-effort).
  for (const old of existing.slice(MAX_ITEMS - 1)) {
    await env.HISTORY_KV.delete(itemKey(sessionId, old.id));
  }

  return id;
}

export async function listHistory(env: Env, sessionId: string): Promise<HistoryListItem[]> {
  if (!env.HISTORY_KV) return [];
  return (await env.HISTORY_KV.get<HistoryListItem[]>(indexKey(sessionId), 'json')) ?? [];
}

export async function getHistoryItem(
  env: Env,
  sessionId: string,
  itemId: string,
): Promise<HistoryItemDetails | null> {
  if (!env.HISTORY_KV) return null;
  return env.HISTORY_KV.get<HistoryItemDetails>(itemKey(sessionId, itemId), 'json');
}

export async function deleteHistoryItem(
  env: Env,
  sessionId: string,
  itemId: string,
): Promise<boolean> {
  if (!env.HISTORY_KV) return false;
  const idxKey = indexKey(sessionId);
  const existing = (await env.HISTORY_KV.get<HistoryListItem[]>(idxKey, 'json')) ?? [];
  const next = existing.filter((i) => i.id !== itemId);
  if (next.length === existing.length) return false;
  await env.HISTORY_KV.put(idxKey, JSON.stringify(next));
  await env.HISTORY_KV.delete(itemKey(sessionId, itemId));
  return true;
}

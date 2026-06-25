/**
 * Versioned configuration types for skills, tools, and agents.
 */
import type { SkillId } from '../skills/types';

export type ConfigEntityKind = 'skill' | 'tool' | 'agent';

export interface VersionMeta {
  versionId: string;
  versionNumber: number;
  createdAt: string;
  createdBy?: string;
  changelog?: string;
  label?: string;
}

export interface VersionRecord<TContent> extends VersionMeta {
  content: TContent;
}

export interface EntityMeta {
  id: string;
  kind: ConfigEntityKind;
  name: string;
  description?: string;
  activeVersionId: string;
  latestVersionNumber: number;
  createdAt: string;
  updatedAt: string;
  builtIn: boolean;
}

/** Editable skill payload (prompts/schemas). Runtime wiring stays in code. */
export interface SkillConfigContent {
  systemPrompt: string;
  responseSchema: Record<string, unknown>;
  /** Appended to the user message after base context. */
  userMessageSuffix?: string;
  mvp: boolean;
  usesImage: boolean;
}

export type ToolKind = 'llm' | 'builtin';

/** Auxiliary tool the agent may invoke or reference. */
export interface ToolConfigContent {
  description: string;
  kind: ToolKind;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  /** For kind=llm — system prompt. */
  systemPrompt?: string;
  /** For kind=builtin — handler key implemented in code. */
  builtinId?: string;
}

/** Agent orchestration profile. */
export interface AgentConfigContent {
  description?: string;
  model?: string;
  temperature?: number;
  defaultLanguage?: string;
  /** Skills exposed to intent detection. */
  availableSkillIds: SkillId[];
  /** Tools available to the agent pipeline. */
  toolIds: string[];
  /** Always executed first / last regardless of intent. */
  pipeline: {
    intentSkillId: SkillId;
    composerSkillId: SkillId;
    alwaysAfterIntent: SkillId[];
  };
}

export interface EntitySummary extends EntityMeta {
  activeVersion: VersionMeta;
}

export interface EntityDetail<TContent> extends EntityMeta {
  activeVersion: VersionRecord<TContent>;
}

export interface ActiveAgentPointer {
  agentId: string;
  versionId: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface CreateVersionInput<TContent> {
  content: TContent;
  changelog?: string;
  label?: string;
  setActive?: boolean;
  createdBy?: string;
}

export interface CatalogResponse {
  skills: EntitySummary[];
  tools: EntitySummary[];
  agents: EntitySummary[];
  activeAgent: ActiveAgentPointer | null;
}

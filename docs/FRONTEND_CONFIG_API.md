# Plant Care Agent — Frontend Config API Specification

Version: **1.0**  
Base URL: same as backend (`VITE_API_BASE_URL`, e.g. `https://plantcareback.kurdyukov-leo-ger.workers.dev`)  
Prefix: all config routes work with and without `/api` prefix (`/config/...` ≡ `/api/config/...`).

---

## 1. Purpose

The config API lets the frontend:

1. **Read** all skills, tools, and agents with their **active version** content.
2. **Edit** prompts, schemas, and orchestration settings.
3. **Save** changes as **new versions** (immutable history).
4. **Activate** any previous version for runtime (`/analyze` uses active versions).
5. **Select** which agent profile runs in production.

Without `CONFIG_KV` bound on the Worker:

- `GET` endpoints return **read-only built-in defaults** (`versionId: "builtin-v1"`).
- `POST` / `PUT` return `503` — editing disabled until KV is configured.

---

## 2. Common conventions

### Headers (all config requests)

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | POST, PUT | `application/json` |
| `X-Session-Id` | Recommended | Anonymous session UUID — stored as `createdBy` / `updatedBy` on versions |

Same **Origin allow-list** as `/analyze` applies.

### Errors

Non-2xx responses:

```json
{ "message": "human-readable error" }
```

| Status | Meaning |
|--------|---------|
| 400 | Invalid body / missing fields |
| 403 | Origin not allowed |
| 404 | Entity or version not found |
| 405 | Method not allowed |
| 503 | `CONFIG_KV` not bound (write operations) |

### Versioning model

```
Entity (skill | tool | agent)
  ├── meta: id, name, activeVersionId, latestVersionNumber, builtIn
  └── versions[]: immutable snapshots
        ├── v3 (active)  ← /analyze uses this
        ├── v2
        └── v1 (built-in seed)
```

- **Saving** always creates a **new version** (`POST .../versions`).
- By default the new version becomes **active** (`setActive: true`, default).
- **Activating** an old version does not delete newer ones (`PUT .../active-version`).

---

## 3. Entity types & editable content

### 3.1 Skill (`kind: "skill"`)

Runtime LLM skill used by the agent pipeline.

```typescript
interface SkillConfigContent {
  systemPrompt: string;           // English instructions (user output language set by agent)
  responseSchema: object;         // Gemini JSON schema (OpenAPI subset)
  userMessageSuffix?: string;     // Extra text appended to user message
  mvp: boolean;
  usesImage: boolean;
}
```

Built-in skill IDs (14):  
`intent-detection`, `plant-identification`, `plant-care-guide`, `new-plant-onboarding`,  
`existing-plant-health-check`, `watering`, `light-placement`, `repotting`, `fertilizing`,  
`disease-pest-diagnosis`, `seasonal-care`, `toxicity-safety`, `follow-up-questions`,  
`frontend-response-composer`.

### 3.2 Tool (`kind: "tool"`)

Auxiliary capability referenced by the agent (LLM or built-in).

```typescript
interface ToolConfigContent {
  description: string;
  kind: "llm" | "builtin";
  inputSchema: object;
  outputSchema?: object;
  systemPrompt?: string;   // required when kind = "llm"
  builtinId?: string;      // required when kind = "builtin"
}
```

Built-in tool IDs: `image-quality-check`, `plant-name-normalizer`, `urgency-scorer`.

### 3.3 Agent (`kind: "agent"`)

Orchestration profile — which skills/tools are available and pipeline wiring.

```typescript
interface AgentConfigContent {
  description?: string;
  model?: string;
  temperature?: number;
  defaultLanguage?: string;       // e.g. "ru"
  availableSkillIds: string[];    // skills intent detection may choose
  toolIds: string[];
  pipeline: {
    intentSkillId: string;          // usually "intent-detection"
    composerSkillId: string;        // usually "frontend-response-composer"
    alwaysAfterIntent: string[];
  };
}
```

Default agent ID: `plant-care-agent`.

---

## 4. API endpoints

### 4.1 Catalog (admin dashboard entry point)

#### `GET /config/catalog`

Returns everything needed to render the config UI home screen.

**Response 200:**

```json
{
  "skills": [ EntitySummary ],
  "tools": [ EntitySummary ],
  "agents": [ EntitySummary ],
  "activeAgent": {
    "agentId": "plant-care-agent",
    "versionId": "uuid",
    "updatedAt": "2026-06-26T...",
    "updatedBy": "session-uuid"
  }
}
```

```typescript
interface EntitySummary {
  id: string;
  kind: "skill" | "tool" | "agent";
  name: string;
  description?: string;
  activeVersionId: string;
  latestVersionNumber: number;
  createdAt: string;
  updatedAt: string;
  builtIn: boolean;
  activeVersion: {
    versionId: string;
    versionNumber: number;
    createdAt: string;
    label?: string;
    changelog?: string;
  };
}
```

---

### 4.2 Skills

| Method | Path | Description |
|--------|------|-------------|
| GET | `/config/skills` | List all skills |
| GET | `/config/skills/:id` | Skill detail + **active version content** |
| GET | `/config/skills/:id/versions` | Version history |
| GET | `/config/skills/:id/versions/:versionId` | Specific version (read-only) |
| POST | `/config/skills/:id/versions` | **Save new version** |
| PUT | `/config/skills/:id/active-version` | **Activate existing version** |

#### `GET /config/skills/:id` — response

```json
{
  "id": "plant-identification",
  "kind": "skill",
  "name": "Plant Identification Skill",
  "description": "Identifies plant from photo or description.",
  "activeVersionId": "abc-123",
  "latestVersionNumber": 2,
  "builtIn": true,
  "activeVersion": {
    "versionId": "abc-123",
    "versionNumber": 2,
    "label": "v2",
    "changelog": "Improved low-confidence handling",
    "createdAt": "...",
    "createdBy": "session-uuid",
    "content": {
      "systemPrompt": "...",
      "responseSchema": { "type": "OBJECT", "properties": {} },
      "userMessageSuffix": "",
      "mvp": true,
      "usesImage": true
    }
  }
}
```

#### `POST /config/skills/:id/versions` — request

```json
{
  "content": {
    "systemPrompt": "...",
    "responseSchema": { "type": "OBJECT", "properties": {} },
    "userMessageSuffix": "Optional extra user message suffix.",
    "mvp": true,
    "usesImage": true
  },
  "changelog": "What changed in this version",
  "label": "v3",
  "setActive": true
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `content` | yes | — | Full skill config snapshot |
| `changelog` | no | — | Shown in version history UI |
| `label` | no | `v{N}` | Display name in version picker |
| `setActive` | no | `true` | If `true`, new version runs on next `/analyze` |

**Response 201:**

```json
{ "version": VersionRecord }
```

#### `PUT /config/skills/:id/active-version` — request

```json
{ "versionId": "previous-version-uuid" }
```

**Response 200:**

```json
{ "entity": EntityMeta }
```

#### `GET /config/skills/:id/versions` — response

```json
{
  "entityId": "plant-identification",
  "kind": "skill",
  "activeVersionId": "abc-123",
  "versions": [
    { "versionId": "abc-123", "versionNumber": 2, "label": "v2", "createdAt": "...", "changelog": "..." },
    { "versionId": "def-456", "versionNumber": 1, "label": "v1 (built-in)", "createdAt": "..." }
  ]
}
```

---

### 4.3 Tools

Same pattern as skills, under `/config/tools/...`.

| Method | Path |
|--------|------|
| GET | `/config/tools` |
| GET | `/config/tools/:id` |
| GET | `/config/tools/:id/versions` |
| GET | `/config/tools/:id/versions/:versionId` |
| POST | `/config/tools/:id/versions` |
| PUT | `/config/tools/:id/active-version` |

**POST body example:**

```json
{
  "content": {
    "description": "Assess photo quality",
    "kind": "llm",
    "inputSchema": { "type": "OBJECT", "properties": {} },
    "outputSchema": { "type": "OBJECT", "properties": {} },
    "systemPrompt": "You assess plant photo quality..."
  },
  "changelog": "Stricter blur detection",
  "setActive": true
}
```

---

### 4.4 Agents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/config/agents` | List agents |
| GET | `/config/agents/:id` | Agent detail + active version |
| GET | `/config/agents/active` | **Currently running agent** (pointer + full config) |
| PUT | `/config/agents/active` | **Set active agent + version for /analyze** |
| GET | `/config/agents/:id/versions` | Version history |
| GET | `/config/agents/:id/versions/:versionId` | Specific version |
| POST | `/config/agents/:id/versions` | Save new agent config version |
| PUT | `/config/agents/:id/active-version` | Activate version (without changing global pointer) |

#### `GET /config/agents/active` — response

```json
{
  "pointer": {
    "agentId": "plant-care-agent",
    "versionId": "uuid",
    "updatedAt": "...",
    "updatedBy": "session-uuid"
  },
  "agent": { /* EntityDetail<AgentConfigContent> */ }
}
```

#### `PUT /config/agents/active` — request

Selects which agent + version handles all `/analyze` requests.

```json
{
  "agentId": "plant-care-agent",
  "versionId": "version-uuid"
}
```

**Response 200:**

```json
{
  "activeAgent": {
    "agentId": "plant-care-agent",
    "versionId": "version-uuid",
    "updatedAt": "...",
    "updatedBy": "session-uuid"
  }
}
```

#### `POST /config/agents/:id/versions` — request example

```json
{
  "content": {
    "description": "Stricter diagnosis pipeline",
    "defaultLanguage": "ru",
    "availableSkillIds": [
      "plant-identification",
      "plant-care-guide",
      "disease-pest-diagnosis",
      "toxicity-safety"
    ],
    "toolIds": ["image-quality-check", "urgency-scorer"],
    "pipeline": {
      "intentSkillId": "intent-detection",
      "composerSkillId": "frontend-response-composer",
      "alwaysAfterIntent": []
    }
  },
  "changelog": "Reduced skill set for faster responses",
  "setActive": true
}
```

---

### 4.5 Bootstrap

#### `POST /config/seed`

Idempotent — seeds built-in skills, tools, and default agent into `CONFIG_KV` if empty.

**Response 200:**

```json
{ "seeded": true, "message": "Defaults seeded." }
```

or `{ "seeded": false, "message": "Already initialized." }`

Called automatically on first `GET /config/catalog` when KV is bound.

---

## 5. Frontend UI flows

### 5.1 Config home (`/admin` or `/settings/agent`)

```
1. GET /config/catalog
2. Render three tabs: Skills | Tools | Agents
3. Each row: name, description, active version label, updatedAt
4. Highlight activeAgent from catalog.activeAgent
```

### 5.2 Skill editor

```
1. GET /config/skills/:id          → load active content into form
2. GET /config/skills/:id/versions → populate version sidebar
3. User edits systemPrompt, responseSchema (JSON editor), flags
4. "Save" → POST /config/skills/:id/versions
5. "Preview version" → GET /config/skills/:id/versions/:versionId
6. "Use this version" → PUT /config/skills/:id/active-version
```

**Form fields:**

| Field | UI component |
|-------|----------------|
| `systemPrompt` | Multiline textarea (monospace) |
| `responseSchema` | JSON editor with validation |
| `userMessageSuffix` | Optional textarea |
| `mvp`, `usesImage` | Toggles |
| `changelog` | Text input on save dialog |
| `label` | Text input on save dialog |
| `setActive` | Checkbox "Apply immediately" (default on) |

### 5.3 Version history sidebar (shared component)

```
Props: entityKind, entityId

1. GET /config/{kind}s/:id/versions
2. List versions newest-first
3. Badge on activeVersionId
4. Click version → GET .../versions/:versionId → read-only diff view
5. "Restore" button → PUT .../active-version
```

### 5.4 Agent selector (production control)

```
1. GET /config/agents/active → show current
2. GET /config/agents/:id/versions → version dropdown
3. On confirm → PUT /config/agents/active { agentId, versionId }
4. Toast: "Agent v3 is now live"
```

### 5.5 Test after edit

After saving + activating, run a normal analyze request:

```
POST /analyze
{ "question": "test", "image": null }
```

The pipeline uses **active versions** from KV for every skill in the chain.

---

## 6. TypeScript client sketch

```typescript
const BASE = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
const headers = () => ({
  'Content-Type': 'application/json',
  'X-Session-Id': getSessionId(),
});

// Catalog
export const fetchCatalog = () =>
  fetch(`${BASE}/config/catalog`, { headers: headers() }).then(r => r.json());

// Skill CRUD
export const fetchSkill = (id: string) =>
  fetch(`${BASE}/config/skills/${id}`, { headers: headers() }).then(r => r.json());

export const saveSkillVersion = (id: string, body: SaveVersionBody<SkillConfigContent>) =>
  fetch(`${BASE}/config/skills/${id}/versions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  }).then(r => r.json());

export const activateSkillVersion = (id: string, versionId: string) =>
  fetch(`${BASE}/config/skills/${id}/active-version`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ versionId }),
  }).then(r => r.json());

// Agent selection
export const setActiveAgent = (agentId: string, versionId: string) =>
  fetch(`${BASE}/config/agents/active`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ agentId, versionId }),
  }).then(r => r.json());
```

---

## 7. Runtime behaviour (/analyze)

When a user sends `POST /analyze`:

1. Backend reads `GET /config/agents/active` equivalent from KV.
2. Runs `pipeline.intentSkillId` using its **active skill version** (prompt + schema from KV).
3. Intent selects skills ⊆ `availableSkillIds`.
4. Each skill loads **its active version** from KV (falls back to code if KV missing).
5. Composer merges results using **its active version**.
6. Returns `AgentResponse` to frontend.

**Important:** editing a skill does not affect live traffic until:
- a new version is saved with `setActive: true`, or
- an existing version is activated via `PUT .../active-version`.

---

## 8. Infrastructure

Add to `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  { "binding": "CONFIG_KV", "id": "<your-config-kv-namespace-id>" }
]
```

Create namespace:

```bash
npx wrangler kv namespace create CONFIG_KV
npx wrangler kv namespace create CONFIG_KV --preview  # for local dev
```

---

## 9. Suggested frontend routes

| Route | Purpose |
|-------|---------|
| `/settings/agent` | Agent list + active agent badge |
| `/settings/agent/:agentId` | Agent editor + version history |
| `/settings/skills` | Skills list |
| `/settings/skills/:skillId` | Skill prompt/schema editor |
| `/settings/tools` | Tools list |
| `/settings/tools/:toolId` | Tool editor |

---

## 10. Checklist for frontend acceptance

- [ ] `GET /config/catalog` renders skills, tools, agents
- [ ] Skill editor loads active `systemPrompt` + `responseSchema`
- [ ] Save creates new version and updates list
- [ ] Version picker shows history; restore activates old version
- [ ] Agent selector changes live `/analyze` behaviour
- [ ] Read-only mode when API returns `builtin-v1` (no KV)
- [ ] `503` on save shows "Configuration storage not enabled"
- [ ] `responseSchema` JSON validated client-side before POST

---

## 11. Related APIs

| API | Doc |
|-----|-----|
| Plant analysis | `POST /analyze` → `AgentResponse` |
| Session history | `GET /history`, `GET /history/:id`, `DELETE /history/:id` |
| Health | `GET /health` |

See `README.md` for analysis response shape (`AgentResponse` sections).

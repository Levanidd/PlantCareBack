# Plant Care Agent — Backend

Cloudflare Worker backend for the Plant Care Agent. A **skills-based agent** analyzes plant questions and/or photos via Gemini (server-side only) and returns structured frontend-ready sections.

## Architecture

```
POST /analyze
    │
    ▼
Intent Detection Skill          (always — picks which skills to run)
    │
    ├─ Plant Identification     (if photo / unknown plant)
    ├─ Care Expert              (general care: watering, light, soil, repotting, season, onboarding…)
    ├─ Diagnosis & Safety       (problems/pests + pet/child toxicity)
    ├─ Follow-up Questions      (if ambiguous / low confidence)
    │      (the experts above run in parallel)
    ▼
Frontend Response Composer      (merges skill outputs → PlantCareResult)
    │
    ▼
History Skill                   (optional — saves to HISTORY_KV)
```

Each skill lives in its own folder under `src/skills/` with an **English prompt** and JSON schema. Prompts are never exposed to the client. To keep latency and cost down, the previous granular content skills were consolidated into two multimodal "experts".

### Skills (7)

| Skill | Folder | MVP |
|-------|--------|-----|
| Intent Detection | `intent-detection/` | ✓ |
| Plant Identification | `plant-identification/` | ✓ |
| Care Expert | `care-expert/` | ✓ |
| Diagnosis & Safety | `diagnosis-safety/` | ✓ |
| Follow-up Questions | `follow-up-questions/` | |
| Frontend Response Composer | `frontend-response-composer/` | ✓ |
| History | `history/store.ts` (KV, no LLM) | ✓ |

**Gemini calls per `/analyze`:** typically **3** (intent + care-expert + composer); **4–5** with identification and/or diagnosis. The `care-expert` and `diagnosis-safety` experts run in parallel.

## API

### `POST /analyze`

Headers: `Content-Type: application/json`, `X-Session-Id` (required).

Body: `{ "question": "...", "image": null | { name, mimeType, size, dataUrl } }`

Success `200` → `PlantCareResult`: `summary` (string, required), `confidence`, `warnings`, `identification`, `careProfile`, `diagnosis`, `wateringPlan`, `actionPlan`, `followUps`. Only `summary` is guaranteed.

### History (requires `HISTORY_KV` binding)

| Method | Path | Response |
|--------|------|----------|
| GET | `/history` | `{ historyList: [...] }` |
| GET | `/history/:id` | `{ historyItemDetails: {...} }` |
| DELETE | `/history/:id` | `{ deleteStatus: "ok" }` |

Without KV, analyze still works; history endpoints return empty / 404 on delete.

### `GET /health` → `{ "ok": true }`

## Configuration

| Name | Type | Purpose |
|------|------|---------|
| `GEMINI_API_KEY` | secret | Required |
| `GEMINI_MODEL` | var | Default `gemini-2.5-flash` |
| `ALLOWED_ORIGINS` | var | CORS + server-side origin gate |
| `DEFAULT_LANGUAGE` | var | Fallback when language can't be inferred |
| `HISTORY_KV` | KV binding | Session history storage |
| `RATE_LIMIT_KV` | KV binding | Durable rate limiting |

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # add GEMINI_API_KEY
npm run dev
```

## Deploy

```bash
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

## Project layout

```
src/
  agent/orchestrator.ts     Skills pipeline
  gemini/client.ts          Low-level Gemini API
  history/store.ts          History Skill (KV)
  skills/
    intent-detection/       prompt.ts + schema.ts + skill.ts
    plant-identification/
    plant-care-guide/       index.ts (prompt + schema)
    …                         (one folder per skill)
    registry.ts             Skill registry
    runner.ts                 Execute one LLM skill
  index.ts                  HTTP router
  types.ts                  AgentResponse contract
```

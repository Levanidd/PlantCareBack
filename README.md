# Plant Care Agent — Backend

Cloudflare Worker backend for the Plant Care Agent. It accepts a plant question
and/or photo, calls **Gemini (multimodal)** server-side, and returns a strict,
structured `PlantCareResult` JSON. The frontend only renders the result — it
never calls Gemini and never generates plant-care content itself.

## Hard rules enforced here

- The Gemini API key lives only in a Worker **secret** (`GEMINI_API_KEY`) and is
  never returned to the client or written to logs.
- The model is forced to return structured JSON (`responseSchema`), then the
  output is re-sanitized into the exact `PlantCareResult` shape.
- When the model is unsure it returns `confidence: "low"` + `warnings` rather
  than invented data.
- The request `config` field is intentionally not supported yet — defaults
  (language, depth, audience) are decided by the backend.

## API

### `POST /analyze` (also `POST /api/analyze`)

Headers:

| Header         | Description                                  |
| -------------- | -------------------------------------------- |
| `Content-Type` | `application/json`                           |
| `X-Session-Id` | Anonymous session UUID (logging, rate limit) |

Body:

```json
{
  "question": "Why are the leaves yellow?",
  "image": {
    "name": "plant.jpg",
    "mimeType": "image/jpeg",
    "size": 184320,
    "dataUrl": "data:image/jpeg;base64,...."
  }
}
```

- `question` may be `""`; `image` may be `null`.
- `400 { "message": "Provide a question or an image." }` if both are empty.
- Accepted image types: `image/jpeg`, `image/png`, `image/webp`, `image/heic`.
- `413` if the decoded image exceeds `MAX_IMAGE_BYTES` (default 8 MB).

Success `200` → a [`PlantCareResult`](src/types.ts) where only `summary` is
guaranteed; other blocks appear only when relevant.

Errors (non-2xx) → `{ "message": "human-readable error" }`.

### `GET /health` (also `GET /api/health`)

→ `{ "ok": true }`

## Configuration

Set in `wrangler.jsonc` `vars` (non-secret) or via secrets:

| Name                       | Type   | Default            | Purpose                                  |
| -------------------------- | ------ | ------------------ | ---------------------------------------- |
| `GEMINI_API_KEY`           | secret | —                  | Gemini key (required)                    |
| `GEMINI_MODEL`             | var    | `gemini-2.5-flash` | Multimodal model                         |
| `ALLOWED_ORIGINS`          | var    | app origin         | Allowed origin(s); also a hard 403 gate  |
| `DEFAULT_LANGUAGE`         | var    | `ru`               | Reply language when it can't be inferred |
| `RATE_LIMIT_MAX`           | var    | `20`               | Requests per window per session/IP       |
| `RATE_LIMIT_WINDOW_SECONDS`| var    | `60`               | Rate-limit window                        |
| `MAX_IMAGE_BYTES`          | var    | `8388608`          | Max decoded image size                   |

`ALLOWED_ORIGINS` is enforced server-side, not just via CORS headers: any
`POST /analyze` whose `Origin` (or `Referer`) is not in the list is rejected with
`403`. This blocks browsers (CORS) **and** other clients. Default is
`https://plantcare.kurdyukov-leo-ger.workers.dev`. Set it to `*` to disable the
check. `/health` stays open.

Rate limiting uses an in-memory fallback by default. For durable, cross-isolate
limiting, bind a KV namespace named `RATE_LIMIT_KV` (see commented block in
`wrangler.jsonc`); the code picks it up automatically.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # then add your GEMINI_API_KEY
npm run dev                      # wrangler dev on http://localhost:8787
```

Quick checks:

```bash
curl http://localhost:8787/health

curl -X POST http://localhost:8787/analyze \
  -H 'Content-Type: application/json' \
  -H 'X-Session-Id: test-123' \
  -d '{"question":"How often should I water a monstera?","image":null}'
```

### Pointing the frontend at this Worker during dev

The frontend posts to `${VITE_API_BASE_URL}/analyze` (default `/api`). Run the
frontend's Vite proxy against this Worker:

```bash
# in the frontend project
DEV_API_TARGET=http://localhost:8787 npm run dev
```

## Deploy (Cloudflare)

```bash
npx wrangler secret put GEMINI_API_KEY   # paste your key
npm run deploy
```

Mount it so the frontend's `/api/*` calls reach it — either:

- deploy this Worker on the same zone with a route like `example.com/api/*`, or
- deploy it on its own domain and set the frontend's
  `VITE_API_BASE_URL=https://your-worker.example.com` (CORS already handled).

## Project layout

```
src/
  index.ts       Router, CORS, body limits, error handling
  validation.ts  Request parsing, image decoding & size checks
  gemini.ts      Gemini call, prompt, responseSchema
  sanitize.ts    Coerces model output into a strict PlantCareResult
  ratelimit.ts   KV-or-memory fixed-window limiter
  cors.ts        CORS headers / preflight
  types.ts       Shared contract types + Env
  errors.ts      HttpError
```

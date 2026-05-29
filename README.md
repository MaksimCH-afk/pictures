# ImageGen Dashboard

Developer tool: write a prompt, generate images from several AI models at once,
and compare the results side by side. Models are connected through OpenRouter.

Built with Next.js (App Router) + TypeScript, Prisma + SQLite, Tailwind CSS.

## Quick start (Docker)

```bash
cp .env.example .env          # then put your OpenRouter key in OPENROUTER_API_KEY
docker compose up --build
```

Open http://localhost:3000. The SQLite database and generated images are stored
in a named Docker volume (`imagegen-data`), so they survive restarts.

You can also set the API key later in the **Settings** tab instead of `.env`.

## Quick start (local, without Docker)

```bash
npm install
cp .env.example .env          # set DATABASE_URL="file:./data/imagegen.db" and DATA_DIR="./data"
npx prisma db push
npx tsx prisma/seed.ts        # optional: example models
npm run dev
```

## How it works

- **Models** are *adapters*. Each model stores a provider (`openrouter`), an
  OpenRouter model id, an accent color, and a JSON parameter schema. The
  dashboard renders each model's settings panel automatically from that schema —
  no per-model UI code. Add / disable / delete models in **Settings**.
- **Generate** creates a session, fans out one request per
  *prompt × model × batch* cell, and runs them in the background. The UI polls
  the session and shows per-model progress bars, then cards as each finishes.
- **A/B mode** sends multiple prompts to every model (grid of N×M).
- **Sync seed**, **batch size**, **presets** and **blind mode** are the
  generation parameters.
- **Results** gallery: rate with stars, pin the best (pinned cards float to the
  top with a colored border), expand, export single PNGs or the whole session
  as a ZIP (images + `metadata.json`).
- **Analytics**: per-model average rating, success rate, average latency and a
  latency sparkline.
- **History**: every prompt, reusable.

## REST / integration

Each session is reachable over REST — drive it without the UI:

```bash
# start a generation
curl -X POST http://localhost:3000/api/sessions \
  -H 'Content-Type: application/json' \
  -d '{"prompts":["a neon city at night"],"modelIds":["<model-id>"],"config":{"batchSize":2}}'

# poll results
curl http://localhost:3000/api/sessions/<session-id>

# download the session archive
curl -L http://localhost:3000/api/sessions/<session-id>/export -o session.zip
```

Set a **webhook URL** (Settings, or per session via `webhookUrl`) to receive a
`POST` when all generations in a session complete.

### Other endpoints

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/models` | list / add models |
| PATCH/DELETE | `/api/models/:id` | edit / remove a model |
| GET/POST | `/api/sessions` | list / create sessions |
| GET/DELETE | `/api/sessions/:id` | session + results |
| GET | `/api/sessions/:id/export` | ZIP export |
| PATCH | `/api/results/:id` | rating / pin |
| GET | `/api/history` | prompt history |
| GET/POST | `/api/presets`, DELETE `/api/presets/:id` | presets |
| GET/PUT | `/api/settings` | API key, webhook |
| GET | `/api/analytics` | model stats |

## A note on models

The seeded examples are Google Gemini image-output models on OpenRouter. Free
image-generation models come and go — if a model id no longer works you'll see
the error on the result card. Just edit/add the correct id from
[openrouter.ai/models](https://openrouter.ai/models) in **Settings**.

Only image-output capable models will return images; text-only chat models will
report "no image".

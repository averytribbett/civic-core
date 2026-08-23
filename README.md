# Civic Core

Customer service agents for municipalities.

## Repo layout

| Directory | Role |
|-----------|------|
| [`backend/`](backend/) | Express + Prisma API, crawl sync, chat |
| [`widget/`](widget/) | Embeddable chat widget + local [`demo.html`](widget/demo.html) |
| [`frontend/`](frontend/) | Marketing site |

For backend deploy, crawl jobs, and env details see [`backend/README.md`](backend/README.md). For widget embed and hosting see [`widget/README.md`](widget/README.md).

---

## Add a jurisdiction locally

Use this when you already have one county working (e.g. Chisago) and want another (e.g. Denver) on your laptop.

### 1. Backend running

```bash
cd backend
yarn install
# .env needs DATABASE_URL, LLM keys, WIDGET_ALLOWED_ORIGINS, and:
# ENABLE_DEV_ROUTES=true
yarn db:migrate   # or yarn db:migrate:deploy
yarn dev          # http://localhost:4000
```

`WIDGET_ALLOWED_ORIGINS` must include the origin that serves `widget.html` (Live Server example: `http://127.0.0.1:5500,http://localhost:5500`).

`ENABLE_DEV_ROUTES=true` turns on `GET /dev/jurisdictions` for the demo picker. **Do not set this on Cloud Run.**

### 2. Edit jurisdictions JSON and sync to the DB

Local jurisdiction config lives in **`backend/secrets/jurisdictions.json`** (gitignored under `secrets/`). That file is the source of truth for create/update/delete of `jurisdiction` rows.

```bash
cd backend
mkdir -p secrets
cp jurisdictions.json.example secrets/jurisdictions.json   # first time only
# edit secrets/jurisdictions.json — add Denver, tweak prompts, etc.
yarn jurisdiction:sync
```

| Field | Example (Denver) | Notes |
|-------|------------------|--------|
| `source` | `denver_city_co` | Unique slug; widget + crawl + chat all use this |
| `name` | `City and County of Denver` | Display name |
| `type` | `city` or `county` | `country` \| `state` \| `county` \| `city` \| `township` \| `village` |
| `email` | `info@example.gov` | Required |
| `prompt` | (system prompt text) | Jurisdiction-specific chat instructions |
| `faqUrl` | `https://www.chisagocountymn.gov/faq.aspx` | Optional FAQ page; weekly crawl extracts up to 20 questions and caches English answers |
| `enabled` | `false` | Weekly job only includes `enabled=true` |
| `phoneNumber` | `null` | Optional |
| `logoPath` | `logos/chisago_county_mn.png` | Optional; path relative to `jurisdictions.json`. Local sync copies to `secrets/logos/` and sets `logoUrl`; prod (`LOGO_STORAGE=gcs`) uploads to bucket |
| `themeColor` | `#8a2561` | Optional widget brand color (hex) |

`yarn jurisdiction:sync` upserts every row in the JSON. If the DB has a `source` that is **missing** from the file, the script warns and **cancels by default**; type exact `y` to delete those rows and continue.

### 3. Sync / crawl documents

With an explicit `--source=` (or `CRAWL_SOURCE`), the sync job will run even when `enabled=false`, as long as `crawlUrl` is set:

```bash
cd backend
CRAWL_SOURCE=denver_city_co yarn crawl:sync-one:dev
# or
yarn crawl:sync-all:dev -- --source=denver_city_co
```

Alternative while `DISABLE_CRAWL` is unset (local API):

```bash
curl -X POST http://localhost:4000/crawl \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.denvergov.org/","source":"denver_city_co"}'
```

After chat quality looks good, set `enabled=true` so the weekly Cloud Run job includes this source.

### 4. Point the widget at the new source

**Option A — demo picker (recommended locally)**

1. Serve the widget folder (e.g. Live Server on `widget/`).
2. Open [`widget/demo.html`](widget/demo.html).
3. Click **Dev: jurisdiction**, pick the county/city, confirm reload.
4. Choice is stored in `localStorage` under `civiccore.dev.jurisdiction` and reused on the next load.

Requires the API with `ENABLE_DEV_ROUTES=true`. Branding comes from `GET /widget/branding` after `yarn jurisdiction:sync` with `logoPath` / `themeColor` in JSON — see [`backend/README.md`](backend/README.md#jurisdiction-logos-and-theme).

**Option B — hardcode source in `demo.html`**

```html
<script>
  window.CivicCoreWidget = {
    source: "denver_city_co",
    widgetUrl: "app/widget.html",
    apiBaseUrl: "http://localhost:4000",
  };
</script>
<script src="cdn/widget.js"></script>
```

`source` must match `jurisdiction.source` exactly.

### 5. Smoke-test chat

Open the demo, send a question the site should answer, and confirm citations point at that jurisdiction’s pages (not another county’s docs).

---

## Quick local checklist

1. Edit `backend/secrets/jurisdictions.json` (include optional `logoPath` / `themeColor`) → `yarn jurisdiction:sync`
2. `CRAWL_SOURCE=<source> yarn crawl:sync-one:dev`
3. `ENABLE_DEV_ROUTES=true` + `yarn dev`
4. Open `widget/demo.html` → **Dev: jurisdiction** → pick the new row

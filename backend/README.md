# civic-core backend

Express + TypeScript API with Prisma (PostgreSQL + pgvector) and LangChain.

## Local development

1. Install dependencies: `yarn install`
2. Copy environment variables: create a `.env` file in this directory (see **Environment variables** below). You need at least `DATABASE_URL` pointing at your Postgres (e.g. Supabase).
3. Apply migrations (creates/updates schema): `yarn db:migrate`  
   - First-time only, you may need `npx prisma generate` if the client is missing: `yarn db:generate`
4. Run the server: `yarn dev` (uses `nodemon` + `ts-node`)

To build and run compiled JS locally (closer to production):

```bash
yarn build
yarn start
```

To run migrations then start (same order as the Docker image):

```bash
yarn build
yarn start:release
```

## NPM scripts reference

| Script | When to use |
|--------|-------------|
| `yarn dev` | Local development with hot reload |
| `yarn build` | Compile TypeScript to `dist/` |
| `yarn start` | Run compiled app (`node dist/src/index.js`) after `yarn build` |
| `yarn start:release` | **Production-style:** `prisma migrate deploy`, then `yarn start`. Use for a local smoke test against a real DB before/after deploy |
| `yarn db:migrate` | **Development:** create/apply migrations interactively (`prisma migrate dev`) |
| `yarn db:migrate:deploy` | **Production / CI:** apply existing migrations only (`prisma migrate deploy`). Safe when `DATABASE_URL` points at production |
| `yarn db:generate` | Regenerate Prisma Client after schema changes |
| `yarn docker:build` | Build the Docker image tagged `civic-core-backend:local` |
| `yarn docker:run` | Run that image on port **4000** (expects a `.env` file in this directory) |
| `yarn crawl:sync-all` | Run weekly crawl sync for all `Jurisdiction` rows with `enabled=true` and `crawlUrl` set (requires `yarn build` first) |
| `yarn crawl:sync-all:dev` | Same as above via `ts-node` (uses `.env`) |
| `yarn crawl:sync-one:dev` | Sync one jurisdiction (`CRAWL_SOURCE` or `--source=`) |
| `yarn crawl:sync-all:dev` | Sync all enabled jurisdictions sequentially (local dev) |
| `yarn jurisdiction:sync` | Upsert `jurisdiction` rows from `secrets/jurisdictions.json` (local); optional `logoPath` / `themeColor` per row |

Legacy names `prisma:migrate`, `prisma:generate`, and `prisma:migrate:production` still work and call the same Prisma commands.

## Jurisdiction logos and theme

Branding lives in Postgres (`logoUrl`, `themeColor`). The widget loads it via **`GET /widget/branding?source=`**.

Add optional fields to each row in **`secrets/jurisdictions.json`** (paths relative to that file):

```json
{
  "source": "chisago_county_mn",
  "logoPath": "logos/chisago_county_mn.png",
  "themeColor": "#8a2561"
}
```

Run **`yarn jurisdiction:sync`**:

| `LOGO_STORAGE` | When `logoPath` is set |
|----------------|-------------------------|
| **`local`** (default) | Copies the file to `secrets/logos/`, sets `logoUrl` to `http://localhost:4000/assets/logos/...` |
| **`gcs`** | Uploads to GCS, sets `logoUrl` to the public bucket URL |

Omit `logoPath` on a row to leave an existing `logoUrl` unchanged. `themeColor` is updated whenever present in JSON.

### Production GCS (one-time)

```bash
gcloud storage buckets create gs://civic-core-assets --location=us-central1
gcloud storage buckets add-iam-policy-binding gs://civic-core-assets \
  --member=allUsers --role=roles/storage.objectViewer
```

Sync against prod with:

```bash
LOGO_STORAGE=gcs GCS_ASSETS_BUCKET=civic-core-assets yarn jurisdiction:sync
```

The Cloud Run chat API only reads Postgres — no GCS access on the service itself.

## Environment variables

Set these in `.env` locally, or in the Cloud Run service (or Secret Manager) for production.

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (SSL as required by your host, e.g. Supabase) |
| `PORT` | No | HTTP port. Defaults to **4000** locally. **Cloud Run sets this automatically** (usually `8080`) |
| `LLM_TEMPERATURE` | No | Sampling temperature (default `0.7`). Ignored for gpt-5 / o-series (those models reject it). |
| `LLM_PROVIDER` | No | `openai` (default `openai`) |
| `LLM_REASONING_EFFORT` | No | GPT-5.x only: `none` (default), `minimal`, `low`, `medium`, `high`, `xhigh` — lower is faster. Chat uses the OpenAI Responses API so tools work with non-`none` effort. |
| `OPENAI_API_KEY` | Yes (embeddings; chat if OpenAI) | OpenAI API key |
| `WIDGET_ALLOWED_ORIGINS` | **Yes** (for `/chat`) | Comma-separated **origins** where `widget.html` is hosted (iframe `fetch` uses this origin). Example: `https://civic-core-widget.web.app`. For Live Server, add `http://127.0.0.1:5500`. If unset or empty, chat returns **503**. |
| `MESSAGE_ENCRYPTION_KEY` | No | Optional message encryption |
| `DISABLE_CRAWL` | No | Set to **`true`** on the **API** Cloud Run service to turn off **`/crawl`** and never load **crawlee**. The weekly sync uses a separate Cloud Run **Job**, not this route. |
| `ENABLE_DEV_ROUTES` | No | Set to **`true` locally only** to mount **`GET /dev/jurisdictions`** (widget demo jurisdiction picker). Omit / leave unset on Cloud Run. |
| `LOGO_STORAGE` | No | **`local`** (default) — logos in `secrets/logos/`, served at `/assets/logos/`. Set to **`gcs`** when uploading to Cloud Storage (prod). |
| `LOGO_PUBLIC_BASE_URL` | No | Base URL for local logo links (default `http://localhost:4000`). Set if your API is reachable at a different host/port. |
| `GCS_ASSETS_BUCKET` | Prod upload | GCS bucket name when `LOGO_STORAGE=gcs` (e.g. `civic-core-assets`). |
| `GCS_LOGO_PREFIX` | No | Object prefix in bucket (default `logos`). |
| `SKIP_DB_MIGRATE` | No | Set to **`true`** to skip `prisma migrate deploy` in the container (run **`yarn db:migrate:deploy`** yourself when schema changes). |
Provider-specific API keys must match `LLM_PROVIDER`.

**Jurisdiction crawl config (database):** each row in `jurisdiction` can set `enabled` (include in weekly job), `crawlUrl` (seed URL), and `lastCrawl*` fields updated by the job. New sites should start with `enabled=false` until a manual crawl looks good. Full laptop steps (create row → sync → widget demo picker) are in the [root README](../README.md#add-a-jurisdiction-locally).

**CORS:** the app uses `cors()` with default options (reflective / permissive for browser preflight). Widget access is gated by **`WIDGET_ALLOWED_ORIGINS`** in [`src/lib/widget-origin.ts`](src/lib/widget-origin.ts) (chat, vote, branding, faqs).

---

## Deploy to Google Cloud Run (manual)

This section assumes:

- You use **[Supabase](https://supabase.com/)** (or any reachable Postgres) for `DATABASE_URL` — **no Cloud SQL is required on GCP.**
- You deploy **by hand** when you want (no automatic GitHub deploy in these steps).
- You have **[Docker](https://docs.docker.com/get-docker/)** and the **[Google Cloud CLI](https://cloud.google.com/sdk/docs/install)** (`gcloud`) installed.

Replace placeholders in angle brackets with your values, for example:

- `<GCP_PROJECT_ID>` — Project ID from [Google Cloud Console](https://console.cloud.google.com/)
- `<REGION>` — e.g. `us-central1` (use the same region for Artifact Registry and Cloud Run)
- `<AR_REPO>` — Artifact Registry repository name you create (e.g. `civic-core`)
- `<SERVICE_NAME>` — Cloud Run service name (e.g. `civic-core-backend`)

### 1. One-time: configure `gcloud`

```bash
gcloud auth login
gcloud config set project <GCP_PROJECT_ID>
```

### 2. One-time: enable APIs

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```

### 3. One-time: Docker repository in Artifact Registry

```bash
gcloud artifacts repositories create <AR_REPO> \
  --repository-format=docker \
  --location=<REGION> \
  --description="civic-core backend images"
```

Configure Docker to push to that registry:

```bash
gcloud auth configure-docker <REGION>-docker.pkg.dev
```

### 4. Build and push the image

From **this directory** (`backend/`, where the `Dockerfile` lives):

```bash
yarn docker:build
```

The Dockerfile targets **`linux/amd64`**, which **Google Cloud Run requires**. If you build on an **Apple Silicon (M1/M2/M3) Mac** without that platform, Docker produces an **arm64** image; it will run locally but fail on Cloud Run with **`exec format error`** (often on `/bin/sh` or `node`). The `yarn docker:build` script passes `--platform linux/amd64` for the same reason.

Tag and push (replace placeholders):

```bash
docker tag civic-core-backend:local \
  <REGION>-docker.pkg.dev/<GCP_PROJECT_ID>/<AR_REPO>/civic-core-backend:latest

docker push <REGION>-docker.pkg.dev/<GCP_PROJECT_ID>/<AR_REPO>/civic-core-backend:latest
```

Alternatively, build and push in one step with Cloud Build (still “manual” — you run the command when you want):

```bash
gcloud builds submit --tag <REGION>-docker.pkg.dev/<GCP_PROJECT_ID>/<AR_REPO>/civic-core-backend:latest .
```

### 5. Deploy to Cloud Run

Deploy the image you pushed. Set **all** required environment variables your app needs (at minimum `DATABASE_URL`, `LLM_MODEL`, and the right API keys).

**Option A — YAML file (recommended):** keep values out of the shell and out of your shell history.

1. Ensure the `secrets/` folder exists, then copy the template and edit the copy (your filled file under `secrets/` is gitignored; the `.example` file in this directory is tracked):

   ```bash
   mkdir -p secrets
   cp cloud-run.env.yaml.example secrets/cloud-run.env.yaml
   ```

2. Fill in `secrets/cloud-run.env.yaml` with production values. Use **YAML** syntax: `KEY: "value"`. Quote values that contain `&`, `?`, or `#` (your `DATABASE_URL` usually must be quoted).

3. Deploy:

   ```bash
   gcloud run deploy <SERVICE_NAME> \
     --image <REGION>-docker.pkg.dev/<GCP_PROJECT_ID>/<AR_REPO>/civic-core-backend:latest \
     --region <REGION> \
     --platform managed \
     --allow-unauthenticated \
     --port 8080 \
     --memory 2Gi \
     --cpu-boost \
     --timeout 900 \
     --env-vars-file secrets/cloud-run.env.yaml
   ```

Run the `gcloud run deploy` command from the **`backend/`** directory so the path `secrets/cloud-run.env.yaml` resolves correctly. Or pass an absolute path to `--env-vars-file`.

**Option B — inline:** add or remove `--set-env-vars` entries as needed:

```bash
gcloud run deploy <SERVICE_NAME> \
  --image <REGION>-docker.pkg.dev/<GCP_PROJECT_ID>/<AR_REPO>/civic-core-backend:latest \
  --region <REGION> \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu-boost \
  --timeout 900 \
  --set-env-vars "DATABASE_URL=<YOUR_SUPABASE_DATABASE_URL>,LLM_MODEL=<MODEL>,LLM_PROVIDER=openai,OPENAI_API_KEY=<KEY>"
```

Notes:

- **`DATABASE_URL`:** Use your Supabase connection string from the dashboard (**Project Settings → Database**). Include **`?sslmode=require`** (or `sslmode=require` with other params) if required. **Important:** Supabase’s **transaction pooler** (port **6543**) often **breaks `prisma migrate deploy`** (migrations need session-level features). If the container dies during **`[entrypoint] 1/2 prisma migrate deploy`**, try the **direct** connection (port **5432**) for `DATABASE_URL`, or run migrations from your laptop against the **direct** URL (see below) and use the pooler only after you have a working split (advanced). For small traffic, **direct 5432** for both app and migrate is simplest.
- **`--port 8080`:** The container listens on **`process.env.PORT`**. Cloud Run sets `PORT` (commonly `8080`). The Dockerfile `EXPOSE 8080` matches that convention.
- **`--memory` / `--timeout`:** Increase if crawls or LLM calls hit limits (Cloud Run allows long request timeouts; tune as needed).
- **`--cpu-boost`:** Gives extra CPU during **startup** so the container reaches `listen()` sooner (helps Node cold starts). If deploy still times out on the TCP probe, check **Logs** for `[entrypoint]` and `[listen]` lines. The **`/crawl`** stack (`crawlee`) is **lazy-loaded** so it does not slow the initial listen.
- **Secrets:** For production, prefer **[Secret Manager](https://cloud.google.com/secret-manager)** and mount secrets into Cloud Run instead of plain `--set-env-vars` for API keys.
- **`exec format error` on `/bin/sh` or `node`:** Almost always an **arm64 image deployed to Cloud Run (amd64)** — typical when the image was built on **Apple Silicon** without `--platform linux/amd64`. Rebuild with the current [Dockerfile](Dockerfile) / `yarn docker:build` and redeploy.
- **`exec format error` on `docker-entrypoint.sh` only:** Often **Windows CRLF** in the shell script. The Dockerfile uses `/bin/sh` to run the script; `*.sh` uses **LF** in [`.gitattributes`](.gitattributes). Run `dos2unix docker-entrypoint.sh` before `docker build` if needed.
- **`Container called exit(1)`** then **TCP probe failed:** The process crashed before it could listen on **`PORT`** (Cloud Run often uses **8080**). Open **Google Cloud Console → Cloud Run → your service → Logs** (or **Logging** with filter `resource.type="cloud_run_revision"`). Find the **first error** after **`[entrypoint] 1/2 prisma migrate deploy`**. Most often **`prisma migrate deploy` fails** (wrong `DATABASE_URL`, **transaction pooler + migrations**, SSL, or password with unescaped YAML characters). Less often **Node crashes** on startup.
- **Debug: skip migrations in the container:** Add `SKIP_DB_MIGRATE: "true"` to `secrets/cloud-run.env.yaml`, run migrations from your laptop with the **same** DB (`yarn db:migrate:deploy`), rebuild the image, redeploy. If the service **then** stays up, fix migration connectivity (usually **use direct `DATABASE_URL` for migrate**, or keep skipping migrate on startup and run deploys manually / in CI). Remove `SKIP_DB_MIGRATE` once startup migrations work. See [cloud-run.env.yaml.example](cloud-run.env.yaml.example).

### 6. Migrations on deploy

The Docker **entrypoint** runs `npx prisma migrate deploy` **before** starting the server (unless **`SKIP_DB_MIGRATE=true`**), so each new revision applies pending migrations against the database in `DATABASE_URL`.

You can also run migrations yourself from your laptop (useful for debugging):

```bash
export DATABASE_URL="<same URL as production>"
yarn db:migrate:deploy
```

Use **`yarn db:migrate`** only against a **development** database (it creates new migration files and is interactive).

### 7. Smoke test

After deploy, `gcloud` prints the **Service URL**. Open it or call:

```bash
curl -sS "https://<YOUR_CLOUD_RUN_URL>/"
```

You should see the root handler response from the API.

### 8. Run the image locally (optional)

With a `.env` file that includes `DATABASE_URL` and other vars:

```bash
yarn docker:build
yarn docker:run
```

The app listens on [http://localhost:4000](http://localhost:4000) (`docker:run` maps host `4000` → container `8080` and sets `PORT=8080` inside the container).

---

## Weekly crawl sync (Cloud Run Job)

Production embeddings are refreshed by a **Cloud Run Job** (`civic-core-crawl-sync`), not the public API. The API keeps `DISABLE_CRAWL=true`.

The job runs [`src/jobs/sync-jurisdictions.ts`](src/jobs/sync-jurisdictions.ts) with **`CRAWL_SOURCE`** (or `--source=`) set to one jurisdiction per execution. Each run crawls the site, pipelines embed/upsert in batches during the crawl, and deletes stale documents at the end.

Chunks are **2000** characters with **100** overlap (see `text-processing.service.ts`). Hash-based skip avoids re-embedding unchanged pages on weekly runs.

**Schedule:** one Cloud Scheduler job **per enabled jurisdiction**, all Sunday **2:00 AM** `America/Chicago` (`0 2 * * 0`), so counties run **in parallel**.

### Local test

```bash
yarn db:migrate:deploy   # if schema not applied
yarn build
CRAWL_SOURCE=chisago_county_mn yarn crawl:sync-one:dev
# or
yarn crawl:sync-all:dev -- --source=chisago_county_mn
# all enabled (sequential, dev only):
yarn crawl:sync-all:dev
```

### One-time GCP setup

Use the same container image as the API (`civic-core-backend`). Replace placeholders (`<GCP_PROJECT_ID>`, `<REGION>`, image URL, etc.).

**1. Create the job** (command override — does not start Express):

```bash
gcloud run jobs create civic-core-crawl-sync \
  --image <REGION>-docker.pkg.dev/<GCP_PROJECT_ID>/<AR_REPO>/civic-core-backend:latest \
  --region <REGION> \
  --command node \
  --args dist/src/jobs/sync-jurisdictions.js \
  --memory 2Gi \
  --cpu 2 \
  --task-timeout 10800 \
  --max-retries 0 \
  --set-env-vars "DATABASE_URL=<YOUR_DATABASE_URL>,OPENAI_API_KEY=<KEY>"
```

Prefer Secret Manager for `DATABASE_URL` and `OPENAI_API_KEY` instead of plain `--set-env-vars` in production.

**Task timeout:** use **`task-timeout 10800`** (3 hours) for small counties (~1k pages). Large city sites (e.g. Denver, 8k+ pages) need **`28800–43200`** (8–12 hours) so the job can finish in the background. Each jurisdiction runs as a separate parallel job execution, so set timeout per your largest enabled site.

**Crawl tuning (optional env vars on the job):**

| Variable | Default | Purpose |
|----------|---------|---------|
| `CRAWL_MAX_CONCURRENCY` | `5` | Parallel HTTP workers |
| `CRAWL_SAME_DOMAIN_DELAY_SECS` | `0.5` | Minimum delay between same-domain requests |
| `CRAWL_SESSION_POOL_SIZE` | `10` | Distinct cookie/session pool size (rotates User-Agent per session) |
| `CRAWL_PROGRESS_INTERVAL` | `100` | Log `progress` every N ingested pages |

During a crawl, look for `progress pages=...` and `pipeline_flush` lines in logs; the final `done` line includes created/updated/skipped counts.

**2. Scheduler service account** (if you do not already have one):

```bash
gcloud iam service-accounts create civic-core-scheduler \
  --display-name "Civic Core Scheduler"
```

Grant permission to run the job:

```bash
gcloud run jobs add-iam-policy-binding civic-core-crawl-sync \
  --region <REGION> \
  --member "serviceAccount:civic-core-scheduler@<GCP_PROJECT_ID>.iam.gserviceaccount.com" \
  --role "roles/run.developer"
```

**3. Cloud Scheduler — one trigger per jurisdiction** (Sunday 2:00 AM Central, parallel runs):

Repeat for each `source` (e.g. `chisago_county_mn`). The run API accepts env overrides:

```bash
gcloud scheduler jobs create http civic-core-crawl-sync-chisago \
  --location <REGION> \
  --schedule "0 2 * * 0" \
  --time-zone "America/Chicago" \
  --uri "https://<REGION>-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/<GCP_PROJECT_ID>/jobs/civic-core-crawl-sync:run" \
  --http-method POST \
  --oauth-service-account-email "civic-core-scheduler@<GCP_PROJECT_ID>.iam.gserviceaccount.com" \
  --message-body '{"overrides":{"containerOverrides":[{"env":[{"name":"CRAWL_SOURCE","value":"chisago_county_mn"}]}]}}' \
  --headers "Content-Type=application/json"
```

**4. Manual run (single county):**

```bash
gcloud run jobs execute civic-core-crawl-sync \
  --region <REGION> \
  --update-env-vars "CRAWL_SOURCE=chisago_county_mn"
```

After deploying schema changes, run `yarn db:migrate:deploy` (or rely on API entrypoint migrations) before the first job execution.

### Onboarding a new jurisdiction

See the [root README](../README.md#add-a-jurisdiction-locally) for the full local walkthrough (JSON sync, crawl, widget demo picker).

1. Add the row to `secrets/jurisdictions.json` (copy from `jurisdictions.json.example` if needed), then `yarn jurisdiction:sync`. Keep `enabled=false` until a crawl looks good.
2. Run one crawl sync: `CRAWL_SOURCE=<source> yarn crawl:sync-one:dev` (or `yarn crawl:sync-all:dev -- --source=<source>`). An explicit source filter runs even when `enabled=false`. Or use local `POST /crawl` when `DISABLE_CRAWL` is not set.
3. Verify chat search quality, then set `enabled=true` in the JSON and run `yarn jurisdiction:sync` again.
4. Local widget switching: set `ENABLE_DEV_ROUTES=true`, open `widget/demo.html`, use **Dev: jurisdiction**.

Removing a jurisdiction from the JSON makes `yarn jurisdiction:sync` warn and cancel unless you type exact `y`.

### Meeting dumps and RAG

The crawler **skips** meeting agenda/minutes/packet URLs (and BoardDocs-style paths). Default retrieval also **excludes** `docKind` agenda/minutes unless the search query looks meeting-related (`agenda`, `minutes`, `meeting`, `packet`).

After changing crawl filters, wipe or re-sync so the index matches the new rules:

```bash
CRAWL_SOURCE=<source> yarn crawl:sync-one:dev
```

Check crawl logs for `meetingDumpSkipped=` and chat search logs for service-page URLs instead of packets.

### Observability

The job emits **JSON logs** to Cloud Logging:

| `event` | Meaning |
|---------|---------|
| `crawl_sync_start` | Run started; lists `sources` |
| `pipeline_flush` / `progress` | Pipelined upsert batch; periodic ingest progress (every 100 pages by default) |
| `crawl_sync_jurisdiction` | Per-site result (`success` / `error`, counts, `durationMs`) |
| `crawl_sync_complete` | Run finished (`success` or `partial_failure`) |
| `crawl_sync_fatal` | Job crashed before finishing |

`Jurisdiction.lastCrawlAt`, `lastCrawlStatus`, and `lastCrawlError` are updated after each site.

**Alerting (recommended):** in Cloud Monitoring, alert when a Cloud Run Job execution fails or exits non-zero (Scheduler will show failed invocations if `process.exitCode = 1` after any jurisdiction error).

Filter logs: `jsonPayload.event="crawl_sync_jurisdiction"` or `textPayload=~"crawl_sync"`.

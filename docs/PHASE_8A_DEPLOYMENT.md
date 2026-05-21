# Phase 8A — Content Pipeline Deployment Runbook

> **Worker platform:** Google Cloud Run + Cloud Tasks.
> Railway was considered and not selected — see `docs/WORKER_PLATFORM_DECISION.md`.
>
> The pipeline is an internal tool: it runs on Cloud Run and writes to Supabase.
> It is never called from the browser or from child-facing code.

---

## Architecture

```
Vercel (Next.js)          Cloud Run (FastAPI)        Supabase (Postgres)
─────────────────         ──────────────────          ───────────────────
Admin / scripts  ──POST──▶  /generate              ──▶  quiz_questions
                          ──────────────────
                            /verify/maths
                            /ingest
                            /health
```

The Next.js app never calls the pipeline at runtime. The pipeline is triggered by:
- Manual CLI calls during content seeding (`scripts/generate-content.ts`)
- Cloud Tasks queue dispatches (Phase 12 nightly regeneration)

---

## Required Environment Variables

### Cloud Run (pipeline service)

Set these via GCP Secret Manager → link to the Cloud Run service as mounted env vars:

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Used by Stage 1 (generation), Stage 3 (consensus), Stage 4 (constitutional critique) |
| `OPENAI_API_KEY` | Conditional | Required for Stage 5 semantic deduplication. If omitted, dedup is skipped and content lands in `staged`. Maths questions do not require RAG grounding (CLAUDE.md §8), so this is optional for Phase 8A. |
| `DATABASE_URL` | Yes | Direct Postgres URL (not PgBouncer-pooled). Use the direct connection string from Supabase project settings → Database → Connection string → URI mode (port 5432). The pipeline bypasses RLS — use this URL only in Cloud Run, never in the Next.js app. |
| `PORT` | Auto | Cloud Run injects `PORT=8080` automatically. Uvicorn binds `0.0.0.0:$PORT`. |

### Vercel (Next.js app)

| Variable | Required | Notes |
|---|---|---|
| `PIPELINE_SERVICE_URL` | Yes | Cloud Run service URL, e.g. `https://decifer-pipeline-xxxx-ew.a.run.app`. No trailing slash. Used by admin scripts only. |

> Set `PIPELINE_SERVICE_URL` in `.env.local` for local admin scripts.
> Set it in Vercel project env for any future server-side admin triggers (Phase 12).

---

## Admin Token Flow

The pipeline endpoints (`/generate`, `/ingest`) are internal. In Phase 8A they are
authenticated via Cloud Run ingress control (internal-only) and Cloud Tasks OIDC tokens.
No bearer token is required in the FastAPI code for Phase 8A when Cloud Tasks is the caller.

**Before community rollout (Phase 12 gate):**
Add IAM-based authentication: Cloud Tasks signs requests with a service account OIDC
token; Cloud Run verifies via the `--no-allow-unauthenticated` flag. For operator
CLI access, use `gcloud auth print-identity-token` as the `Authorization: Bearer` header.

For simpler Phase 12 interim, add a static `PIPELINE_ADMIN_TOKEN` via Secret Manager:

```python
from fastapi import Depends, HTTPException, Header
import os

def require_admin(x_admin_token: str = Header(...)):
    if x_admin_token != os.environ["PIPELINE_ADMIN_TOKEN"]:
        raise HTTPException(status_code=403, detail="Forbidden")
```

Apply to `/generate` and `/ingest` only. `/health` and `/verify/maths` remain open.

---

## Deployment Steps

### 1. Enable GCP APIs

```bash
gcloud services enable run.googleapis.com cloudtasks.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com
```

### 2. Push secrets to Secret Manager

```bash
echo -n "<anthropic-key>" | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
echo -n "<db-direct-url>"  | gcloud secrets create PIPELINE_DATABASE_URL --data-file=-
# Optional:
echo -n "<openai-key>"     | gcloud secrets create OPENAI_API_KEY --data-file=-
```

### 3. Build and push the Docker image

```bash
# From the repo root
gcloud builds submit services/content-pipeline \
  --tag gcr.io/<PROJECT_ID>/decifer-pipeline:latest
```

### 4. Deploy to Cloud Run

```bash
gcloud run deploy decifer-pipeline \
  --image gcr.io/<PROJECT_ID>/decifer-pipeline:latest \
  --region europe-west1 \
  --no-allow-unauthenticated \
  --set-secrets "ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,DATABASE_URL=PIPELINE_DATABASE_URL:latest" \
  --timeout 3600 \
  --memory 1Gi
```

### 5. Verify deployment

```bash
# Authenticated health check
TOKEN=$(gcloud auth print-identity-token)
CLOUD_RUN_URL=$(gcloud run services describe decifer-pipeline \
  --region europe-west1 --format 'value(status.url)')

curl -H "Authorization: Bearer $TOKEN" "$CLOUD_RUN_URL/health"
# Expected: {"status":"ok","version":"0.3.0"}

# Smoke-test the maths verifier
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question_type":"maths_arithmetic","correct_answer":"4","verification_expression":"2+2"}' \
  "$CLOUD_RUN_URL/verify/maths"
# Expected: {"verified":true,"detail":"arithmetic verified"}
```

Or use the verification script (set PIPELINE_SERVICE_URL first):

```bash
PIPELINE_SERVICE_URL=$CLOUD_RUN_URL node --env-file=.env.local scripts/verify-phase8a.mjs
```

All three layers (STATIC, DATABASE, LIVE) must pass before generating content.

### 6. Generate content

```bash
# Set PIPELINE_SERVICE_URL in .env.local first, then:
node --env-file=.env.local scripts/generate-content.ts \
  --topic-id <uuid> \
  --tier sprout \
  --count 15
```

Or call the endpoint directly:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topic_id":"<uuid>","tier":"sprout","count":15}' \
  "$CLOUD_RUN_URL/generate"
```

---

## Verification Script Layers

`scripts/verify-phase8a.mjs` runs three distinct layers:

| Layer | What it checks | Env vars needed |
|---|---|---|
| STATIC | Service files exist in repo, FastAPI endpoints defined, no pipeline import leak into child code | None |
| DATABASE | DB reachable, published questions ≥ 15 per year group, curriculum_chunks seeded | `DATABASE_URL` |
| LIVE | Cloud Run service responds on `/health` and `/verify/maths` | `PIPELINE_SERVICE_URL` |

SKIP states are printed when env vars are missing. A check only FAILs if it runs and the assertion is false. SKIP is not a failure.

**Do not claim live activation unless DATABASE and LIVE actually pass.**

---

## Phase 12 Hardening (before community rollout)

- [ ] Create Cloud Tasks queue with rate limiting matched to Anthropic API limits
- [ ] Grant Cloud Tasks service account `roles/run.invoker` on the Cloud Run service
- [ ] Add `POST /pipeline/regenerate-flagged` endpoint triggered by Cloud Tasks
- [ ] Add nightly `pg_cron` anomaly detection (CLAUDE.md §9, §12)
- [ ] Admin monitoring page (`/dashboard/admin`) shows flagged counts and pipeline stats
- [ ] "Report a problem" button on quiz questions
- [ ] Full IAM-based auth (Cloud Tasks OIDC → Cloud Run `--no-allow-unauthenticated`)

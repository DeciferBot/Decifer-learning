# Phase 8A — Content Pipeline Deployment Runbook

> This document describes how to deploy the Decifer Learning content pipeline service
> to Railway and activate it for question generation.
>
> The pipeline is an internal tool: it runs on Railway and writes to Supabase.
> It is never called from the browser or from child-facing code.

---

## Architecture

```
Vercel (Next.js)          Railway (FastAPI)          Supabase (Postgres)
─────────────────         ─────────────────           ───────────────────
Admin / scripts  ──POST──▶  /generate              ──▶  quiz_questions
                          ─────────────────
                            /verify/maths
                            /ingest
                            /health
```

The Next.js app never calls the pipeline at runtime. The pipeline is triggered by:
- Manual CLI calls during content seeding (`scripts/generate-content.ts`)
- Admin scripts run locally or via Railway CLI

---

## Required Environment Variables

### Railway (pipeline service)

Set these in the Railway project → Variables tab before deploying:

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Used by Stage 1 (generation), Stage 3 (consensus), Stage 4 (constitutional critique) |
| `OPENAI_API_KEY` | Conditional | Required for Stage 5 semantic deduplication. If omitted, dedup is skipped and all content lands in `staged` rather than dedup-failing. Maths questions do not require RAG grounding (CLAUDE.md §8), so this is optional for Phase 8A. |
| `DATABASE_URL` | Yes | Direct Postgres URL (not PgBouncer-pooled). Use the direct connection string from Supabase project settings → Database → Connection string → URI mode (port 5432). The pipeline bypasses RLS — use the direct URL only in Railway, never in the Next.js app. |
| `PORT` | Auto | Railway injects this automatically. Uvicorn is configured to bind `0.0.0.0:8000`; Railway's port routing handles the rest. |

### Vercel (Next.js app)

| Variable | Required | Notes |
|---|---|---|
| `PIPELINE_SERVICE_URL` | Yes | Railway public URL, e.g. `https://decifer-pipeline.up.railway.app`. No trailing slash. Used by admin scripts only. |

> Set `PIPELINE_SERVICE_URL` in `.env.local` for local admin scripts.
> Set it in Vercel project env for any future server-side admin triggers (Phase 12).

---

## Admin Token Flow

The pipeline endpoints (`/generate`, `/ingest`) are internal and authenticated only at
the network level in Phase 8A: Railway's public URL is not advertised and is only known
to the operator. No Bearer token is enforced in Phase 8A.

**Before community rollout (Phase 12 gate):**
Add a static `PIPELINE_ADMIN_TOKEN` env var to Railway and verify it in FastAPI using
a dependency:

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

### 1. Push to Railway

```bash
# Install Railway CLI if needed
npm i -g @railway/cli
railway login

# From the repo root
cd services/content-pipeline
railway up
```

Or connect the GitHub repo to a Railway project and enable auto-deploy from `main`.

### 2. Set env vars

In Railway dashboard → Variables:

```
ANTHROPIC_API_KEY=<your key>
DATABASE_URL=<supabase direct postgres URL>
OPENAI_API_KEY=<your key>   # optional
```

### 3. Verify deployment

```bash
# Check health
curl https://<your-railway-url>/health
# Expected: {"status":"ok","version":"0.3.0"}

# Smoke-test the maths verifier
curl -X POST https://<your-railway-url>/verify/maths \
  -H "Content-Type: application/json" \
  -d '{"question_type":"maths_arithmetic","correct_answer":"4","verification_expression":"2+2"}'
# Expected: {"verified":true,"detail":"arithmetic verified"}
```

Or use the verification script:

```bash
PIPELINE_SERVICE_URL=https://<your-railway-url> node --env-file=.env.local scripts/verify-phase8a.mjs
```

All three layers (STATIC, DATABASE, LIVE) must pass before generating content.

### 4. Generate content

```bash
# Set PIPELINE_SERVICE_URL in .env.local first, then:
node --env-file=.env.local scripts/generate-content.ts \
  --topic-id <uuid> \
  --tier sprout \
  --count 15
```

Or call the endpoint directly:

```bash
curl -X POST https://<your-railway-url>/generate \
  -H "Content-Type: application/json" \
  -d '{"topic_id":"<uuid>","tier":"sprout","count":15}'
```

---

## Verification Script Layers

`scripts/verify-phase8a.mjs` runs three distinct layers:

| Layer | What it checks | Env vars needed |
|---|---|---|
| STATIC | Service files exist in repo, FastAPI endpoints defined, no pipeline import leak into child code | None |
| DATABASE | DB reachable, published questions ≥ 15 per year group, curriculum_chunks seeded | `DATABASE_URL` |
| LIVE | Railway service responds on `/health` and `/verify/maths` | `PIPELINE_SERVICE_URL` |

SKIP states are printed when env vars are missing. A check only FAILs if it runs and the assertion is false. SKIP is not a failure.

**Do not claim live activation unless DATABASE and LIVE actually pass.**

---

## Phase 12 Hardening (before community rollout)

- [ ] Add `PIPELINE_ADMIN_TOKEN` auth to `/generate` and `/ingest`
- [ ] Add nightly `pg_cron` anomaly detection (CLAUDE.md §9, §12)
- [ ] Add `POST /pipeline/regenerate-flagged` endpoint and cron trigger
- [ ] Admin monitoring page (`/dashboard/admin`) shows flagged counts and pipeline stats
- [ ] "Report a problem" button on quiz questions

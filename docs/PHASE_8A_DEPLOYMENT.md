# Phase 8A — Content Pipeline Activation: Deployment Guide

> See `DECISIONS.md` § "Phase 8A" for *why* this exists. This file is the
> *how*. It walks through Railway deploy, Vercel env-var setup, local
> smoke test, production smoke test, and rollback.

---

## 0. Prerequisites

- Supabase project running (Phase 2 migrations applied).
- Vercel project deploying `main`.
- An Anthropic API key.
- (Optional) An OpenAI API key — needed only if you want embeddings for
  RAG retrieval and semantic dedup. Maths content does not strictly need
  it (CLAUDE.md §8).

---

## 1. Get the direct Supabase Postgres URL (port 5432)

The pipeline **must** use a direct, non-pooled Postgres connection.

1. Supabase → **Connect** → **ORMs (Prisma)** tab.
2. Copy the `DIRECT_URL` value (port **5432**, no `pgbouncer=true` suffix).
3. Substitute the real database password in place of `[YOUR-PASSWORD]`.

That URL is what you'll paste as Railway's `DATABASE_URL` in step 2. **Do
NOT reuse the pooled URL (port 6543) for the pipeline service** — see
DECISIONS.md.

---

## 2. Deploy to Railway

### 2a. Create the service

1. Railway dashboard → **New Project** → **Deploy from GitHub repo**.
2. Pick `DeciferBot/Decifer-learning`.
3. After import: **Settings → Service → Root Directory** =
   `services/content-pipeline`.
4. Railway auto-detects the Dockerfile and `railway.toml`. No manual
   build-command override needed.

### 2b. Set Railway environment variables

In the service's **Variables** tab, add:

| Variable           | Value                                                       |
|--------------------|-------------------------------------------------------------|
| `ANTHROPIC_API_KEY`| Your Anthropic key                                          |
| `OPENAI_API_KEY`   | Your OpenAI key (optional)                                  |
| `DATABASE_URL`     | The **direct** Supabase URL from step 1 (port 5432)         |

Railway injects `PORT` itself — do not set it manually.

### 2c. Deploy

Click **Deploy**. Wait for the build to go green. Note the generated
public URL (e.g. `https://decifer-pipeline-production.up.railway.app`).
Verify the healthcheck:

```sh
curl https://<your-railway-url>/health
# → {"status":"ok","version":"0.3.0"}
```

If healthcheck fails, check Railway build logs; the most common cause is
a wrong `DATABASE_URL` (pooled instead of direct).

---

## 3. Set Vercel environment variables

Vercel dashboard → project → **Settings → Environment Variables** →
**Production** (and Preview if you want PR previews to be able to call
the pipeline).

| Variable                | Value                                                                |
|-------------------------|----------------------------------------------------------------------|
| `PIPELINE_SERVICE_URL`  | Railway public URL from step 2c (no trailing slash)                  |
| `ADMIN_PIPELINE_TOKEN`  | A long random string (e.g. `openssl rand -hex 32`)                   |

Then redeploy Vercel (Deployments → latest → ⋯ → Redeploy). Env var
changes do not apply to the running deployment.

`ADMIN_PIPELINE_TOKEN` is a temporary back-door for triggering generation
via `curl` before any account has been promoted to `role='admin'` in
Supabase. The full role-based admin gate is in place at the UI layer
(middleware enforces it on `/dashboard/admin/*`); the token only matters
for headless API calls.

To promote an account to admin once you've created it via normal signup:

```sql
-- Run in Supabase SQL editor.
UPDATE public.profiles
SET role = 'admin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
```

---

## 4. Seed the Phase 8A test topic

This is a topic *shell* (no quiz content). Pipeline generates the content
afterwards.

```sh
# Locally, against the same Supabase project Vercel uses:
node --env-file=.env.local scripts/seed-phase8a-test-topic.mjs
```

The script prints the new `topic_id`. Keep it; you'll need it in step 5.

---

## 5. Local smoke test

Before triggering against production, prove the pipeline works locally.

```sh
# Start the pipeline service locally.
cd services/content-pipeline
ANTHROPIC_API_KEY=... DATABASE_URL=<direct-5432-url> \
  uvicorn main:app --port 8000

# In another terminal:
curl http://localhost:8000/health
# → {"status":"ok","version":"0.3.0"}

# Generate a single sprout question for the test topic:
curl -X POST http://localhost:8000/generate \
  -H 'content-type: application/json' \
  -d '{"topic_id":"<TOPIC_ID>","tier":"sprout","count":1}'
```

The response will have `published`, `staged`, `regenerating`, `failed`
counts, a `model` field (the Anthropic model used), and per-question
`stage_log` entries showing every pipeline stage with token usage.

---

## 6. Production smoke test

Two paths — pick whichever fits.

### 6a. UI (recommended)

1. Sign in as an admin account (promote via the SQL in step 3 if needed).
2. Visit `https://<your-vercel-url>/dashboard/admin/pipeline`.
3. Click **Check pipeline** → should show `HTTP 200` + `{"status":"ok"}`.
4. Pick the Phase 8A test topic, choose tier `sprout`, count `1`,
   click **Run pipeline**. Wait ~30 s. The response panel shows the same
   structured output as the curl path.

### 6b. curl (headless)

```sh
curl -X POST https://<your-vercel-url>/api/pipeline/generate \
  -H "x-admin-token: $ADMIN_PIPELINE_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"topic_id":"<TOPIC_ID>","tier":"sprout","count":1}'
```

---

## 7. Verify the activation gate

```sh
node --env-file=.env.local scripts/verify-phase8a.mjs
```

The script runs three layers (STATIC / DATABASE / LIVE) and prints PASS /
FAIL / SKIP per check. Exit code is non-zero on any FAIL. Acceptance:

- All STATIC checks PASS.
- DATABASE checks PASS if `DATABASE_URL` is set.
- LIVE healthcheck PASSes if `PIPELINE_SERVICE_URL` is set.

---

## 8. Rollback

Phase 8A is purely additive — no existing schema, RLS, or content was
changed. Rollback paths, in increasing severity:

- **Pause generation**: unset `PIPELINE_SERVICE_URL` on Vercel and
  redeploy. The proxy will return 503 for every call; admin UI shows
  the configured-warning banner. No effect on child journeys.
- **Take Railway offline**: stop the Railway service. Same effect as
  above plus the public URL goes 502. No data loss.
- **Delete the test topic**: it is `is_published=false`, so children
  never saw it. Delete from Supabase if you want to clean up.
  ```sql
  DELETE FROM quiz_questions WHERE topic_id = '<TOPIC_ID>';
  DELETE FROM curriculum_outcomes WHERE app_topic_id = '<TOPIC_ID>';
  DELETE FROM topics WHERE id = '<TOPIC_ID>';
  ```
- **Revert the code**: the Phase 8A commit set is self-contained; reverting
  it leaves the rest of the app working. Existing child journeys are not
  modified.

No rollback removes anything from the production-published content tree.

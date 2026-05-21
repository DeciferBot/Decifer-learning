# Decifer Learning — Architecture Decisions

This file records production decisions, hardening requirements, and known pre-production
items that are not Phase blockers but must be resolved before public launch.

---

## PgBouncer transaction atomicity — pre-production hardening required

**Status:** Pre-production hardening required. Not a Phase 7 blocker.

**Context:**
`DATABASE_URL` routes through Supabase's PgBouncer connection pooler in transaction
mode by default. Prisma `$transaction(async (tx) => { ... })` (interactive transactions)
requires that all statements in the callback run on the same physical connection.
In PgBouncer transaction mode, the pooler may hand a new connection to each
top-level transaction boundary, which means Prisma interactive transactions can silently
lose their atomicity guarantee: partial writes from a failed transaction callback may
commit instead of rolling back.

**Current state:**
The MVP / local-pilot flow works because:
- `DIRECT_URL` is set and used by Prisma Migrate (connection is direct, not pooled).
- Observed writes during Phase 7 testing committed correctly.
- Transaction traffic is low (one child, single-digit concurrency).

At low concurrency, PgBouncer transaction mode rarely reassigns the connection mid-transaction,
so failures are unlikely to manifest. The current pilot is safe.

**Pre-production requirement (before community rollout):**
For any route that uses `prisma.$transaction(...)` with multiple interdependent writes
— specifically `/api/quiz/submit` and any future reward/unlock routes —
choose **one** of the following before opening to concurrent public traffic:

**Option A (preferred for simplicity):**
Set the connection string used by Prisma client (at runtime, not just migrate-time) to
`DIRECT_URL` (a direct, non-pooled Postgres connection). This gives true interactive
transaction atomicity. Acceptable at pilot scale; evaluate connection limits before
community launch.

**Option B (preferred for scale):**
Restructure multi-write reward routes into safe non-interactive batch writes:
- Use `prisma.createMany` / `prisma.upsert` where possible.
- Make each write idempotent (e.g., upsert with a unique constraint rather than
  insert-then-update).
- Accept eventual consistency for streak/points if a request is retried — design
  for at-least-once delivery rather than exactly-once transactionality.

**Affected routes:**
- `POST /api/quiz/submit` — quiz_attempt + quiz_answers + points + topic_progress + card + badges + streak (all in one `$transaction`)
- `POST /api/guardian/[zoneId]/submit` — points + Legendary card + Guardian Slayer badge (all in one `$transaction`, added Phase 8)
- `POST /api/streak/shields/use` — single decrement (low risk, but not atomic with callers)

**Action required by:** before community rollout (Phase 12 gate or earlier).

---

## Phase 8A — Content Pipeline Activation Gate

**Status:** Active. Landed in parallel with Phase 8 (World Map) and Phase 9 (Parent Dashboard). It was scoped as a gate that would have sequenced *before* Phase 8 (see "Why this matters" below); in practice Phase 8 + 9 shipped while Phase 8A was being built. The substantive work is unchanged — pipeline activation is still the prerequisite for any content scaling beyond the current hand-seeded demo set.

> **Worker platform note:** Phase 8A was initially built with Railway as the deployment target. The subsequent worker platform decision (see below) selected Google Cloud Run + Cloud Tasks instead. The pipeline code and proxy routes are unchanged; only the deployment target differs. Do not set up a Railway project.

**Why this phase exists:**
The Phase-3 audit (see audit thread, May 2026) found that the FastAPI content pipeline (`services/content-pipeline/`) is feature-complete for Maths but has only ever run on `localhost`. No deployment, no `PIPELINE_SERVICE_URL` wiring in the Next.js app, no admin trigger, no proxy route. Every quiz question currently in production was produced by hand-written Prisma seed scripts (`seed-phase4.mjs`, `seed-phase6.mjs`, etc.) — the pipeline was bypassed.

This is acceptable at demo scale (2 topics, ~30 questions). It is **not** acceptable at MVP scale (~150–250 topics across Maths/English/Science Year 3 + Year 7). Hand-seeding does not scale, duplicates verifier logic into every seed script, and creates a content-process that any community rollout will outgrow within weeks.

**Why this matters now Phase 8 has shipped:**
The new World Map is currently sparse — it can only surface the two existing topics. Until the pipeline is activated, populating that map requires more hand-seeding, which deepens the technical debt rather than removing it. The intended sequence (*activate pipeline → generate breadth → design navigation on top*) is reversed, so Phase 8A's value is now "unblock content growth on the already-built map" rather than "unblock building the map".

**What Phase 8A does:**
1. Adds a server-only Next.js proxy at `/api/pipeline/{health,generate}` that reads `PIPELINE_SERVICE_URL` and fails closed (HTTP 503) when missing.
2. Adds a minimal admin trigger UI at `/dashboard/admin/pipeline` (middleware-gated to `role='admin'`; API also accepts `ADMIN_PIPELINE_TOKEN` header for curl).
3. Adds one new Year 3 Maths topic shell ("Addition and Subtraction", `is_published=false`) and one mapped `curriculum_outcome` row, for end-to-end pipeline proof. **No hand-written quiz content for this topic.**
4. Adds structured cost/token logging at both proxy and pipeline layers, capped at 10 questions per single trigger to prevent accidental bulk-generation cost.
5. Adds `scripts/verify-phase8a.mjs` to prove the activation gate is in place (static + DB + live checks).

**Direct Postgres requirement for the pipeline worker:**
The pipeline writes via multi-statement transactions (`db.write_question`, `db.bulk_upsert_chunks`). Supabase's pooled `PgBouncer` (port 6543) in transaction mode breaks multi-statement connections by handing different physical connections per statement. The pipeline worker's `DATABASE_URL` **must** therefore be the **direct** Supabase connection on port **5432**, NOT the same pooled URL the Vercel app uses. This applies regardless of which worker platform (Cloud Run or otherwise).

**Hand-seed scripts remain in place, not retired:**
The Phase 4/6/7 seed scripts continue to own the content they produced. Retiring them now would lose audit trail and re-running them is currently the only way to recover that content if the DB is reset before Phase 11 completes pipeline coverage for English/Science. They should be retired once the pipeline has produced equivalent or better content for every Phase 4–7 topic.

**Acceptance gate:**
- `scripts/verify-phase8a.mjs` passes (all static checks; DB + live checks SKIP cleanly when their env vars are absent).
- `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- The Phase 8A test topic, when generated through the pipeline, produces quiz_questions with non-null `confidence_score` and a terminal status of `staged` or `published`. (Hand-seeded rows have null `confidence_score` — this is the proof of provenance.)
- Existing child journeys (Multiplication Tables, Algebra: Solving Linear Equations) continue to work unchanged.

**Out of scope for Phase 8A:**
World Map UI, English verifier, Science verifiers, bulk generation, retiring legacy seed scripts, full admin dashboard.

---

## Worker platform — Google Cloud Run + Cloud Tasks

**Status:** Decided — migration pending. Do not deploy to Railway.  
**Date:** 2026-05-21  
**Full rationale:** docs/WORKER_PLATFORM_DECISION.md

**Decision:**  
The content pipeline (`services/content-pipeline/` — Python FastAPI) will run on **Google Cloud Run** with **Google Cloud Tasks** as the job queue. Railway (previously used in the Phase 8A prototype) is not selected as the permanent platform.

Vercel remains the Next.js app host. Supabase remains the system of record. No user-facing routes move to Cloud Run.

**Why not Railway:**
- No managed task queue with retry, dead-letter, and rate-limit semantics.
- Retry logic would have to live inside the FastAPI service rather than in the queue layer.
- Cost unpredictable for bursty batch workloads.
- No IAM-native auth between caller and service.

**Why Cloud Run + Cloud Tasks:**
- Same Dockerfile — zero code changes to the pipeline service.
- Cloud Tasks provides retry, backoff, dead-letter, and rate limiting out of the box (needed for Phase 12 regeneration queue and Anthropic rate limit management).
- Scales to zero; pay-per-invocation; max timeout 3600 s.
- IAM-native auth between Cloud Tasks and Cloud Run (no custom token needed).
- Supabase runs on GCP — minimal cross-cloud latency for DB writes.

**What must not move to Cloud Run:**
- Supabase Auth, PostgreSQL, RLS.
- Any user-facing Next.js route (`/api/quiz/submit`, guardian submit, parent dashboard, child routes).
- SM-2 scheduling, badge/card/streak logic — all remain in Vercel API routes.

**Vocabulary cleanup completed (2026-05-21):** All active Railway references updated to Cloud Run.
- ✅ `CLAUDE.md` §5 (tech stack table), §6 (env var comment), §9 (pipeline description)
- ✅ `docs/PHASE_8A_DEPLOYMENT.md` (rewritten as Cloud Run runbook)
- ✅ `services/content-pipeline/config.py` (env-loading comment)
- ✅ `services/content-pipeline/db.py` (docstring)
- ✅ `scripts/verify-phase8a.mjs` (LIVE layer header and SKIP message)
- ✅ `.env.local.example` (PIPELINE_SERVICE_URL comment)
- ✅ `docs/WORKER_PLATFORM_DECISION.md` (removed stale "Railway is a valid pilot option" line; added vocabulary rule)

**Remaining infrastructure work (not vocabulary):** Deploy Cloud Run service and configure Cloud Tasks queue before Phase 11. `PIPELINE_SERVICE_URL` env var name is unchanged — only the value (URL) changes.

**Family pilot interim position:** The pilot can proceed with locally-executed scripts. The 30 seeded questions and 30 cards are sufficient. Do not set up a Railway project.

**Action required by:** before Phase 11 (English + Science content generation). Phase 11 requires the pipeline service to be live and generating content.

---

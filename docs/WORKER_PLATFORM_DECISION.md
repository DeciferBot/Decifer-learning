# Worker Platform Decision — Google Cloud Run + Cloud Tasks

**Status:** Decided — migration pending  
**Supersedes:** Phase 8A Railway deployment runbook (docs/PHASE_8A_DEPLOYMENT.md) for any deployment work  
**Effective:** 2026-05-21

---

## What is the worker platform?

The content pipeline (`services/content-pipeline/`) is a Python FastAPI service that generates, verifies, and publishes quiz questions, Discovery Cards, and learn content. It runs the six-stage pipeline described in CLAUDE.md §9:

1. RAG generation (Anthropic Claude)
2. Code verification (SymPy / Pint / ChemPy / LanguageTool)
3. Consensus check (Claude at temperature 0)
4. Constitutional critique (Claude)
5. Semantic deduplication (pgvector cosine similarity)
6. Confidence scoring and DB write-back

This service is **not user-facing**. It is triggered by operator scripts, admin tooling, and (Phase 12) a nightly cron. It writes directly to Supabase PostgreSQL via a direct non-pooled connection, bypassing RLS and PgBouncer.

The "worker platform" is wherever this service runs.

---

## Why a dedicated worker platform is required

The pipeline cannot run inside Vercel (Next.js) for the following reasons:

| Constraint | Detail |
|---|---|
| Native Python dependencies | SymPy, Pint, ChemPy, LanguageTool, psycopg2, pgvector — these are native Python packages not available in a Node.js runtime |
| Job duration | A single question takes 10–60 seconds (six LLM + verifier stages). Content generation for one topic (15 questions × 3 tiers = 45 items) can run 10–45 minutes |
| Isolation | The pipeline holds a direct Postgres connection that bypasses RLS. This connection must never be on the same process as user-facing request handlers |
| Batch semantics | Content generation is not a request/response job — it is a batch process with retry logic, circuit breakers, and write-back. It fits a queue-worker pattern, not a serverless invocation pattern |

---

## Why Vercel is not the preferred long-term worker layer

Vercel Fluid Compute is the correct host for the Next.js application. It is not the right host for the pipeline worker, even though Vercel supports Python functions, for these reasons:

**Duration and pricing.** Vercel prices Fluid Compute on active CPU time. A 45-minute batch job (45 questions × ~60 s each) billed at CPU-active rates is expensive and unpredictable. Cloud Run bills on request time with per-request granularity and scales to zero between runs.

**No native queue.** Vercel Queues (public beta as of 2026-05) is a queue primitive but does not provide the dead-letter routing, per-task retry policies, or rate limiting that a content pipeline needs for safe at-most-N LLM calls per minute (Anthropic rate limit management).

**Shared failure domain.** If a long pipeline job exhausts Vercel function concurrency limits or triggers a cold-start cascade, it degrades the child-facing quiz routes that share the same Vercel project. The pipeline worker should have zero blast radius on user-facing latency.

**Startup cost.** The pipeline lazily initialises an Anthropic client and psycopg2 connection on first request. These are cheap to hold in a warm Cloud Run container and expensive to re-create on every Vercel invocation.

**Singleton not needed at Vercel.** Vercel is designed for stateless, concurrent invocations. The pipeline benefits from a warm singleton (shared DB pool, reused Anthropic client, pgvector index in memory) — the Cloud Run container model provides this naturally.

---

## Why Railway was considered but not selected

Railway was the initial candidate because it has excellent developer experience: push a Dockerfile, get a URL, inject env vars from a dashboard. That is sufficient for a family pilot.

The decision to move away from Railway is based on the following:

**No managed queue primitive.** Railway runs a persistent server (always-on or sleep-on-idle). There is no built-in task queue with retry, dead-letter, or rate-limit semantics. For Phase 12 (nightly anomaly detection + regeneration queue), we would have to build our own retry loop inside the FastAPI service — which is what Cloud Tasks eliminates.

**Retry semantics live in the wrong layer.** The pipeline already has a circuit breaker (`MAX_PIPELINE_CYCLES = 5`). On Railway, if the process crashes mid-batch, the job is lost. With Cloud Tasks, the task is re-enqueued automatically up to the configured retry count, with exponential backoff.

**Cost unpredictability at batch scale.** Railway's usage-based pricing is easy to reason about for an always-on API server. It is harder to predict for bursty batch workloads (e.g., generating 200 questions for a new subject in one run). Cloud Run + Cloud Tasks is pay-per-invocation with a natural rate limit enforced by the queue.

**Vendor lock-in surface.** Railway is a smaller platform. GCP is enterprise-grade with documented SLAs and a large ecosystem. Supabase (PostgreSQL) already runs on GCP infrastructure; keeping the worker on GCP minimises cross-cloud latency for DB writes.

**No IAM-native auth.** Railway authentication is API-key-based. Cloud Tasks authenticates to Cloud Run via a GCP service account and OIDC token — no long-lived secrets to rotate.

Railway remains a valid option for the family pilot if deployment is needed before the Cloud Run migration is complete. It must not be set up as a permanent platform.

---

## Why Google Cloud Run + Cloud Tasks is selected

**Cloud Run** is a fully managed container platform on GCP. Key properties:

- Same Dockerfile — zero code changes to the pipeline service
- Scales to zero when idle (no idle cost between generation runs)
- Max request timeout: 3600 seconds (enough for any foreseeable batch job)
- Minimum instances: 0 for cost; 1 if warm start latency matters
- CPU and memory configurable per service (relevant for SymPy + LanguageTool)
- Ingress control: allow only Cloud Tasks (internal-only ingress) — no public endpoint needed
- Secrets via GCP Secret Manager — no env var dashboards to manage manually

**Cloud Tasks** is GCP's managed task queue. Key properties:

- Per-task retry policy with exponential backoff and max attempts
- Dead-letter queue routing to a separate queue or Pub/Sub topic
- Rate limiting: configurable max dispatches per second (respects Anthropic rate limits)
- Task deduplication: task IDs prevent double-queuing on client retry
- No polling — Cloud Tasks pushes to Cloud Run over HTTPS
- IAM auth: Cloud Tasks signs requests with a service account OIDC token, Cloud Run verifies — no custom `PIPELINE_ADMIN_TOKEN` needed for inter-service auth

**Combined pattern:**

```
Operator script / Phase 12 cron
        │
        ▼
  Cloud Tasks queue        (retry, rate limit, dead-letter)
        │  HTTPS + OIDC
        ▼
  Cloud Run (FastAPI)      (pipeline stages 1–6, writes to Supabase)
        │  direct Postgres
        ▼
  Supabase PostgreSQL      (quiz_questions, card_catalog, learn_content)
```

The Vercel Next.js app is never in this path. The child-facing quiz routes continue to read from Supabase directly and are unaffected by any pipeline activity.

---

## Platform boundary map

| Platform | Role | What runs here |
|---|---|---|
| **Vercel** | Main app host | Next.js App Router — all user-facing routes, SSR, child/parent/admin API routes, middleware, PWA service worker |
| **Supabase** | System of record | PostgreSQL + pgvector, Supabase Auth (auth.users), Supabase Storage, RLS policies, pg_cron (Phase 12 cron trigger) |
| **Google Cloud Run** | Worker | Python FastAPI pipeline service — RAG generation, verification, confidence scoring, DB write-back |
| **Google Cloud Tasks** | Job queue | Task dispatch for content generation jobs — retry, rate limit, dead-letter |
| **GCP Secret Manager** | Secrets | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL` (direct) for the pipeline service |
| **Resend** | Transactional email | Password reset, magic-link, parent invite emails |
| **Cloudflare** | DNS / CDN | DNS delegation for the production domain; CDN caching of static assets (optional) |

---

## What must NOT move to Cloud Run

The following must remain on their current platforms regardless of the migration:

| Component | Must stay on | Reason |
|---|---|---|
| Auth (Supabase Auth) | Supabase | Auth.users is managed by Supabase; moving auth is a full replatform |
| PostgreSQL / pgvector | Supabase | System of record; all app and pipeline code points here |
| Child quiz routes (`/api/quiz/submit`) | Vercel | User-facing, low-latency, must not share failure domain with batch worker |
| Parent dashboard routes | Vercel | User-facing SSR |
| Guardian submit (`/api/guardian/[zoneId]/submit`) | Vercel | User-facing |
| Streak, badge, card drop logic | Vercel API routes | User-facing game state |
| SM-2 scheduling (`lib/sm2.ts`) | Vercel / DB | Computed at quiz submit time, not a background job |
| RLS enforcement | Supabase | Enforced at DB level; moving the app cannot weaken this |
| PWA service worker | Vercel | Served as a static asset from Next.js |

---

## What changes when the migration happens

These are the exact changes needed. None of these are implemented now.

### Code changes (zero)

The Dockerfile, `main.py`, `pipeline.py`, `verifiers/`, `db.py`, and `config.py` require **no changes**. Cloud Run runs the same container image as Railway would.

### Configuration changes (pipeline service)

`services/content-pipeline/config.py` — update the env-loading comment:

```python
# Railway injects real values as OS env  →  GCP Secret Manager / Cloud Run env panel
```

`services/content-pipeline/db.py` — update the docstring:

```python
# This is the pipeline service running on Railway  →  ...running on Cloud Run
```

### Script changes

`scripts/verify-phase8a.mjs` — the LIVE layer header and SKIP message mention Railway by name. Update to be platform-agnostic:

```
'LIVE — Railway pipeline service health'  →  'LIVE — pipeline service health'
'deploy to Railway then re-run'           →  'deploy to Cloud Run then re-run'
```

### Environment variable changes (zero new vars)

`PIPELINE_SERVICE_URL` remains the single variable pointing to the pipeline base URL. On Cloud Run, this becomes the Cloud Run service URL (e.g. `https://decifer-pipeline-xxxx-ew.a.run.app`). The variable name and usage are unchanged.

`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL` for the pipeline service move from Railway Variables to GCP Secret Manager. Same keys, different secret store.

No new env vars are introduced.

### CLAUDE.md changes

CLAUDE.md §5 tech stack table must be updated:

```
| Computation hosting | Railway |   →   | Google Cloud Run |
```

CLAUDE.md §6 env var table comment on `PIPELINE_SERVICE_URL`:

```
# Python FastAPI URL on Railway  →  # Python FastAPI URL on Cloud Run
```

CLAUDE.md §9 pipeline description:

```
Lives at services/content-pipeline/ (Python FastAPI on Railway)
→  Lives at services/content-pipeline/ (Python FastAPI on Google Cloud Run + Cloud Tasks)
```

### Docs changes

`docs/PHASE_8A_DEPLOYMENT.md` — replace entirely with a Cloud Run deployment runbook (to be written when the migration happens). The current Railway runbook is superseded by this decision document.

`docs/POST_MERGE_INTEGRATION_PROOF.md` — historical record; no changes needed (it accurately records the state at merge time).

---

## Migration steps (when ready to implement)

1. **Create GCP project** — enable Cloud Run API, Cloud Tasks API, Artifact Registry, Secret Manager API.
2. **Push secrets** — store `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL` (direct Postgres URL) in Secret Manager.
3. **Build image** — `docker build -t gcr.io/<project>/decifer-pipeline:latest services/content-pipeline/`
4. **Push to Artifact Registry** — `docker push gcr.io/<project>/decifer-pipeline:latest`
5. **Deploy Cloud Run service** — `gcloud run deploy decifer-pipeline --image ... --allow-unauthenticated=false --ingress=internal --timeout=3600`
6. **Create Cloud Tasks queue** — `gcloud tasks queues create content-pipeline --location=<region>`. Configure `--max-dispatches-per-second` to respect Anthropic rate limits.
7. **Create service account** for Cloud Tasks → Cloud Run invocation, bind `roles/run.invoker`.
8. **Set `PIPELINE_SERVICE_URL`** to the Cloud Run service URL in `.env.local` and Vercel project env.
9. **Update `docs/PHASE_8A_DEPLOYMENT.md`** to reflect Cloud Run steps.
10. **Update minor comments** in `config.py`, `db.py`, `verify-phase8a.mjs`.
11. **Update CLAUDE.md §5, §6, §9** to remove Railway references.
12. **Re-run `verify-phase8a.mjs`** — all three layers must pass before any content generation.

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Cloud Run cold start latency | Low | Pipeline is not user-facing; operator scripts can tolerate 2–5 s cold start. Set `min-instances=1` if warm latency matters |
| Cloud Tasks retry storms on Anthropic rate limit | Medium | Set `--max-dispatches-per-second` on the queue to stay under the Anthropic API rate limit. Use `429` response to trigger Cloud Tasks backoff |
| Larger GCP IAM surface | Low | One Cloud Run service, one Cloud Tasks queue, one service account. IAM is simpler than managing API tokens |
| `DATABASE_URL` in GCP Secret Manager | Low | Same secret as today; just moved from Railway Variables to Secret Manager. Access limited to the Cloud Run service account |
| Migration window | None | Current pilot is not yet live (LIVE layer not activated). Migration can happen before any Railway deployment is made — zero downtime, zero migration risk |

---

## Family pilot interim position

The family pilot can proceed using operator-driven local script execution (`node --env-file=.env.local scripts/generate-content.ts`) until Cloud Run is deployed. The pipeline service does not need to be deployed anywhere to run the pilot — content has already been seeded (30 published questions, 30 cards). New content generation is needed only for Phase 11 (English + Science).

Do not deploy to Railway. Do not set up a Railway project.

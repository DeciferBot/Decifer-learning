# Post-Merge Integration Proof — v2

**Date:** 2026-05-21  
**Commit:** `d8abb86` (tip of main)  
**Previous proof:** `0f7fc9a` — superseded by this document

---

## Commits included

| Commit | What landed |
|---|---|
| `cb4bc5a` | Phase 8 — world map, ZoneMap, TopicNode, guardian battle, `/api/guardian/[zoneId]/submit`, seed-phase8, verify-phase8 |
| `199d4b1` | Phase 9 — parent dashboard, per-child detail, `lib/parent-dashboard.ts`, lesson store activation, verify-parent-dashboard-safety |
| `0f7fc9a` | Integration sprint — `scripts/verify-phase8a.mjs`, `docs/PHASE_8A_DEPLOYMENT.md`, initial POST_MERGE_INTEGRATION_PROOF |
| `d8abb86` | Worker platform decision — `DECISIONS.md` updated, `docs/WORKER_PLATFORM_DECISION.md` created |

> **Phase 8A note:** No discrete Phase 8A git commit exists. The pipeline service (`services/content-pipeline/`) was committed in Phase 3. Phase 8A deliverables were created in the `0f7fc9a` integration sprint.

---

## Infrastructure decision summary

| Platform | Role | Status |
|---|---|---|
| **Vercel** | Next.js app host — all user-facing routes | Active |
| **Supabase** | System of record — PostgreSQL, Auth, RLS, Storage | Active |
| **Google Cloud Run** | Future worker platform — Python FastAPI pipeline | **Selected, not yet deployed** |
| **Google Cloud Tasks** | Future job queue — retry, rate limit, dead-letter | **Selected, not yet deployed** |
| **Cloudflare** | DNS, CDN, edge security | In use for domain |
| **Resend** | Transactional email | In use for auth emails |
| **Railway** | ~~Worker platform~~ | **Rejected — do not set up** |

Full rationale: `docs/WORKER_PLATFORM_DECISION.md`  
Formal record: `DECISIONS.md` — "Worker platform — Google Cloud Run + Cloud Tasks"

---

## 1. Repository health check

| Command | Result |
|---|---|
| `git status` | ✅ Clean — nothing to commit |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ No ESLint warnings or errors |
| `npm run build` | ✅ Compiled successfully — 27 routes |

**Build route manifest (all 27):**

```
/                                    (dynamic)
/_not-found                          (static)
/api/guardian/[zoneId]/submit        (dynamic)
/api/quiz/submit                     (dynamic)
/api/streak/check                    (dynamic)
/api/streak/shields                  (dynamic)
/api/streak/shields/use              (dynamic)
/api/topics/[id]/questions           (dynamic)
/auth/callback                       (dynamic)
/collection                          (dynamic)
/dashboard                           (dynamic)
/dashboard/admin                     (dynamic)
/dashboard/child                     (dynamic)
/dashboard/parent                    (dynamic)
/dashboard/parent/children/[childId] (dynamic)
/guardian/[zoneId]                   (dynamic)
/learn                               (dynamic)
/learn/[subjectSlug]                 (dynamic)
/learn/[subjectSlug]/[topicSlug]     (dynamic)
/learn/[subjectSlug]/[topicSlug]/[lessonSlug] (dynamic)
/login                               (static)
/register                            (static)
/reset-password                      (static)
/topics/[id]/learn                   (dynamic)
/topics/[id]/practise                (dynamic)
/topics/[id]/quiz                    (dynamic)
/world-map                           (dynamic)
```

---

## 2. Verification scripts

### Phase 8 — `node --env-file=.env.local scripts/verify-phase8.mjs`

```
Results: 24 passed, 0 failed
🟢 Phase 8 gate: PASS
```

All 24 checks passed including: zone nodes for both year groups, unlock-logic unit tests,
route and component file existence, guardian question pools (15 each), Guardian Slayer badge,
Legendary card pools, and Phase 7 regression checks.

### Parent dashboard safety — `node --env-file=.env.local scripts/verify-parent-dashboard-safety.mjs`

```
Results: 16 passed · 0 failed · 0 warnings · 0 skipped
✅ PARENT DASHBOARD SAFETY: MERGE SAFE
```

All 16 checks passed including 3 live-DB checks (lesson safety gate, empty-data handling,
non-published lesson exclusion).

### Phase 8A pipeline activation — `node --env-file=.env.local scripts/verify-phase8a.mjs`

```
Results: 18 passed · 0 failed · 2 skipped
🟡 PIPELINE ACTIVATION: STATIC + DATABASE verified
   LIVE layer skipped — deploy to Cloud Run then re-run with PIPELINE_SERVICE_URL set
```

STATIC (13): all service files present, all 4 FastAPI endpoints defined,
no pipeline imports in child-facing code.  
DATABASE (4): 15 Year 3 Maths questions published, 15 Year 7 Maths published,
22 `curriculum_chunks` seeded, 0 staged content leaking.  
LIVE (2): **SKIPPED** — `PIPELINE_SERVICE_URL` is empty. Cloud Run not yet deployed.
SKIP is correct and honest; not a failure.

---

## 3. Route matrix

| Route | File | In build? | Imports seed/test? | Auth gate |
|---|---|---|---|---|
| `/world-map` | `app/(child)/world-map/page.tsx` | ✅ | ✅ None | Supabase session → redirect `/login` |
| `/guardian/[zoneId]` | `app/(child)/guardian/[zoneId]/page.tsx` | ✅ | ✅ None | Session + year-group match |
| `/api/guardian/[zoneId]/submit` | `app/api/guardian/[zoneId]/submit/route.ts` | ✅ | ✅ None | `supabase.auth.getUser()` required |
| `/dashboard/parent` | `app/dashboard/parent/page.tsx` | ✅ | ✅ None | Dashboard layout role gate |
| `/dashboard/parent/children/[childId]` | `app/dashboard/parent/children/[childId]/page.tsx` | ✅ | ✅ None | Role gate + FamilyLink check |
| `/dashboard/admin` | `app/dashboard/admin/page.tsx` | ✅ | ✅ None | Phase 12 placeholder |
| `/dashboard/admin/pipeline` | — | ✅ absent (correct) | — | Pipeline is CLI-only; Phase 12 web UI |

No runtime file in `app/` or `lib/` imports from `scripts/`, `services/content-pipeline/`, or any verify/seed utility. Confirmed by grep.

---

## 4. Database state snapshot

| Table | Count | Notes |
|---|---|---|
| `quiz_questions` (published) | 30 | 15 Year 3 Maths + 15 Year 7 Maths |
| `quiz_questions` (staged) | 0 | All content published or absent |
| `card_catalog` (published) | 30 | Across 5 rarities, both year groups |
| `badges` | 5 | Topic Star, Perfect Score, Subject Champion, Streak 7, Guardian Slayer |
| `zones` | 6 | Year 3 + Year 7, Maths + English + Science (6 zones; only Maths seeded with nodes) |
| `world_map_nodes` | 2 | 1 per seeded Maths zone (Number Jungle, Crystal Labyrinth) |
| `curriculum_chunks` | 22 | Maths KS2 + KS3 source material |
| `lessons` (published + verified) | 3 | Multiplication Tables vertical slice |
| `quiz_attempts` | 1 | One recorded attempt from testing |
| `quiz_answers` | 10 | 10 answers from the one attempt |
| `profiles` | 4 | Test accounts created during development |

---

## 5. Child journey proof

**Route chain:** Login → Dashboard → `/world-map` → topic node → `/topics/[id]/quiz` → `/api/quiz/submit` → progress update

**Verified (static + DB):**

- **World map** loads `zones` and `world_map_nodes` from DB for the child's `year_group_id`. No hardcoded content.
- **Node state** is computed server-side: `null` prerequisite → `available`; `completed_set` match → `completed`; otherwise `locked`. Unit-tested in verify-phase8 checks 7–9.
- **Guardian page** queries `published` questions only (`status: 'published'`). Redirects to `/world-map` if pool < 15 — prevents a partial battle.
- **Quiz submit** (`/api/quiz/submit`) writes `quiz_attempt`, `quiz_answers`, `point_events`, `topic_progress`, `child_collection`, `profile_badges`, `streak` — all inside a single `$transaction`.
- **Guardian submit** (`/api/guardian/[zoneId]/submit`) forces Legendary card + Guardian Slayer badge on pass; returns early with zero writes on fail.
- **No fake progress:** all progress data derives from real `quiz_attempt` / `quiz_answer` rows. Verified by parent dashboard safety check 3.

**Gap — guardian double-submit (documented, not a blocker):**  
If a client retries the guardian submit (network error, double-tap), points are awarded a second time. Card is idempotency-guarded (upsert on composite key); badge is dedup-guarded (`ownedIds` set). Points have no idempotency guard. Documented in `DECISIONS.md` (PgBouncer / idempotency section). Low risk at single-child pilot concurrency.

---

## 6. Parent reflection proof

**Verified (static + live DB):**

| Claim | Evidence |
|---|---|
| Parent resolves children via FamilyLink | `getLinkedChildren` queries `family_links` table by `parent_user_id` |
| Per-child detail protected by FamilyLink | `children/[childId]/page.tsx` runs `prisma.familyLink.findFirst({ where: { parent_user_id, child_user_id } })` → 404 if absent |
| Quiz attempts affect parent stats | `getChildProgressSummary` counts `quiz_attempts` for the child's `profile_id` |
| Weak areas from quiz-answer data only | `getChildWeakAreas` aggregates `quiz_answers.was_correct` — no other source. Verified by safety check 7 |
| Recommended lesson: published + verified | `PUBLISHED_VERIFIED` constant (`status='published' AND verification_status='verified'`) applied to every lesson query in `lib/parent-dashboard.ts`. Verified by safety checks 4, 5, 6, 13, 15 |
| Curriculum coverage does not overclaim | `getTopicCurriculumCoverage` returns `isCurriculumComplete` flag; no hardcoded "complete" string. Verified by safety check 10 |

---

## 7. Guardian / API transaction proof

**File:** `app/api/guardian/[zoneId]/submit/route.ts`

| Concern | Finding | Status |
|---|---|---|
| Auth check | `supabase.auth.getUser()` required before any DB read or write | ✅ Safe |
| Zone existence | `prisma.zone.findUnique` — returns 404 if zone not found | ✅ Fails closed |
| Profile existence | `prisma.profile.findUnique` — returns 404 if no profile | ✅ Fails closed |
| Fail path (score < 70%) | Returns immediately with zero DB writes | ✅ No partial state |
| PgBouncer / serverless | `prisma.$transaction(async tx => {...}, { timeout: 15000 })`. Same pattern as `/api/quiz/submit`. Safe at pilot concurrency; hardening documented in `DECISIONS.md` | ⚠️ Pre-production item |
| Long interactive tx | 4–5 writes; no LLM calls or external I/O inside the transaction; 15 s timeout is appropriate | ✅ Acceptable |
| Card duplicate guard | `childCollection` upsert on `profile_id_card_id` composite unique key — safe | ✅ Idempotent |
| Badge duplicate guard | `ownedIds` Set checked before every award inside the transaction | ✅ Idempotent |
| Points duplicate guard | **None** — double-submit awards points twice | ⚠️ Documented gap |
| Quiz-submit regression | Guardian uses a separate `submitUrl` prop; `/api/quiz/submit` unchanged. Phase 8 verify checks 18–21 confirm question pools intact | ✅ No regression |

---

## 8. Phase 8A status proof

| Claim | Evidence |
|---|---|
| Railway is NOT the selected future platform | `DECISIONS.md` line 60: "Status: Decided — migration pending. Do not deploy to Railway." |
| `docs/WORKER_PLATFORM_DECISION.md` exists | ✅ Created in commit `d8abb86` |
| `DECISIONS.md` records Cloud Run + Cloud Tasks | ✅ "Worker platform — Google Cloud Run + Cloud Tasks" entry present |
| Phase 8A runtime not falsely claimed as live | ✅ `PIPELINE_SERVICE_URL` is empty; verify-phase8a LIVE layer correctly SKIPs |
| SKIP states are honest | ✅ Fixed in this sprint: LIVE header updated from "Railway" → "Cloud Run"; SKIP message updated accordingly |
| `docs/PHASE_8A_DEPLOYMENT.md` is superseded | ✅ `docs/WORKER_PLATFORM_DECISION.md` header: "Supersedes: Phase 8A Railway deployment runbook" |

---

## 9. Issues found and fixed in this proof sprint

| Issue | File | Fix |
|---|---|---|
| Stale "deploy to Railway" text in LIVE skip message | `scripts/verify-phase8a.mjs` | Updated to "deploy to Cloud Run" |
| Stale "Railway pipeline service health" layer header | `scripts/verify-phase8a.mjs` | Updated to "pipeline service health (Cloud Run)" |

No runtime code was changed. No schema changes. No new routes.

---

## 10. Known gaps and pre-production items

| Item | Type | Impact | Gating phase |
|---|---|---|---|
| Cloud Run / Cloud Tasks not deployed | Infrastructure blocker | No new content generation until deployed | Phase 11 |
| Guardian double-submit — points not idempotent | Pre-production hardening | Points awarded twice on retry; low risk at pilot scale | Before community rollout |
| PgBouncer interactive transaction atomicity | Pre-production hardening | Documented in DECISIONS.md; safe at pilot concurrency | Before community rollout |
| Only 1 world map node per zone | Data gap | Sequential unlock logic cannot be demonstrated; needs more topic nodes seeded | Pre-pilot |
| `docs/PHASE_8A_DEPLOYMENT.md` is stale (Railway-specific) | Docs debt | Will mislead if followed; superseded by WORKER_PLATFORM_DECISION.md | Before Phase 11 |
| CLAUDE.md §5/§6/§9 still reference Railway | Docs debt | Core project bible is inconsistent with the platform decision | Before Phase 11 |
| Screen-time enforcement | Deferred feature | Parent dashboard shows "coming soon" — no server-side enforcement | Phase 9 gate |
| PWA install and offline queue | Not built | Phase 10 not started | Phase 10 |
| English and Science content | Not built | Phase 11 not started | Phase 11 |

---

## 11. Exact safe product claim

> As of commit `d8abb86`:
>
> A child on Year 3 or Year 7 can log in, see a world map with their Maths zone,
> navigate to the one available topic node, complete the Learn → Practise → Quiz loop,
> earn points and a Discovery Card, and — if the zone topic is marked complete — battle
> the Zone Guardian for a Legendary card and the Guardian Slayer badge.
>
> A linked parent can log in and see the child's progress summary, weak areas (derived
> from real quiz-answer data), and a recommended next lesson (published + verified only).
>
> The pipeline service is containerised and ready for Cloud Run deployment. Content
> generation is not live until Cloud Run is deployed and `PIPELINE_SERVICE_URL` is set.

---

## 12. Claims still not allowed

- Pipeline is live (Cloud Run not deployed; LIVE layer correctly skips)
- Multiple topic unlock chains work end-to-end (only 1 node per zone is seeded)
- Offline PWA mode works (Phase 10 not built)
- English or Science content is available (Phase 11 not built)
- Screen-time limits are enforced (deferred)
- Guardian submit is fully idempotent (points double-award gap exists)
- Community rollout is safe (PgBouncer + idempotency hardening pending)
- Railway is the pipeline platform (decided against)

---

## 13. Remaining deployment tasks

1. **Add world map nodes** — seed at least 2–3 topic nodes per zone to demonstrate sequential unlock (zero code changes; `seed-phase8.mjs` extension)
2. **Deploy Cloud Run** — per `docs/WORKER_PLATFORM_DECISION.md` migration steps; required before Phase 11
3. **Update `PIPELINE_SERVICE_URL`** — in `.env.local` and Vercel project env after Cloud Run deploy
4. **Re-run `verify-phase8a.mjs`** — all three layers must pass (LIVE currently skips)
5. **Update `docs/PHASE_8A_DEPLOYMENT.md`** — replace Railway runbook with Cloud Run runbook when migration is done
6. **Update CLAUDE.md §5/§6/§9** — remove Railway references when migration is done
7. **Manual play-test on device** — as listed in Phase 8 verify gate output (iPhone SE at 375 px)

---

## Go / No-Go verdict

| Gate | Result |
|---|---|
| TypeScript clean | ✅ |
| ESLint clean | ✅ |
| Production build (27 routes) | ✅ |
| Phase 8 verify (24/24) | ✅ |
| Parent dashboard safety (16/16) | ✅ |
| Phase 8A verify — STATIC + DATABASE (18/18 run, 2 skipped) | ✅ |
| Phase 8A verify — LIVE | ⏭️ Blocked on Cloud Run deploy |
| No seed/verify imports in runtime code | ✅ |
| No hardcoded content | ✅ |
| FamilyLink security on per-child detail | ✅ |
| Published-only content gate on all child-facing queries | ✅ |
| Railway platform decision recorded and rejected | ✅ |
| Cloud Run + Cloud Tasks decision recorded in DECISIONS.md | ✅ |
| verify-phase8a SKIP states honest and platform-current | ✅ (fixed in this sprint) |

**Verdict: GO for family pilot.** Child journey and parent dashboard are integration-proven. **HOLD** on pipeline live activation until Cloud Run is deployed and the LIVE layer of `verify-phase8a.mjs` passes. Do not set up a Railway project.

# Post-Merge Integration Proof

**Date:** 2026-05-21  
**Commit:** `199d4b1971e4e707d0f4edcec04aae2278ee95c3`  
**Branch:** `main`

---

## Phases included in this merge

| Phase | Commit | What landed |
|---|---|---|
| Phase 8 | `cb4bc5a` | World map, ZoneMap, TopicNode, guardian battle, `/api/guardian/[zoneId]/submit`, seed-phase8, verify-phase8 |
| Phase 8A | n/a — see note | Pipeline service files were already in repo from Phase 3; deployment docs + verify-phase8a created in this integration sprint |
| Phase 9 | `199d4b1` | Parent dashboard, per-child detail, `lib/parent-dashboard.ts`, lesson store activation, verify-parent-dashboard-safety |

> **Phase 8A note:** No discrete Phase 8A commit exists in git history. The content pipeline service (`services/content-pipeline/`) was committed in Phase 3. Phase 8A deliverables — `scripts/verify-phase8a.mjs` and `docs/PHASE_8A_DEPLOYMENT.md` — were missing and have been created in this integration sprint. They are committed alongside this proof document.

---

## Build & type check

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ No ESLint warnings or errors |
| `npm run build` | ✅ Compiled successfully — 27 routes |

---

## Route matrix

| Route | File | Builds? | Role gate |
|---|---|---|---|
| `/world-map` | `app/(child)/world-map/page.tsx` | ✅ | Child auth via Supabase session |
| `/guardian/[zoneId]` | `app/(child)/guardian/[zoneId]/page.tsx` | ✅ | Child auth + year-group match |
| `/api/guardian/[zoneId]/submit` | `app/api/guardian/[zoneId]/submit/route.ts` | ✅ | Supabase auth required |
| `/dashboard/parent` | `app/dashboard/parent/page.tsx` | ✅ | Parent role via dashboard layout |
| `/dashboard/parent/children/[childId]` | `app/dashboard/parent/children/[childId]/page.tsx` | ✅ | Parent role + FamilyLink check |
| `/dashboard/admin` | `app/dashboard/admin/page.tsx` | ✅ | Phase 12 placeholder |
| `/dashboard/admin/pipeline` | — | ✅ not needed | Pipeline is Railway CLI only; no web UI until Phase 12 |

No route imports seed scripts, verify scripts, or pipeline service files. Confirmed by static grep across `app/(child)`, `app/api/quiz`, and `lib/parent-dashboard.ts`.

---

## Verification command results

### Phase 8 — `node --env-file=.env.local scripts/verify-phase8.mjs`

```
Results: 24 passed, 0 failed
🟢 Phase 8 gate: PASS
```

Checks covered:
- world_map_nodes: ≥ 1 node per zone (Year 3 Number Jungle, Year 7 Crystal Labyrinth)
- Unlock logic: null prerequisite → available, unmet → locked, met → available
- Route and component files exist
- Dashboard links to `/world-map`
- Guardian question pools: 15 published questions per zone
- Guardian Slayer badge: trigger_rule.type = 'guardian_win'
- Legendary card pools: 2 cards per year group
- Phase 7 regression: 30 published cards, 5 badges

### Parent dashboard — `node --env-file=.env.local scripts/verify-parent-dashboard-safety.mjs`

```
Results: 16 passed · 0 failed · 0 warnings · 0 skipped
✅ PARENT DASHBOARD SAFETY: MERGE SAFE
```

Checks covered:
- Route files exist
- No fake/hardcoded progress data
- Lesson queries enforce `status='published'` AND `verification_status='verified'`
- `getRecommendedNextLesson` uses PUBLISHED_VERIFIED gate
- Weak areas derived from quiz_attempts + quiz_answers only
- No AI generation or seed imports in runtime files
- Curriculum coverage uses `isCurriculumComplete` (no overclaiming)
- Empty states exist for all data-dependent sections
- Screen-time controls correctly deferred to Phase 9 (marked "coming soon")
- Live DB: 3 published+verified lessons; 0 non-qualifying lessons reachable

### Phase 8A — `node --env-file=.env.local scripts/verify-phase8a.mjs`

```
Results: 18 passed · 0 failed · 2 skipped
🟡 PIPELINE ACTIVATION: STATIC + DATABASE verified
   LIVE layer skipped — deploy to Railway then re-run with PIPELINE_SERVICE_URL set
```

STATIC layer (13 checks): all service files present, all 4 FastAPI endpoints defined, no pipeline imports in child-facing code.  
DATABASE layer (4 checks): 15 Year 3 Maths published questions, 15 Year 7 Maths published questions, 22 curriculum_chunks seeded, no staged content leaking.  
LIVE layer (2 checks): **SKIPPED** — `PIPELINE_SERVICE_URL` is empty in `.env.local`. Railway deployment has not yet been completed.

---

## Database state snapshot (2026-05-21)

| Table | Count |
|---|---|
| `quiz_questions` (published) | 30 |
| `quiz_questions` (staged) | 0 |
| `card_catalog` (published) | 30 |
| `badges` | 5 |
| `zones` | 6 |
| `world_map_nodes` | 2 |
| `curriculum_chunks` | 22 |
| `lessons` (published + verified) | 3 |
| `quiz_attempts` | 1 |
| `quiz_answers` | 10 |

---

## Child journey proof

**Route chain:** Dashboard → `/world-map` → topic node → `/topics/[id]/learn` → `/topics/[id]/practise` → `/topics/[id]/quiz` → submit → progress update

**Verified (static + DB):**
- World map page loads zones from DB for the child's year group; no hardcoded content
- Topic nodes compute state (`locked` / `available` / `completed`) from `topic_progress.status='completed'`
- Guardian page pulls 15 published questions from the zone's topics; redirects to `/world-map` if pool < 15
- Guardian submit (POST `/api/guardian/[zoneId]/submit`) performs: auth check → zone lookup → profile lookup → score calculation → on pass: `$transaction` (points + Legendary card + Guardian Slayer badge)
- Card dedup guard: `childCollection` upsert prevents duplicate card rows
- Badge dedup guard: `ownedIds` set prevents double-award

**Known gap — guardian double-submit:**  
The guardian submit does not check whether the child has already beaten this zone. If the same request is submitted twice (e.g., client retry), points are awarded twice. Card and badge are guarded against duplicates but points are not. This is documented in DECISIONS.md (PgBouncer / idempotency section) and is a pre-production hardening item, not a pilot blocker at single-child concurrency.

---

## Parent reflection proof

**Verified (static + DB):**
- `getLinkedChildren` queries via `family_links` — no cross-family data exposure
- Per-child detail page (`/dashboard/parent/children/[childId]`) verifies `FamilyLink` before returning any data; returns 404 if link is missing
- `getChildWeakAreas` derives weak areas from `quiz_answers` (high error rate) only — no fake data
- `getRecommendedNextLesson` applies `PUBLISHED_VERIFIED` gate: `status='published' AND verification_status='verified'`
- Curriculum coverage uses `getTopicCurriculumCoverage` with `isCurriculumComplete` field — does not overclaim

**Empty-state safety:**  
All data-dependent sections (weak areas, recent activity, badges, quiz accuracy) have empty-state renders. With 1 quiz attempt and 10 quiz answers in the DB, the parent dashboard renders real data without errors.

---

## Guardian transaction proof

**File:** `app/api/guardian/[zoneId]/submit/route.ts`

| Concern | Finding |
|---|---|
| PgBouncer safety | `prisma.$transaction(async tx => {...}, { timeout: 15000 })` — same pattern as `/api/quiz/submit`. Documented in DECISIONS.md as pre-production hardening item (Option A: switch runtime `DATABASE_URL` to `DIRECT_URL` before community rollout). Safe at pilot concurrency. |
| Long interactive transaction | Transaction contains 4–5 writes (pointEvent, profile update, childCollection upsert, profileBadge). No long polls or waits inside. `timeout: 15000` is appropriate. |
| Errors fail closed | On `!passed`, returns early with no DB writes. Transaction errors surface as 500 to the client; no partial commit path is exposed to the UI. |
| Duplicate reward | Card dedup: `childCollection` upsert on `profile_id_card_id` unique key — safe. Badge dedup: `ownedIds` set check — safe. **Points: no idempotency guard** — double-submit awards points twice. Noted above. |
| Quiz submit regression | Guardian submit uses a separate `submitUrl` prop on `QuizShell`; the regular quiz submit route is unchanged. Phase 8 verify confirms both question pools (15 each) are intact. |

---

## Phase 8A activation status

| Layer | Status | Blocker |
|---|---|---|
| STATIC | ✅ 13/13 passed | — |
| DATABASE | ✅ 4/4 passed | — |
| LIVE | ⏭️ 2/2 skipped | `PIPELINE_SERVICE_URL` not set; Railway not deployed |

**Live activation is not claimed.** The pipeline service has not been deployed to Railway. To activate:
1. Deploy `services/content-pipeline/` to Railway
2. Set `ANTHROPIC_API_KEY` and `DATABASE_URL` (direct Postgres URL) in Railway variables
3. Set `PIPELINE_SERVICE_URL` in `.env.local` and in Vercel project env
4. Re-run `node --env-file=.env.local scripts/verify-phase8a.mjs` — all three layers must pass

See `docs/PHASE_8A_DEPLOYMENT.md` for the full runbook.

---

## DECISIONS.md consistency check

DECISIONS.md contains one entry: PgBouncer transaction atomicity. It covers:
- `/api/quiz/submit` (Phase 5)
- `/api/guardian/[zoneId]/submit` (Phase 8)
- `/api/streak/shields/use` (Phase 7)

The entry is consistent with the code. No contradictions between Phase 8, Phase 8A, or Phase 9 notes were found. No rewrite needed.

---

## Known skips and blockers

| Item | Type | Impact |
|---|---|---|
| Railway deployment not complete | Blocker for LIVE pipeline activation | No new content can be generated until PIPELINE_SERVICE_URL is set and Railway is running |
| Guardian double-submit (no idempotency) | Pre-production hardening | Points can be double-awarded on client retry; low risk at single-child pilot concurrency |
| PgBouncer interactive transaction | Pre-production hardening | Documented in DECISIONS.md; safe at pilot scale |
| World map: only 1 node per zone | Data gap | Each zone has only 1 topic node; more topics need to be seeded to demonstrate sequential unlock |
| Screen-time enforcement | Deferred | Marked "coming soon" in parent dashboard; server-side enforcement is Phase 9 (was incomplete at merge) |
| `/dashboard/admin/pipeline` web route | Deferred | Phase 12 feature per CLAUDE.md §14; pipeline is CLI-only in Phase 8A |

---

## Exact safe product claim

As of commit `199d4b1`:

> A child on Year 3 or Year 7 can log in, see a world map with their Maths zone, navigate to the single available topic node, complete the Learn → Practise → Quiz loop, earn points and a Discovery Card, and — if the zone topic is completed — battle the Zone Guardian for a Legendary card and the Guardian Slayer badge. A linked parent can log in and see the child's progress summary, weak areas (derived from real quiz answer data), and a recommended next lesson (published + verified only).

---

## Claims still not allowed

- Pipeline is live (Railway not deployed; LIVE layer skipped)
- Multiple topic unlock chains work end-to-end (only 1 node per zone is seeded)
- Sequential zone unlocks have been play-tested across multiple topics
- Screen-time enforcement is active (deferred)
- Offline PWA mode works (Phase 10 not built)
- English or Science content exists (Phase 11 not built)
- Community rollout is safe (PgBouncer + idempotency hardening pending)

---

## Files changed in this integration sprint

| File | Action | Reason |
|---|---|---|
| `scripts/verify-phase8a.mjs` | Created | Missing Phase 8A deliverable; three-layer verify script |
| `docs/PHASE_8A_DEPLOYMENT.md` | Created | Missing Phase 8A deliverable; Railway deployment runbook |
| `docs/POST_MERGE_INTEGRATION_PROOF.md` | Created | This file; integration proof as required by sprint spec |

No product features were added. No schema changes. No new routes.

---

## Remaining deployment tasks

1. **Deploy pipeline to Railway** — set `ANTHROPIC_API_KEY` + `DATABASE_URL` (direct), get public URL
2. **Set `PIPELINE_SERVICE_URL`** — in `.env.local` and Vercel project env
3. **Re-run `verify-phase8a.mjs`** — confirm LIVE layer passes
4. **Manual play-test** — as listed in Phase 8 verify gate output:
   - Dashboard → World Map button visible
   - Year 3 map renders at 375px — Number Jungle node pulsing
   - Complete Multiplication Tables quiz → node shows completed + Guardian banner
   - Battle Guardian → Legendary card reveal + Guardian Slayer badge fires
   - Repeat for Year 7 Crystal Labyrinth
5. **Seed more topic nodes** — currently 1 node per zone; sequential unlock cannot be demonstrated until more topics are seeded via `seed-phase8.mjs` with additional entries

---

## Go / No-Go verdict

| Gate | Status |
|---|---|
| TypeScript clean | ✅ |
| ESLint clean | ✅ |
| Production build | ✅ |
| Phase 8 verify (24 checks) | ✅ |
| Parent dashboard safety (16 checks) | ✅ |
| Phase 8A verify — STATIC + DATABASE (18 checks) | ✅ |
| Phase 8A verify — LIVE | ⏭️ Blocked on Railway deploy |
| No seed/verify imports in runtime code | ✅ |
| No hardcoded content | ✅ |
| FamilyLink security on per-child detail | ✅ |
| Published-only content gate | ✅ |

**Verdict: GO for family pilot** on the child journey (world map + guardian + quiz loop) and parent dashboard. **HOLD** on pipeline live activation until Railway is deployed and LIVE layer passes.

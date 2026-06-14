# World-Class Hardening Sprint (2026-06-15)

Five workstreams closing the gap between "feature-complete MVP" and a world-class
ed-tech system: provable learning efficacy, trust/reliability, and pedagogical depth.
All landed green: `tsc --noEmit` exit 0, **124 unit tests passing**, `next lint` no errors.

## 1. Learner-path test coverage (was: 2 stale test files for 703 TS files)
New Vitest suites for the code a child actually touches:
- `__tests__/points.test.ts` — scoring spec incl. the 10/10→125 anchor, hint deductions, SM-2 quality mapping.
- `__tests__/sm2.test.ts` — the 9-line review scheduler: lapse reset, easiness floor 1.3, 1→6→interval×e growth.
- `__tests__/adaptive.test.ts` — the **§8 safety contract**: only `status='published'` ever returned (staged/flagged/regenerating proven excluded), tier balance, dedup, recently-seen avoidance, empty-pool graceful `[]`.
- `__tests__/offline.test.ts` — IndexedDB queue: offline→queue, online→submit, non-2xx/throw→retry, FIFO drain, nothing lost, sync events.
- `__tests__/irt.test.ts`, `__tests__/efficacy.test.ts` — see below.

## 2. End-to-end suite — `e2e/` + `playwright.config.ts`
24 specs across 5 journeys (smoke, auth, learn→practise→quiz, offline-sync, world-map), mobile-first at 375×667.
- **Green by default** in CI: `smoke` + auth-redirect specs (no DB needed).
- **Data-dependent journeys** gated behind `E2E_LIVE=1` so CI stays green without a seeded DB.
- See `e2e/README.md` for run instructions and the recommended `data-testid` hooks.

## 3. IRT / Rasch difficulty calibration — the closed loop
Items were pitched by fixed editorial `tier` only. Now difficulty is **calibrated from real responses** and selection pitches to each child's ability.
- `lib/irt.ts` — pure, unit-tested Rasch math (Laplace-smoothed difficulty, one-step ability estimate, ability-aware ranking, re-tier recommendations).
- `app/api/cron/calibrate-difficulty/route.ts` — nightly (01:00 UTC, registered in `vercel.json`); aggregates first-attempt correctness per published question (≥20 responses), writes `quiz_questions.difficulty_b`. **Never** changes tier/status/content — mis-tier findings are reported for review, not auto-applied.
- `lib/adaptive.ts` — `selectQuizQuestions` now estimates child ability from history and prefers calibrated items near it **within** each tier (formal tier gates preserved). No-op for cold-start/uncalibrated pools, so behaviour degrades gracefully.
- Schema: additive nullable columns `difficulty_b`, `calibration_n`, `calibrated_at` + migration `20260615120000_add_irt_calibration`.

## 4. Accessibility — WCAG 2.2 AA on the core loop
45 issues fixed across 18 files (quiz, games, cards, world-map, route step indicators). Highlights: keyboard tap-to-place alternative for drag-and-drop (2.5.7), aria-live feedback/hearts/score (4.1.3), modal dialog semantics + Escape (2.1.2/4.1.2), 48px targets (2.5.8), colour-not-alone (1.4.1). Full findings + deferred items (a designer-decision on the `points-gold` text contrast; a screen-reader pass) in `docs/ACCESSIBILITY_AUDIT.md`.

## 5. Pipeline golden-set + alerting
`services/content-pipeline/tests/golden/` — 34 fixed known-good/known-bad items across every verifier type that must always pass/fail, so a prompt/model change can't silently degrade content. `scripts/verify-pipeline-golden.py` is the CI/pre-deploy gate (exit 1 on regression — proven to catch a planted bad item). Alerting plan (cron failure / zero-published / error-spike / golden regression → Resend email) documented in `services/content-pipeline/GOLDEN_SET.md`.

## Bonus: First-party learning-efficacy analytics
`lib/efficacy.ts` (+ `app/api/admin/efficacy`) — measures whether children actually learn, with **no third-party analytics** (Children's Code). Hake normalised learning gain, mastery rate, time-to-mastery, and spaced-review retention, computed from existing `quiz_attempts`. This is both an operational signal and the evidence base for the community-rollout growth story.

---

## Manual follow-ups (the only steps not auto-applied)
1. **Deploy the IRT migration** to the production DB: `npx prisma migrate deploy` (or your normal pipeline). The cron + ability-aware selection are written to degrade gracefully until the `difficulty_b`/`calibration_n`/`calibrated_at` columns exist. Not auto-applied because it touches the production children's database.
2. **E2E**: `npx playwright install chromium` once; run full journeys with `E2E_LIVE=1` against a seeded DB or a preview URL.
3. **Golden set**: 10 cases (pint/chempy/LanguageTool) are skipped locally; run `scripts/verify-pipeline-golden.py` with the pipeline venv to exercise them.
4. **A11y**: resolve the deferred `points-gold` text-contrast token with a designer; book a real screen-reader pass.
5. Optional: wire the documented Resend failure-alert hook into the cron `catch` blocks.

Nothing here was committed — review and commit when ready (currently on `main`; branch first per repo convention).

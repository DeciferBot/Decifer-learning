# PR Review: #106 — Four new guides: CAT4, CAT4 scores, IQ tests and 11+ non-verbal reasoning

**Reviewed**: 2026-08-19
**Author**: DeciferBot
**Branch**: claude/musing-wright-eef5da → main
**Decision**: APPROVE (after fixes applied during review)

## Summary

Four data-only guide files plus a build fix touching Prisma pooling, the Skills
Check data layer and a shared retry helper. The guide content is inert data and
carries no risk. The build fix is where the review effort went, and it turned up
one real regression introduced by the fix itself, now corrected.

## Findings

### CRITICAL
None.

### HIGH

**1. Retry budget leaked onto a live request path — FIXED in this review.**
`lib/db-retry.ts`. The retry helper was written for build-time pool contention
and given a ~13 second budget. But `getPublishedCheck` is called by
`POST /api/skills-check/start`, an unauthenticated route a child waits on, and
the curriculum snapshot serves live ISR pages. A transient database error would
have turned a fast failure into a 13 second hang for a real user.

Fix: the budget is now chosen by phase. Six attempts and up to 5s of backoff
during `phase-production-build`; two attempts and at most 400ms at runtime, so a
single blip is still absorbed without anyone waiting.

### MEDIUM

**2. `lib/prisma.ts` comment claimed something the code does not do — comment FIXED, env flagged.**
The header said `connection_limit=1` "is required" for serverless, but the guard
only appends it when the DSN does not already mention pgbouncer. The deployed
DSN says `pgbouncer=true&connection_limit=10`, so it is passed through untouched
and runtime gets 10, not 1.

The comment now describes what the code actually does. The value itself is not
changed here on purpose: it lives in the environment, and re-tuning production
connection pooling is not a side effect a guides PR should have. See "Follow-up".

### LOW

**3. Case handling in `getPublishedCheck` is slightly more permissive.**
`lib/skills-check/server.ts`. The old query matched `slug` case-sensitively and
`name` case-insensitively. The snapshot version lowercases both sides for both.
Slugs are lowercase in practice, so no behaviour change, and the new form is the
more forgiving of the two. Left as is.

**4. The snapshot returns its cached array by reference.**
A caller could mutate the shared array. No current caller does, and
`lib/public-curriculum.ts` has returned its snapshot the same way since it was
written, so this matches house style rather than diverging from it. Left as is.

### Environment (not a code defect)

**5. `node_modules` had drifted from the lockfile.**
`stripe` was installed at 22.5.0 while `package-lock.json` pins 22.2.0. The newer
SDK expects `apiVersion: '2026-07-29.dahlia'` and the code pins
`'2026-05-27.dahlia'`, which failed the local build. Resolved with `npm ci`, no
code change. Vercel builds from the lockfile, so CI and production were never
affected. The Stripe API version was deliberately NOT bumped: that changes live
payment behaviour and needs its own deliberate change.

## Validation Results

| Check | Result |
|---|---|
| Type check | Pass (`npx tsc --noEmit`, clean) |
| Lint | Pass (0 errors; pre-existing `<img>` warnings elsewhere) |
| Tests | Pass (31 files, 519 tests) |
| Build | Pass (exit 0, 0 pool errors, 0 timeout restarts) |

Build evidence: 14 guide pages and 16 Skills Check landing pages prerendered,
the latter from a single database query where the previous code issued two per
page.

## Files Reviewed

| File | Change |
|---|---|
| `lib/guides/content/cat4-explained-uae.ts` | Added |
| `lib/guides/content/cat4-scores-explained.ts` | Added |
| `lib/guides/content/iq-tests-for-children.ts` | Added |
| `lib/guides/content/11-plus-non-verbal-reasoning.ts` | Added |
| `lib/guides/index.ts` | Modified (registry) |
| `lib/db-retry.ts` | Added (shared retry, fixed in review) |
| `lib/prisma.ts` | Modified (build-phase connection limit) |
| `lib/public-curriculum.ts` | Modified (uses shared retry) |
| `lib/skills-check/server.ts` | Modified (memoised snapshot) |
| `app/skills-check/[subject]/[year]/page.tsx` | Modified (no longer fails silently) |

Guide data was checked programmatically: 14 guides, no broken `related` slugs, no
broken internal `/guides/*` links, no self-links. All 17 external source URLs
returned 200.

## Follow-up (not in this PR)

- **`DATABASE_URL` sets `connection_limit=10` in production.** With a Supabase
  pooler at `pool_size: 15`, two concurrent serverless functions can exhaust it.
  This is an environment variable change on Vercel, not a code change, and it
  should be made deliberately with an eye on throughput.

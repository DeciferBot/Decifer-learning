# PR Review: #69 — make the round winnable, the home screen single-purpose, and the streak survivable

**Reviewed**: 2026-07-30 (post-merge)
**Author**: Amit Chopra (with Claude)
**Branch**: claude/gamification-benchmark-plan-fd4ac7 → main (squashed as `e5b10ee`)
**Scope**: 21 files, +1743 / -584
**Decision**: COMMENT — already merged and deployed to production. No CRITICAL or HIGH
issues remain, but three MEDIUM findings are live and worth a follow-up.

## Summary

Second, adversarial pass over code that is already serving children. The four defects
found in the pre-merge review were fixed and verified. This pass found three new issues
that the first pass missed, all MEDIUM: two documented-rule violations and one piece of
copy that promises something the system does not enforce. None of them breaks the app.

## Findings

### CRITICAL
None.

### HIGH
None outstanding. The two HIGH issues from the pre-merge review (untyped SQL bind
parameters, and the goal ring ignoring the Daily Mystery Challenge) were fixed before
merge and are confirmed present in the shipped code.

### MEDIUM

**1. Tap targets below the documented 48 px minimum** —
`components/child/ChildCurriculumMap.tsx:135`, `:144`
Both the primary topic action and the secondary "read the lesson" button are
`min-h-[44px]`, and the secondary is `min-w-[44px]`. CLAUDE.md §4 lists "Minimum tap
target 48 × 48 px" as a non-negotiable constraint.
Mitigating: the code being replaced was `min-h-[36px]`, so this is an improvement on
what shipped before, just not to the stated bar. It is a two-character fix.
**Not fixed** — flagged rather than patched, because it is live and better bundled with
the manual device pass.

**2. The daily goal claims something the streak does not enforce** —
`components/child/DailyGoalRing.tsx`
The ring says "One round keeps your streak alive." It does not: `StreakPing` fires
`POST /api/streak/check` on home-screen mount, and that endpoint advances the streak on
its own. A child who opens the app and taps nothing keeps their streak.
This is pre-existing behaviour, but the new copy is the first thing to make a promise
about it, and it makes the streak hollow in exactly the way this whole change set set out
to fix. Either the copy should soften, or `/api/streak/check` should stop advancing the
streak and let real activity do it. The second is the better product and the bigger
decision, so it is deliberately not made here.

**3. Practise is no longer surfaced anywhere the child chooses from**
Removing the three-button topic card took the only direct Practise entry point off the
curriculum map. Verified still reachable: the Learn page routes onward to Practise when a
practice game exists (`app/(child)/topics/[id]/learn/page.tsx:163`), so the intended
Learn → Practise → Quiz path is intact for a topic being started fresh. But a child
resuming an in-progress topic goes straight to the quiz and will never see Practise
unless they backtrack through the lesson.
This is arguably the intended simplification — the app choosing the order was the point —
but it does quietly demote a feature the content pipeline generates for. Worth a decision
rather than an accident.

### LOW

**4. `dynamic = 'force-dynamic'` and `revalidate = 60` are both set** —
`app/dashboard/child/page.tsx:15,39`
`force-dynamic` wins, so the revalidate window and its explanatory comment are dead.
Pre-existing; this PR carried both forward and added a tenth parallel query under it.
Not a regression, but the comment now misleads.

**5. `newStreak` in the submit response changed meaning and has no consumer**
Carried over from the pre-merge review. Was "the streak number changed", now "today
counted". No reader in `app/`, `components/` or `lib/`.

**6. `QuizShell.tsx` is ~1290 lines**
Over the 800-line guideline, and now carrying round state, fix-up state, feedback cues
and four result-screen variants. Pre-existing size problem made denser. The result screen
is the natural extraction.

## Re-verified from the pre-merge review

| Prior finding | Status in shipped code |
|---|---|
| Untyped SQL bind parameters (HIGH) | Fixed — `::int` casts present, dry-run against production passed |
| Goal ring ignored the daily challenge (HIGH) | Fixed — `daily_challenge:` point event now counts |
| Freeze balance could go negative (MEDIUM) | Fixed — `GREATEST(…, 0)` clamp |
| Orphaned `shields/use` endpoint (MEDIUM) | Fixed — route deleted, no references remain |
| Consolation cards farmable (MEDIUM) | Accepted — confirmed again that the Reward Vault reads topic progress and badges only, never `lib/cards`, so this cannot reach real prizes |

## Checks that came back clean

- No `console.log`, `TODO` or `FIXME` in any new or rewritten file
- No hardcoded credentials; `.env.local` is git-ignored and was absent from the worktree at commit time
- Raw SQL uses Prisma tagged templates throughout, so values are bound, not interpolated
- `lib/feedback.ts` degrades to silence on every failure path and is a no-op server-side
- `SoundToggle` reads `localStorage` after mount, so it cannot hydrate mismatched
- `WinBurst` builds its pieces after mount for the same reason, and returns null under
  `prefers-reduced-motion`
- New pure logic is covered: 21 new tests across `lib/cards.ts` and `lib/streak.ts`,
  including the freeze cap, the reset path and a backwards clock

## Validation Results

| Check | Result |
|---|---|
| Type check (`tsc --noEmit`) | Pass |
| Tests (`vitest`) | Pass — 165 tests, 12 files |
| Build (`next build`) | Pass — exit 0, no error lines |
| Production deploy | Pass — GitHub deployment records `e5b10ee` to Production, matching `main` HEAD |
| Lint | Skipped — pre-existing `@next/next` plugin conflict from the nested worktree |
| E2E (`playwright`) | **Not run** — needs a live server and a seeded child session |
| Manual play-through | **Not done** — local service-role key is empty |
| No horizontal scroll at 375 px | **Not verified** — requires a browser |

## Files Reviewed

Modified: `app/(child)/guardian/[zoneId]/page.tsx`, `app/(child)/topics/[id]/quiz/page.tsx`,
`app/api/cron/streak-nudge/route.ts`, `app/api/quiz/submit/route.ts`,
`app/api/streak/check/route.ts`, `app/dashboard/child/page.tsx`,
`components/cards/CardReveal.tsx`, `components/child/ChildCurriculumMap.tsx`,
`components/quiz/QuizShell.tsx`, `components/ui/icons.tsx`, `lib/cards.ts`

Added: `lib/streak.ts`, `lib/feedback.ts`, `components/child/DailyGoalRing.tsx`,
`components/quiz/SoundToggle.tsx`, `components/quiz/WinBurst.tsx`,
`__tests__/cards.test.ts`, `__tests__/streak.test.ts`,
`docs/GAMIFICATION_BENCHMARK_PLAN.md`, `.claude/reviews/gamification-ux-review.md`

Deleted: `app/api/streak/shields/use/route.ts`

## Recommended follow-up

1. Bump the two tap targets 44 → 48 px. One-line fix, closes a documented constraint.
2. Decide the streak question: either soften the goal copy, or stop
   `/api/streak/check` advancing the streak so it means something.
3. Play one round on a device and check 375 px for horizontal scroll. Still the single
   biggest gap in confidence — nothing in this change set has been seen by a human.

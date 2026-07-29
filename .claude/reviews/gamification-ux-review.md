# Code Review: gamification UX rebuild (local changes)

**Reviewed**: 2026-07-30
**Branch**: claude/gamification-benchmark-plan-fd4ac7
**Decision**: APPROVE with comments (2 issues found and fixed during review)

## Summary

Four phases of child-loop UX changes: a winnable round, a single-action home screen
with no marks, sound and haptics, and a working streak freeze. Type check, 165 unit
tests and a production build all pass. Two real defects were found during this review
and fixed before sign-off. Nothing here has been exercised by a human playing the app.

## Findings

### CRITICAL
None.

### HIGH

**1. Raw SQL bound integers without a type cast** — `app/api/quiz/submit/route.ts`,
`app/api/streak/check/route.ts`
`GREATEST(quantity - ${n}, 0)` and `LEAST(quantity + 1, ${MAX})` passed JS numbers as
untyped bind parameters. Postgres can fail to infer the type in these positions, which
would have thrown at runtime inside the quiz submit transaction and broken every
submission, while passing type check and unit tests.
**Fixed**: added explicit `::int` casts. Verified by running both statements against the
production database inside a transaction that was rolled back: spend clamped at 0, earn
capped at 2, both as intended.

**2. Daily goal ring would read empty after the child did the daily challenge** —
`app/dashboard/child/page.tsx`
The ring counted `quiz_attempts`. `POST /api/daily-challenge/submit` awards points but
writes no attempt row, so a child who completed the Daily Mystery Challenge would be
shown "Today's goal: 0/1" immediately afterwards.
**Fixed**: the ring now also checks for a `daily_challenge:` point event dated today.

### MEDIUM

**3. Freeze balance could go negative under concurrent submits** —
`app/api/quiz/submit/route.ts`
The balance is read before the transaction opens, so two submissions landing together
could each decrement it. **Fixed** during implementation by clamping with `GREATEST(…, 0)`
rather than a plain Prisma `decrement`.

**4. Orphaned endpoint left a way to burn your own freezes** — `app/api/streak/shields/use`
Once shields stopped being spent on heart loss, this authenticated POST had no caller but
still decremented the balance, so a child could have drained their own streak protection.
**Fixed**: route deleted. Confirmed no remaining references.

**5. `QuizShell.tsx` is ~1290 lines**
Over the 800-line guideline. Pre-existing (it was 1279 before this work) and not made
materially worse, but it is now carrying round state, fix-up state, feedback cues and
three result-screen variants. Worth splitting the result screen out before the next
change lands in this file. Not blocking.

**6. Consolation cards are mildly farmable**
A child who repeatedly finishes a fix-up round with at least one correct answer earns a
Common card each time. Bounded in practice because each fix-up shrinks as questions are
cleared. Confirmed **not** a rewards risk: `lib/vault/status.ts` and
`lib/vault/milestone-engine.ts` both state they never import `lib/cards`, and the Reward
Vault reads topic progress and badges only, so this cannot reach real-world prizes.
Accepted.

### LOW

**7. `newStreak` in the submit response changed meaning and nothing reads it**
It used to mean "the streak number changed"; it now means "today counted". Grep shows no
consumer in `app/`, `components/` or `lib/`. Left as-is to avoid touching the response
contract, but it is dead weight.

**8. Confetti can fire on a locally-optimistic pass**
While the submit is in flight, `passed` falls back to the local count. If the server later
disagrees, the burst has already played. Pre-existing local/server tension; the card, the
progress and the unlock all still correctly wait for the server.

## Validation Results

| Check | Result |
|---|---|
| Type check (`tsc --noEmit`) | Pass |
| Unit tests (`vitest`) | Pass — 165 tests, 12 files |
| Build (`next build`) | Pass — exit 0 |
| Lint (`next lint`) | **Skipped** — pre-existing `@next/next` plugin conflict caused by the worktree being nested inside the parent repo, not by these changes |
| E2E (`playwright`) | **Not run** — needs a live server and a seeded child session |
| Manual play-through | **Not done** — the local `.env.local` has an empty service-role key, so a child session cannot be created on this machine |

## Behavioural gates checked against real data

- **Every finished round now pays**: replayed all 99 historical attempts. 99/99 would earn
  a card under the new rule (60 of them previously earned nothing). 0 attempts had zero
  correct answers, so the anti-farm guard never bites on real play.
- **Fix-up round size**: mean 2.6 questions across the 60 failed attempts (min 0, max 8).
- **Found during the data pass**: 17 of 99 attempts answered *every* question correctly and
  still failed on retry-weighted credit. They have nothing to fix up, so they now get a
  distinct "You got every one!" screen instead of the grey retry icon.

## Files Reviewed

| File | Change |
|---|---|
| `app/(child)/topics/[id]/quiz/page.tsx` | Modified — 5-question round, reward copy |
| `app/api/quiz/submit/route.ts` | Modified — consolation card, streak freeze, casts |
| `app/api/streak/check/route.ts` | Modified — freeze-aware streak |
| `app/api/cron/streak-nudge/route.ts` | Modified — threshold 3 → 1, copy |
| `app/dashboard/child/page.tsx` | Rewritten — single next action |
| `components/child/ChildCurriculumMap.tsx` | Modified — no marks, one action |
| `components/quiz/QuizShell.tsx` | Modified — fix-up round, cues, hearts scoped |
| `components/cards/CardReveal.tsx` | Modified — reveal cue |
| `components/ui/icons.tsx` | Modified — Volume2, VolumeX |
| `lib/cards.ts` | Modified — `rarityForRoundResult` |
| `lib/streak.ts` | Added |
| `lib/feedback.ts` | Added |
| `components/child/DailyGoalRing.tsx` | Added |
| `components/quiz/SoundToggle.tsx` | Added |
| `components/quiz/WinBurst.tsx` | Added |
| `__tests__/cards.test.ts` | Added — 6 tests |
| `__tests__/streak.test.ts` | Added — 15 tests |
| `app/api/streak/shields/use/route.ts` | Deleted |

## Before merge

1. Play one round on a device. Nothing in this change set has been seen by a human.
2. Send one real streak-risk push to a real device. `push_subscriptions` is still empty,
   so the nudge path remains unproven end to end.
3. Watch the pass rate after the first week of real play. The target is 70%+.

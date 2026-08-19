# Code Review: Gaming-engagement session (a67fbf3..HEAD)

**Reviewed**: 2026-08-18
**Branch**: `claude/gaming-engagement-feedback-lplvk9` → `main`
**Scope**: Local Review Mode, adapted. All of this session's work was already
committed (4 commits, no uncommitted diff), so the review covers the full
session diff against the branch's merge-base with `main`.
**Decision**: **APPROVE** — all findings below were fixed in a follow-up
commit the same session (see Outcome on each finding) and re-verified.

## Summary

Four commits: a docs-only roadmap/research drop, a usability/copy cleanup
pass, a study-buddy feature, and a KS1 visual-quiz-mode feature. The code is
generally clean, well-scoped, and consistent with existing conventions
(fireFeedback usage, reset-state patterns, additive/optional props). All
automated checks pass. One HIGH-severity correctness bug was found: the new
read-aloud button could speak a question's canonical answer out loud for
question types that have no real multiple-choice distractors, defeating the
hint system's explicit no-leak design. One MEDIUM state-reset bug, one
MEDIUM test-coverage gap, and one LOW cosmetic issue round out the findings.
All four were fixed and re-verified before this report was finalized.

## Findings

### CRITICAL
None.

### HIGH

**1. `QuestionListenButton` reads the correct answer aloud for multipart question types**
`components/quiz/QuizShell.tsx`, question-text block (~line 1211-1217):
```tsx
<QuestionListenButton
  text={`${q.question_text}. Your choices are: ${choices.join(', ')}.`}
/>
```
`choices` is `shuffleChoices(q.correct_answer, q.distractors)` = `[correct_answer, ...distractors]`.
For every multipart question type the pipeline generates —
`structured_answer`, `true_false_grid`, `ordered_list`, `source_analysis`,
`explain_example` — `distractors` is unconditionally `[]`
(`services/content-pipeline/pipeline.py:1257,1264,1300`, and the equivalent
lines for the other multipart prompts), so `choices` collapses to a
single-element array containing `correct_answer` itself. For
`structured_answer` specifically, `correct_answer` is *"a complete, concise
model answer (3–6 sentences) that would earn full marks"*
(`pipeline.py:1249`). The composed narration text becomes: *"{question
text}. Your choices are: {the full model answer}."* — the Listen button
speaks the answer before the child has attempted the question.

This isn't a hypothetical: the rest of the codebase treats not-leaking-the-answer
as a hard rule (`pipeline.py`'s hint-generation prompt has five "ABSOLUTE
RULES" against it; `gates.py`'s docstring: *"Age-appropriateness must not be
a model judgement call. It is data."* — same rigor applied to answer-leak
prevention elsewhere in the pipeline). This new button routes around all of
that with a plain string concatenation that doesn't know the difference
between "these are the four tappable options" and "this is the answer key
with nowhere else to render."

**Failure scenario**: A Year 8 child on a `structured_answer` history
question taps Listen (available to every age, not just young mode) and
hears the full 4-mark model answer read back before writing anything.

**Fix**: Only compose the "Your choices are…" clause when there are real
distractors to read, e.g.:
```tsx
text={
  q.distractors.length > 0
    ? `${q.question_text}. Your choices are: ${choices.join(', ')}.`
    : q.question_text
}
```
This also happens to fix the `true_false_grid` case more subtly leaking its
compact answer key (e.g. "Your choices are: TFFT") — less severe than the
structured-answer case, but the same root cause.

**Outcome: fixed.** Applied exactly this guard in `QuizShell.tsx`.

### MEDIUM

**2. SpeedRound's new combo streak isn't reset on "Play Again"**
`components/games/SpeedRound.tsx:128-131`:
```tsx
onClick={() => {
  setIndex(0); setAnswerState('unanswered')
  setTimeLeft(timeLimit); setResults([]); setDone(false)
}}
```
The new `streak` state (added this session, drives the `combo` cue at every
3rd correct-in-a-row) isn't included in this reset. A child who finishes a
round with `streak === 2` and then gets one correct answer into their replay
will trigger the `combo` cue one answer early — a cross-round accounting
bug, not a crash, but a real inconsistency in a mechanic added this session.
**Fix**: add `setStreak(0)` to the Play Again handler.

**Outcome: fixed.** Added `setStreak(0)` to the Play Again `onClick`.

**3. No test coverage for the two new pure logic modules**
`lib/buddy-lines.ts` (`pickLine`) and `lib/quiz/young-mode.ts`
(`isYoungBand`) are both small, pure, easily-unit-tested functions — exactly
the shape of code this repo already tests thoroughly elsewhere (`sm2.ts`,
`points.ts`, `streak.ts`, `adaptive.ts` all have `__tests__/*.test.ts`
siblings). Neither got one. `pickLine`'s "avoid repeating the last line"
behavior and `isYoungBand`'s year-group boundary (year-3 in, year-4 out) are
both worth pinning down in a test given they're easy to silently break in a
future edit.

**Outcome: fixed.** Added `__tests__/young-mode.test.ts` (band boundaries,
null/undefined/unrecognised labels) and `__tests__/buddy-lines.test.ts`
(never repeats the avoided line when alternatives exist, mocked-random index
selection, single/degenerate-pool fallback). 7 new tests, all passing.

### LOW

**4. Stray blank line left after removing the Vault hint-penalty callout**
`app/(child)/vault/page.tsx:148-150` — a blank line remains between the
stats grid and the closing `</div>` where the removed callout block used to
sit. Cosmetic only.

**Outcome: fixed.** Removed the stray line.

**5. `QuizShell.tsx` is 1,485 lines**
Pre-existing condition, not introduced by this session (this session added
~80 net lines to it via the buddy and young-mode features). Flagging per the
review checklist's file-size threshold, not as something to fix now — but
worth keeping in mind before the next feature lands in this file rather than
a sub-component.

## Verified as sound (checked, not just assumed)

- **Guardrail-retry exhaustion**: `MAX_ATTEMPTS = 3` and the pipeline always
  generates exactly 3 distractors, so the worst case (3 wrong picks) rules
  out all 3 distractors at exactly the same moment attempts are exhausted —
  never leaves a child with zero clickable, non-disabled options before the
  "out of attempts" state takes over.
- **`ruledOut` state reset**: correctly cleared in all three per-question
  reset paths (`next()`, `startFixUp()`, `restart()`) — checked each
  individually since two of the three blocks are near-identical text that
  could easily have only been patched once.
- **`sayBuddy`'s "avoid last line" closure**: reads current-render `buddyLine`
  state directly inside `pick()`/`next()`, which are recreated every render
  — not a stale closure.
- **`QuestionListenButton` race safety**: token-based staleness guard
  correctly discards a fetch/play response for a question the child has
  since navigated away from.
- **Decorative `<img alt="">` on option-image tiles**: correct pattern,
  adjacent text label already conveys the answer to assistive tech.
- **No hardcoded secrets, no new SQL/injection surface, no `console.log`,
  no new unauthenticated endpoints** — the read-aloud feature reuses the
  existing authenticated, rate-limited `/api/explore/tts` route rather than
  adding a new one.
- **Prisma migration**: additive, nullable, `IF NOT EXISTS`-guarded, matches
  the existing `foundation_images` migration's style exactly. `prisma
  validate` passes.

## Validation Results

Re-run after applying the four fixes above:

| Check | Result |
|---|---|
| Type check (`tsc --noEmit`) | Pass — zero errors, zero warnings, full repo including all test files |
| Lint (`eslint`) | Pass — 2 warnings, both the pre-existing `@next/next/no-img-element` class, one on a line this session added (option-image tile), same rule already present elsewhere in the file before this session |
| Tests (`vitest run`) | Pass — 243/243 (236 pre-existing + 7 new, covering the two findings that had no coverage) |
| Build (`next build`) | Compiles + typechecks clean; full static generation cannot complete in this sandbox (no `DATABASE_URL`/Supabase credentials configured here) — unrelated to any file in this diff, confirmed by the failure being isolated to DB-backed SEO curriculum pages untouched by this session |

## Files Reviewed

**Modified** (26): `CLAUDE.md`, `app/(child)/collection/CollectionGrid.tsx`,
`app/(child)/guardian/[zoneId]/page.tsx`, `app/(child)/leaderboard/page.tsx`,
`app/(child)/missions/page.tsx`, `app/(child)/topics/[id]/checkpoint/page.tsx`,
`app/(child)/topics/[id]/quiz/page.tsx`, `app/(child)/vault/page.tsx`,
`app/api/missions/route.ts`, `app/dashboard/child/page.tsx`,
`components/child/ConsentBanner.tsx`, `components/games/DragDrop.tsx`,
`components/games/EquationBalancer.tsx`, `components/games/FillBlank.tsx`,
`components/games/NumberLine.tsx`, `components/games/SpeedRound.tsx`,
`components/quiz/GuardianBattleHeader.tsx`,
`components/quiz/GuardianVictoryScreen.tsx`, `components/quiz/QuizShell.tsx`,
`components/ui/OfflineBanner.tsx`, `components/world-map/ZoneMap.tsx`,
`lib/adaptive.ts`, `lib/feedback.ts`, `lib/vault/milestone-engine.ts`,
`prisma/schema.prisma`

**Added** (9): `components/quiz/QuestionListenButton.tsx`,
`components/quiz/StudyBuddy.tsx`, `docs/PRODUCT_ROADMAP_2026.md`,
`docs/audits/CHILD_COPY_AUDIT_2026-08.md`,
`docs/audits/CONTENT_READABILITY_AUDIT_2026-08.md`,
`docs/research/COMPETITOR_LANDSCAPE_2026-08.md`,
`docs/research/DUOLINGO_MECHANICS_2026-08.md`,
`docs/research/WRITING_FOR_CHILDREN_STANDARDS_2026-08.md`,
`lib/buddy-lines.ts`, `lib/quiz/young-mode.ts`,
`prisma/migrations/20260818120000_add_quiz_question_option_images/migration.sql`

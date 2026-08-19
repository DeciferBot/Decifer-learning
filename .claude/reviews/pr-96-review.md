# PR Review: #96 — Skills Check scoring engine and code-generated reasoning items

**Reviewed**: 2026-08-19
**Author**: DeciferBot
**Branch**: claude/iq-tests-validity-bbb363 → main
**Decision**: APPROVE (after fixes applied in review)

## Summary

Two pure, well-tested assessment engines with no UI. The reasoning generator is
the stronger half: because items are constructed rather than written, its output
cannot be wrong, which is a structural advantage over every other content path in
this product. Five findings, all fixed on the branch during review. Validation is
green on all four checks.

## Findings

### CRITICAL

None.

### HIGH

**1. `persistCheck` used an interactive transaction behind PgBouncer.**
`lib/skills-check/build.ts`

`prisma.$transaction(async (tx) => ...)` over the pooled `DATABASE_URL` is
documented in `DECISIONS.md` as unsafe: Supabase's PgBouncer in transaction mode
may hand a different physical connection to each statement, so atomicity is
silently lost. The transaction did `upsert` → `deleteMany` → `createMany`. A
failure between the delete and the create would leave a check advertising 20
items and holding none, which the script would then report as success.

*Fixed*: the upsert runs on its own (its result is needed for the writes), and
the delete/create pair moved to the **array form** of `$transaction`, which is
sent as one batch on one connection. A check row with no items is harmless
because `is_published` is false.

### MEDIUM

**2. A question with malformed distractors would render a single button.**
`lib/skills-check/build.ts`, `lib/skills-check/shuffle.ts`

`buildOptions` correctly discards nulls, objects, blanks and distractors that
duplicate the correct answer. Nothing then checked that anything survived. A row
with an empty or malformed `distractors` JSON would reach a child as a
one-option multiple choice.

*Fixed*: added `MIN_OPTIONS = 4` and a `hasEnoughOptions` filter in
`loadTopicPools`, so such rows never enter a check's pool.

**3. `lib/skills-check/shuffle.ts` shipped with no tests.**

It is the module that turns untyped pipeline JSON into buttons a child presses,
which makes it the most defensive code in the PR and the least covered.

*Fixed*: added `__tests__/skills-check-shuffle.test.ts`, 23 tests, mostly on
malformed input — nulls, non-arrays, numbers, objects, blanks, duplicates, and
case/whitespace variants of the correct answer.

**4. Two near-identical questions can land in one check.**
`lib/skills-check/plan.ts`

Found by running the planner against live Year 6 English, not by reading code.
One strand drew "Which sentence is written in the passive voice? A) The dog…"
and the same stem with firefighters and a family. The pipeline's embedding dedup
does not catch it, and inside a 20-question test it is glaring: it wastes one of
only five chances to judge that strand.

*Fixed*: `questionsAreNearDuplicates` with two rules — same opening run of
meaningful words (catches one stem with different examples pasted after it), and
high word overlap (catches a long rewording). Threaded across the whole check,
not per strand. Selection falls back to allowing a duplicate rather than
returning a short strand, because a missing item would change the score.

*Deliberate limit*: the threshold errs toward missing duplicates. At a lower
threshold the rule also collapsed a perimeter question with an area question. A
false positive silently removes a good question from the pool, which is worse
than a blemish. Documented in the code and in a test.

### LOW

**5. `domainIndex` could return -1 and silently shift every later item.**
`lib/reasoning/generate.ts`

A figure carrying a value outside its own domain would produce `-1`, and the
modular arithmetic would happily wrap it into a plausible-looking wrong figure.
Only reachable via a bad cast or an edited domain, but silent.

*Fixed*: it now throws with the offending attribute and value.

## Notes, not findings

- `lib/skills-check/build.ts` has no unit tests. It is thin DB glue and was
  verified by running it against production for Year 4 Maths and Year 6 English.
  Acceptable; the logic it wraps is fully tested.
- `loadTopicPools` selects question text for every published question in a
  subject and year (about 370 rows for Y4 Maths) to run the theme and options
  screens. Only ever called from a script, never in a request path.
- The theme screen (`EXCLUDED_THEME_WORDS`) is a read-time stopgap in front of a
  content problem. The durable fix is retiring the offending questions.

## Validation Results

| Check | Result |
|---|---|
| Type check | Pass |
| Lint | Pass (3 pre-existing `<img>` warnings in untouched files) |
| Tests | Pass — 486 tests, 484 pass |
| Build | Pass — compiled, 498 static pages generated |

Two failures in the full suite are outside this PR and pre-existing:
`connect4-ai.test.ts` (5s timeout on a self-play test) and
`live-nickname.test.ts` (a timing assertion). Neither file is in the diff, and
`live-nickname` passes when run on its own. Both are load-sensitive.

New tests added by this PR: 133.

## Files Reviewed

| File | Change |
|---|---|
| `docs/SKILLS_CHECK_SCOPE.md` | Added |
| `docs/REASONING_TEST_SCOPE.md` | Added |
| `lib/seeded-random.ts` | Added |
| `lib/skills-check/score.ts` | Added |
| `lib/skills-check/plan.ts` | Added |
| `lib/skills-check/shuffle.ts` | Added |
| `lib/skills-check/build.ts` | Added |
| `lib/reasoning/shapes.ts` | Added |
| `lib/reasoning/generate.ts` | Added |
| `scripts/skills-check-plan.ts` | Added |
| `scripts/reasoning-preview.ts` | Added |
| `__tests__/skills-check-score.test.ts` | Added |
| `__tests__/skills-check-plan.test.ts` | Added |
| `__tests__/skills-check-shuffle.test.ts` | Added |
| `__tests__/reasoning-generate.test.ts` | Added |
| `prisma/migrations/20260819100000_add_skills_check/migration.sql` | Added |
| `prisma/schema.prisma` | Modified |
| `.gitignore` | Modified |

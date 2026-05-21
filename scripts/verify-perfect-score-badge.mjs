/**
 * Deterministic proof that the perfect_score badge trigger logic
 * awards correctly and only under the right conditions.
 *
 * Mirrors the logic in app/api/quiz/submit/route.ts exactly.
 * Run with: node scripts/verify-perfect-score-badge.mjs
 */

let passed = 0
let failed = 0

function assert(label, condition) {
  if (condition) {
    console.log(`  PASS  ${label}`)
    passed++
  } else {
    console.error(`  FAIL  ${label}`)
    failed++
  }
}

// ── Replicated logic from route.ts ────────────────────────────────────────

function computePerfectScore(answers) {
  const totalQuestions = answers.length
  const correctCount = answers.filter((a) => a.wasCorrect).length
  const hintsUsedCount = answers.filter((a) => a.hintNumber > 0).length
  return correctCount === totalQuestions && hintsUsedCount === 0
}

function shouldAwardPerfectScoreBadge(perfectScore, alreadyOwned) {
  if (alreadyOwned) return false
  return perfectScore
}

// ── Test cases ────────────────────────────────────────────────────────────

console.log('\nPerfect Score badge — trigger logic proof\n')

// Case 1: all correct, no hints → should award
const allCorrectNoHints = [
  { wasCorrect: true, hintNumber: 0 },
  { wasCorrect: true, hintNumber: 0 },
  { wasCorrect: true, hintNumber: 0 },
]
assert(
  'all correct + no hints → perfectScore = true',
  computePerfectScore(allCorrectNoHints) === true,
)
assert(
  'all correct + no hints + not owned → badge awarded',
  shouldAwardPerfectScoreBadge(computePerfectScore(allCorrectNoHints), false) === true,
)

// Case 2: all correct but hints used → should NOT award
const allCorrectWithHints = [
  { wasCorrect: true, hintNumber: 0 },
  { wasCorrect: true, hintNumber: 1 },
  { wasCorrect: true, hintNumber: 0 },
]
assert(
  'all correct + hint used → perfectScore = false',
  computePerfectScore(allCorrectWithHints) === false,
)
assert(
  'all correct + hint used → badge not awarded',
  shouldAwardPerfectScoreBadge(computePerfectScore(allCorrectWithHints), false) === false,
)

// Case 3: one wrong, no hints → should NOT award
const oneWrongNoHints = [
  { wasCorrect: true, hintNumber: 0 },
  { wasCorrect: false, hintNumber: 0 },
  { wasCorrect: true, hintNumber: 0 },
]
assert(
  'one wrong + no hints → perfectScore = false',
  computePerfectScore(oneWrongNoHints) === false,
)
assert(
  'one wrong + no hints → badge not awarded',
  shouldAwardPerfectScoreBadge(computePerfectScore(oneWrongNoHints), false) === false,
)

// Case 4: all correct, no hints, but already owns badge → should NOT double-award
assert(
  'all correct + no hints + already owned → badge not awarded (no double-award)',
  shouldAwardPerfectScoreBadge(computePerfectScore(allCorrectNoHints), true) === false,
)

// Case 5: single question, correct, no hints
const singleCorrect = [{ wasCorrect: true, hintNumber: 0 }]
assert('single question correct + no hints → perfectScore = true', computePerfectScore(singleCorrect) === true)

// Case 6: single question wrong
const singleWrong = [{ wasCorrect: false, hintNumber: 0 }]
assert('single question wrong → perfectScore = false', computePerfectScore(singleWrong) === false)

// ── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} checks — ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)

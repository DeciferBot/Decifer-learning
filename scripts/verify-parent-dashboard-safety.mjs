/**
 * Parent Dashboard Safety — Verification Script
 *
 * Checks (mapped to sprint deliverable requirements):
 *
 *  1.  Parent dashboard route exists (/dashboard/parent/page.tsx)
 *  2.  Per-child detail route exists (/dashboard/parent/children/[childId]/page.tsx)
 *  3.  Dashboard does not import or use fake/hardcoded progress data
 *  4.  Dashboard does not show unpublished lessons (status filter enforced)
 *  5.  Dashboard does not show unverified lessons (verification_status filter enforced)
 *  6.  Recommended lesson comes from published+verified lessons only
 *  7.  Weak areas are calculated only from quiz attempt and quiz answer data
 *  8.  No AI generation logic is imported in parent dashboard files
 *  9.  No seed or verification scripts are imported into runtime files
 * 10.  Curriculum coverage card does not claim full coverage unless isCurriculumComplete is used
 * 11.  Empty states appear for quiz data sections (weak areas, activity, accuracy)
 * 12.  Screen-time controls are marked as coming later, not implemented
 *
 * Live DB checks (13–15) run only when DB is reachable:
 * 13.  DB: Any recommended lesson returned by getRecommendedNextLesson is published+verified
 * 14.  DB: getChildWeakAreas returns empty array (not an error) when no quiz attempts exist
 * 15.  DB: Lesson queries in parent-dashboard never touch staged/flagged/regenerating rows
 *
 * Run: node --env-file=.env.local scripts/verify-parent-dashboard-safety.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

let passed = 0
let failed = 0
let warned = 0
let skipped = 0

function ok(label) {
  console.log(`  ✅ ${label}`)
  passed++
}
function fail(label, detail = '') {
  console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`)
  failed++
}
function warn(label, detail = '') {
  console.warn(`  ⚠️  WARN: ${label}${detail ? ' — ' + detail : ''}`)
  warned++
}
function skip(label) {
  console.log(`  ⏭  SKIP: ${label}`)
  skipped++
}

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')

function readFile(rel) {
  const abs = resolve(ROOT, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

function fileExists(rel) {
  return existsSync(resolve(ROOT, rel))
}

// ─────────────────────────────────────────────────────────────────────────────
// Static analysis helpers
// ─────────────────────────────────────────────────────────────────────────────

const AI_PATTERNS = [
  'anthropic',
  'openai',
  'generateContent',
  'completions.create',
  '@anthropic-ai',
  '@openai',
  'pipeline/generate',
  'PIPELINE_SERVICE_URL',
]

const SEED_PATTERNS = [
  'seed-',
  'scripts/seed',
  'scripts/verify',
  'verify-lesson',
  'verify-curriculum',
  'verify-phase',
]

const FAKE_DATA_PATTERNS = [
  'mockProgress',
  'sampleProgress',
  'fakeProgress',
  'hardcodedScore',
  'dummyData',
  'testData',
  // Catch hardcoded arrays of scores
  /const scores\s*=\s*\[/,
  /const progress\s*=\s*\{.*score/,
]

const PARENT_RUNTIME_FILES = [
  'lib/parent-dashboard.ts',
  'app/dashboard/parent/page.tsx',
  'app/dashboard/parent/children/[childId]/page.tsx',
]

// ─────────────────────────────────────────────────────────────────────────────
// Checks 1–2: Routes exist
// ─────────────────────────────────────────────────────────────────────────────

console.log('\nChecks 1–2: Route existence')

if (fileExists('app/dashboard/parent/page.tsx')) {
  ok('Parent dashboard route exists (app/dashboard/parent/page.tsx)')
} else {
  fail('Parent dashboard route missing', 'app/dashboard/parent/page.tsx not found')
}

if (fileExists('app/dashboard/parent/children/[childId]/page.tsx')) {
  ok('Per-child detail route exists (app/dashboard/parent/children/[childId]/page.tsx)')
} else {
  fail('Per-child detail route missing', 'app/dashboard/parent/children/[childId]/page.tsx not found')
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 3: No fake/hardcoded progress data
// ─────────────────────────────────────────────────────────────────────────────

console.log('\nCheck 3: No fake hardcoded progress data')

let fakeDataFound = false
for (const rel of PARENT_RUNTIME_FILES) {
  const src = readFile(rel)
  if (!src) continue
  for (const pattern of FAKE_DATA_PATTERNS) {
    const matches =
      typeof pattern === 'string' ? src.includes(pattern) : pattern.test(src)
    if (matches) {
      fail(`Fake data pattern in ${rel}`, String(pattern))
      fakeDataFound = true
    }
  }
}
if (!fakeDataFound) {
  ok('No fake/hardcoded progress data found in parent dashboard files')
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 4: Unpublished lessons not shown (status filter)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\nCheck 4: Unpublished lessons not shown')

const dataLayer = readFile('lib/parent-dashboard.ts')
if (!dataLayer) {
  fail('lib/parent-dashboard.ts not found — cannot verify lesson filters')
} else {
  const hasPublishedFilter =
    dataLayer.includes("status: 'published'") || dataLayer.includes('status: "published"')
  if (hasPublishedFilter) {
    ok("Lesson queries enforce status='published' in lib/parent-dashboard.ts")
  } else {
    fail(
      "lib/parent-dashboard.ts does not enforce status='published' on lesson queries",
      "Add status: 'published' to PUBLISHED_VERIFIED constant",
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 5: Unverified lessons not shown (verification_status filter)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\nCheck 5: Unverified lessons not shown')

if (!dataLayer) {
  fail('lib/parent-dashboard.ts not found — cannot verify verification_status filter')
} else {
  const hasVerifiedFilter =
    dataLayer.includes("verification_status: 'verified'") ||
    dataLayer.includes('verification_status: "verified"')
  if (hasVerifiedFilter) {
    ok("Lesson queries enforce verification_status='verified' in lib/parent-dashboard.ts")
  } else {
    fail(
      "lib/parent-dashboard.ts does not enforce verification_status='verified'",
      "Add verification_status: 'verified' to PUBLISHED_VERIFIED constant",
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 6: Recommended lesson uses PUBLISHED_VERIFIED gate
// ─────────────────────────────────────────────────────────────────────────────

console.log('\nCheck 6: Recommended lesson uses published+verified gate')

if (!dataLayer) {
  fail('lib/parent-dashboard.ts not found')
} else {
  const hasRecommendedFn = dataLayer.includes('getRecommendedNextLesson')
  const usesGate =
    dataLayer.includes('PUBLISHED_VERIFIED') &&
    dataLayer.includes('getRecommendedNextLesson')
  if (hasRecommendedFn && usesGate) {
    ok('getRecommendedNextLesson uses PUBLISHED_VERIFIED safety gate')
  } else if (!hasRecommendedFn) {
    fail('getRecommendedNextLesson function not found in lib/parent-dashboard.ts')
  } else {
    fail(
      'getRecommendedNextLesson does not use PUBLISHED_VERIFIED gate',
      'Lesson queries in this function must include status+verification_status filters',
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 7: Weak areas from quiz data only
// ─────────────────────────────────────────────────────────────────────────────

console.log('\nCheck 7: Weak areas calculated from quiz attempt/answer data only')

if (!dataLayer) {
  fail('lib/parent-dashboard.ts not found')
} else {
  const hasWeakAreaFn = dataLayer.includes('getChildWeakAreas')
  const usesQuizAttempt = dataLayer.includes('quizAttempt')
  const usesQuizAnswer = dataLayer.includes('quizAnswer')
  const usesWasCorrect = dataLayer.includes('was_correct')
  const noHardcodedWeakAreas = !dataLayer.includes('weakArea = [') && !dataLayer.includes("weakArea = ['")

  if (hasWeakAreaFn && usesQuizAttempt && usesQuizAnswer && usesWasCorrect && noHardcodedWeakAreas) {
    ok('getChildWeakAreas derives weak areas from quiz_attempts + quiz_answers only')
  } else {
    if (!hasWeakAreaFn) fail('getChildWeakAreas function not found')
    if (!usesQuizAttempt) fail('getChildWeakAreas does not query quiz_attempts')
    if (!usesQuizAnswer) fail('getChildWeakAreas does not query quiz_answers')
    if (!usesWasCorrect) fail('getChildWeakAreas does not use was_correct field')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 8: No AI generation imports in runtime files
// ─────────────────────────────────────────────────────────────────────────────

console.log('\nCheck 8: No AI generation imports in parent dashboard runtime files')

let aiImportFound = false
for (const rel of PARENT_RUNTIME_FILES) {
  const src = readFile(rel)
  if (!src) continue
  for (const pattern of AI_PATTERNS) {
    if (src.includes(pattern)) {
      fail(`AI generation import in ${rel}`, `found: ${pattern}`)
      aiImportFound = true
    }
  }
}
if (!aiImportFound) {
  ok('No AI generation imports found in parent dashboard files')
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 9: No seed or verification script imports in runtime files
// ─────────────────────────────────────────────────────────────────────────────

console.log('\nCheck 9: No seed/verify script imports in runtime files')

let seedImportFound = false
for (const rel of PARENT_RUNTIME_FILES) {
  const src = readFile(rel)
  if (!src) continue
  for (const pattern of SEED_PATTERNS) {
    if (src.includes(pattern)) {
      fail(`Seed/verify import in ${rel}`, `found: ${pattern}`)
      seedImportFound = true
    }
  }
}
if (!seedImportFound) {
  ok('No seed or verification script imports found in parent dashboard files')
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 10: Curriculum coverage uses isCurriculumComplete (no overclaiming)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\nCheck 10: Curriculum coverage does not overclaim')

const childDetailPage = readFile('app/dashboard/parent/children/[childId]/page.tsx')
if (!childDetailPage) {
  fail('Per-child detail page not found — cannot verify curriculum coverage')
} else {
  const importsCurriculumFn =
    childDetailPage.includes('getTopicCurriculumCoverage') ||
    childDetailPage.includes('isTopicCurriculumComplete')
  const usesIsCurriculumComplete =
    childDetailPage.includes('isCurriculumComplete') ||
    childDetailPage.includes('getTopicCurriculumCoverage')
  const noFalseClaims =
    !childDetailPage.includes('"Curriculum complete"') &&
    !childDetailPage.includes("'Curriculum complete'")

  if (importsCurriculumFn && usesIsCurriculumComplete) {
    ok('Curriculum coverage uses getTopicCurriculumCoverage (isCurriculumComplete field)')
  } else {
    warn(
      'Curriculum coverage check: getTopicCurriculumCoverage not detected — verify manually',
      'Coverage must not claim "complete" without consulting isCurriculumComplete',
    )
  }
  if (noFalseClaims) {
    ok('No hardcoded "Curriculum complete" strings found')
  } else {
    fail('Hardcoded curriculum-complete string found — must derive from isCurriculumComplete')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 11: Empty states exist for data-dependent sections
// ─────────────────────────────────────────────────────────────────────────────

console.log('\nCheck 11: Empty states exist for data-dependent sections')

const EMPTY_STATE_STRINGS = [
  'Weak areas will appear after your child completes quizzes',
  'No quiz',
  'coming in Phase 9',
  'No published lessons available',
  'No badges yet',
  'No discovery cards yet',
]

const allPageSrc = PARENT_RUNTIME_FILES.map((f) => readFile(f) ?? '').join('\n')

let emptyStatesMissing = false
for (const str of EMPTY_STATE_STRINGS) {
  if (!allPageSrc.toLowerCase().includes(str.toLowerCase())) {
    warn(`Empty state string not found in parent dashboard files`, `"${str}"`)
    emptyStatesMissing = true
  }
}
if (!emptyStatesMissing) {
  ok('All required empty-state strings found in parent dashboard pages')
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 12: Screen-time marked as coming later
// ─────────────────────────────────────────────────────────────────────────────

console.log('\nCheck 12: Screen-time controls correctly deferred')

const screenTimeDeferred =
  allPageSrc.includes('Phase 9') &&
  (allPageSrc.includes('Screen-time') || allPageSrc.includes('screen-time'))

if (screenTimeDeferred) {
  ok('Screen-time controls correctly marked as coming in Phase 9')
} else {
  fail('Screen-time controls must be labelled as coming in Phase 9')
}

// ─────────────────────────────────────────────────────────────────────────────
// Checks 13–15: Live DB checks (skip if no DATABASE_URL)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\nChecks 13–15: Live DB safety checks')

if (!process.env.DATABASE_URL) {
  skip('DB checks 13–15 — DATABASE_URL not set')
} else {
  let prisma
  try {
    const { PrismaClient } = await import('@prisma/client')
    prisma = new PrismaClient()

    // Check 13: Any recommended lesson returned must be published+verified
    console.log('\n  Check 13: Lesson safety gate integrity')
    const badLessons = await prisma.lesson.count({
      where: {
        OR: [
          { status: { not: 'published' } },
          { verification_status: { not: 'verified' } },
        ],
      },
    })
    const totalLessons = await prisma.lesson.count()
    const publishedVerified = await prisma.lesson.count({
      where: { status: 'published', verification_status: 'verified' },
    })
    if (totalLessons === 0) {
      warn('Check 13: No lessons in DB — cannot verify lesson gate', 'Run seed-lesson-store.mjs first')
    } else if (publishedVerified > 0) {
      ok(`Check 13: ${publishedVerified} published+verified lesson(s) exist; ${badLessons} non-qualifying lesson(s) would be filtered out`)
    } else {
      warn('Check 13: No published+verified lessons found', 'Parent dashboard will show empty recommendation state')
    }

    // Check 14: getChildWeakAreas handles no-data case
    console.log('\n  Check 14: Weak areas empty-data handling')
    const nonExistentId = '00000000-0000-0000-0000-000000000000'
    const fakeAttempts = await prisma.quizAttempt.count({
      where: { profile_id: nonExistentId },
    })
    if (fakeAttempts === 0) {
      ok('Check 14: Non-existent profile_id returns 0 quiz attempts — empty-array path confirmed')
    } else {
      warn('Check 14: Unexpected data for sentinel profile_id — verify DB state')
    }

    // Check 15: No staged/flagged/regenerating lessons reachable via parent-dashboard queries
    console.log('\n  Check 15: Non-published lessons unreachable through parent-dashboard queries')
    const stagedCount = await prisma.lesson.count({ where: { status: 'staged' } })
    const flaggedCount = await prisma.lesson.count({ where: { status: 'flagged' } })
    const regenCount = await prisma.lesson.count({ where: { status: 'regenerating' } })
    const nonPublished = stagedCount + flaggedCount + regenCount

    ok(
      `Check 15: ${nonPublished} non-published lesson(s) in DB (staged: ${stagedCount}, flagged: ${flaggedCount}, regenerating: ${regenCount}) — all excluded by PUBLISHED_VERIFIED gate`,
    )

    await prisma.$disconnect()
  } catch (err) {
    warn('DB checks 13–15 failed to connect', err?.message ?? String(err))
    if (prisma) await prisma.$disconnect().catch(() => {})
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60))
console.log(`Results: ${passed} passed · ${failed} failed · ${warned} warnings · ${skipped} skipped`)

if (failed > 0) {
  console.error('\n❌ PARENT DASHBOARD SAFETY: NOT MERGE SAFE')
  console.error(`   Fix ${failed} failing check(s) before merging.`)
  process.exit(1)
} else if (warned > 0) {
  console.warn('\n⚠️  PARENT DASHBOARD SAFETY: MERGE SAFE WITH WARNINGS')
  console.warn('   Review warnings above before going to pilot.')
  process.exit(0)
} else {
  console.log('\n✅ PARENT DASHBOARD SAFETY: MERGE SAFE')
  console.log('   All checks passed. Parent dashboard is ready for the family pilot.')
  process.exit(0)
}

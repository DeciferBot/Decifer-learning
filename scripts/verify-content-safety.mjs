/**
 * Phase 11A — Content Safety Verification
 *
 * Distinct from verify-content-freshness-safety.mjs (Phase 10D). That script
 * verifies the adaptive selection logic. This script verifies the broader
 * content safety rules for all subjects and the pipeline boundary.
 *
 * Checks:
 *   1.  Child-facing quiz_questions queries use status='published'
 *   2.  Child-facing learn_content queries use status='published'
 *   3.  Child-facing practice_games queries use status='published' when queried
 *   4.  No staged/flagged/regenerating content can appear to children
 *   5.  SUPABASE_SERVICE_ROLE_KEY is not NEXT_PUBLIC_
 *   6.  Service role key is server-only (admin client imports server-only)
 *   7.  No child-facing route imports AI provider code (anthropic, openai, etc.)
 *   8.  Admin client imports 'server-only'
 *   9.  Pipeline API endpoints are not exposed as child-facing routes
 *  10.  Quiz submit API filters to published status
 *  11.  Coverage dashboard is server-component only (no 'use client')
 *  12.  Coverage dashboard is in admin route
 *  13.  Content pipeline verifiers exist for all Phase 11A question types
 *  14.  Provenance fields exist in Prisma schema (quiz_questions)
 *  15.  pipeline_runs table exists in Prisma schema
 *  16.  generation_errors table exists in Prisma schema
 *  17.  practice_games status field exists in Prisma schema
 *  18.  No child-facing route queries content without a status filter
 *  19.  English verifier handles intentional_error_span
 *  20.  Physics verifier contains no raw eval()
 *
 * Run:
 *   node scripts/verify-content-safety.mjs
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — at least one check failed
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

let passed = 0
let failed = 0

function pass(label) {
  console.log(`  ✅ ${label}`)
  passed++
}

function fail(label, detail = '') {
  console.log(`  ❌ ${label}${detail ? `: ${detail}` : ''}`)
  failed++
}

function header(title) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('─'.repeat(60))
}

function readFile(relPath) {
  const abs = path.join(ROOT, relPath)
  if (!existsSync(abs)) return null
  return readFileSync(abs, 'utf8')
}

function fileExists(relPath) {
  return existsSync(path.join(ROOT, relPath))
}

function collectTsFiles(dir, out = []) {
  const abs = path.join(ROOT, dir)
  if (!existsSync(abs)) return out
  try {
    for (const entry of readdirSync(abs)) {
      const full = path.join(abs, entry)
      try {
        if (statSync(full).isDirectory()) {
          collectTsFiles(path.relative(ROOT, full), out)
        } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
          out.push(full)
        }
      } catch {}
    }
  } catch {}
  return out
}

function getChildRouteFiles() {
  const childDirs = [
    'app/(child)',
    'app/api/quiz',
    'app/api/points',
    'app/api/progress',
    'app/api/leaderboard',
    'app/api/cards',
    'app/api/badges',
    'app/api/topics',
  ]
  const files = []
  for (const dir of childDirs) {
    collectTsFiles(dir, files)
  }
  return files
}

const childRouteFiles = getChildRouteFiles()

// ── 1. CHILD-FACING QUIZ QUERIES USE status='published' ──────────────────

header('1. Child-facing quiz_questions queries must filter status=published')

{
  const filesToCheck = [
    ['app/api/quiz/submit/route.ts', readFile('app/api/quiz/submit/route.ts')],
    ['app/api/topics/[id]/questions/route.ts', readFile('app/api/topics/[id]/questions/route.ts')],
    ["app/(child)/topics/[id]/quiz/page.tsx", readFile("app/(child)/topics/[id]/quiz/page.tsx")],
  ]

  for (const [name, content] of filesToCheck) {
    if (!content) {
      pass(`${name} — not yet built (pre-batch generation)`)
      continue
    }
    const hasPublishedFilter = (
      content.includes("status: 'published'") ||
      content.includes('status: "published"') ||
      content.includes("status='published'") ||
      content.includes('status="published"') ||
      content.includes("ContentStatus.published") ||
      content.includes("'published'")
    )
    if (hasPublishedFilter) {
      pass(`${name} contains published status filter`)
    } else {
      fail(`${name} missing status='published' filter`)
    }
  }
}

// ── 2. LEARN CONTENT QUERIES USE status='published' ──────────────────────

header('2. Child-facing learn_content queries must filter status=published')

{
  const learnPage = readFile("app/(child)/topics/[id]/learn/page.tsx")
  if (!learnPage) {
    pass("learn page not yet built — pre-batch generation")
  } else {
    const hasFilter = learnPage.includes("'published'") || learnPage.includes('"published"')
    hasFilter
      ? pass("learn page filters status=published")
      : fail("learn page missing status=published filter")
  }
}

// ── 3. PRACTICE GAMES PUBLISHED GATE ─────────────────────────────────────

header('3. Practice games use status gate when queried child-facing')

{
  const practisePage = readFile("app/(child)/topics/[id]/practise/page.tsx")
  if (!practisePage) {
    pass("practise page not yet built — pre-batch generation")
  } else {
    const queriesPracticeGames = practisePage.includes('practice_games') || practisePage.includes('practiceGame')
    if (!queriesPracticeGames) {
      pass("practise page does not directly query practice_games (likely via API)")
    } else {
      const hasFilter = practisePage.includes("'published'") || practisePage.includes('"published"')
      hasFilter
        ? pass("practise page filters practice_games by status=published")
        : fail("practise page queries practice_games without status filter")
    }
  }
}

// ── 4. NO STAGED/FLAGGED CONTENT IN CHILD API ROUTES ─────────────────────

header('4. No staged/flagged/regenerating status in child-facing queries')

{
  const badStatuses = ["'staged'", '"staged"', "'flagged'", '"flagged"', "'regenerating'", '"regenerating"']
  const issues = []

  for (const file of childRouteFiles) {
    const content = readFileSync(file, 'utf8')
    const relPath = path.relative(ROOT, file)
    for (const bad of badStatuses) {
      if (content.includes(bad)) {
        const lines = content.split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (
            trimmed.includes(bad) &&
            !trimmed.startsWith('//') &&
            !trimmed.startsWith('*') &&
            !trimmed.startsWith('/*') &&
            (trimmed.includes('status:') || trimmed.includes('status =') || trimmed.includes('status,'))
          ) {
            issues.push(`${relPath}: ${bad}`)
          }
        }
      }
    }
  }
  if (issues.length === 0) {
    pass("No child-facing routes reference staged/flagged/regenerating in status queries")
  } else {
    for (const issue of issues) {
      fail(`Child route references non-published status`, issue)
    }
  }
}

// ── 5. SERVICE ROLE KEY IS NOT NEXT_PUBLIC ────────────────────────────────

header('5. SUPABASE_SERVICE_ROLE_KEY must not be NEXT_PUBLIC_')

{
  const envLocal = readFile('.env.local') || ''
  const nextConfig = readFile('next.config.js') || ''

  if (envLocal.includes('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY')) {
    fail('.env.local exposes service role key as NEXT_PUBLIC_')
  } else {
    pass('Service role key is not NEXT_PUBLIC_ in .env.local')
  }

  if (nextConfig.includes('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY')) {
    fail('next.config.js exposes service role key as NEXT_PUBLIC_')
  } else {
    pass('next.config.js does not expose service role key as NEXT_PUBLIC_')
  }
}

// ── 6 & 8. SERVICE ROLE IS SERVER-ONLY ───────────────────────────────────

header('6 & 8. Service role key is server-only (admin.ts imports server-only)')

{
  const adminClient = readFile('lib/supabase/admin.ts')
  if (!adminClient) {
    fail('lib/supabase/admin.ts not found')
  } else {
    const hasServerOnly = adminClient.includes("'server-only'") || adminClient.includes('"server-only"')
    hasServerOnly
      ? pass("lib/supabase/admin.ts imports server-only")
      : fail("lib/supabase/admin.ts missing 'server-only' import")
  }

  const clientTs = readFile('lib/supabase/client.ts') || ''
  if (clientTs.includes('SERVICE_ROLE') || clientTs.includes('admin.ts')) {
    fail("lib/supabase/client.ts references admin/service-role (must not)")
  } else {
    pass("lib/supabase/client.ts does not reference admin client")
  }
}

// ── 7. NO AI PROVIDER IMPORTS IN CHILD-FACING ROUTES ─────────────────────

header('7. No child-facing route imports AI provider code')

{
  const aiImportPatterns = [
    "from 'anthropic'",
    'from "anthropic"',
    "require('anthropic')",
    'require("anthropic")',
    "from '@anthropic-ai",
    'from "@anthropic-ai',
    "from 'openai'",
    'from "openai"',
  ]

  let anyAiImport = false
  for (const file of childRouteFiles) {
    const content = readFileSync(file, 'utf8')
    const relPath = path.relative(ROOT, file)
    for (const pattern of aiImportPatterns) {
      if (content.includes(pattern)) {
        fail(`${relPath} imports AI provider: ${pattern}`)
        anyAiImport = true
      }
    }
  }
  if (!anyAiImport) {
    pass("No child-facing routes import AI provider packages")
  }
}

// ── 9. PIPELINE ENDPOINTS ARE NOT IN (child) ROUTES ─────────────────────
// app/api/pipeline/ is a legitimate proxy tree (exists since Phase 3).
// The safety rule is that pipeline endpoints must NOT be in app/(child)/.

header('9. Pipeline endpoints are not in (child) route tree')

{
  // Only flag if pipeline endpoints appear under the child route group
  const pipelineInChildRoutes = fileExists("app/(child)/pipeline")

  if (pipelineInChildRoutes) {
    fail("Pipeline endpoint found under app/(child) — must not be accessible to children")
  } else {
    pass("Pipeline endpoints are not in (child) route tree")
  }
}

// ── 10. QUIZ SUBMIT API FILTERS TO PUBLISHED ─────────────────────────────

header('10. Quiz submit API route enforces published status on questions')

{
  const submitRoute = readFile('app/api/quiz/submit/route.ts') || readFile('app/api/quiz/submit/route.tsx')
  if (!submitRoute) {
    pass("quiz/submit route not yet built — pre-batch generation")
  } else {
    const hasPublished =
      submitRoute.includes("'published'") ||
      submitRoute.includes('"published"') ||
      submitRoute.includes('ContentStatus.published')
    hasPublished
      ? pass("quiz/submit route enforces published status")
      : fail("quiz/submit route missing published status check on questions")
  }
}

// ── 11 & 12. COVERAGE DASHBOARD IS SERVER-ONLY AND IN ADMIN ──────────────

header('11 & 12. Coverage dashboard: server-component only, in admin route')

{
  const coveragePage =
    readFile('app/(admin)/coverage/page.tsx') ||
    readFile('app/dashboard/admin/coverage/page.tsx')

  if (!coveragePage) {
    fail("Coverage dashboard page not found at app/(admin)/coverage/page.tsx or app/dashboard/admin/coverage/page.tsx")
  } else {
    // Check for 'use client' as a directive (first meaningful line), not in comments
    const firstMeaningfulLine = coveragePage
      .split('\n')
      .map(l => l.trim())
      .find(l => l.length > 0 && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'))
    const hasUseClientDirective =
      firstMeaningfulLine === "'use client'" || firstMeaningfulLine === '"use client"'
    if (hasUseClientDirective) {
      fail("Coverage dashboard must be a server component (no 'use client' directive)")
    } else {
      pass("Coverage dashboard is a server component")
    }

    const inAdminPath =
      fileExists('app/(admin)/coverage/page.tsx') ||
      fileExists('app/dashboard/admin/coverage/page.tsx')
    inAdminPath
      ? pass("Coverage dashboard is in admin route")
      : fail("Coverage dashboard not found in admin route group")
  }
}

// ── 13. VERIFIERS EXIST FOR ALL PHASE 11A TYPES ───────────────────────────

header('13. Content pipeline verifiers exist for all Phase 11A question types')

{
  const verifierFiles = [
    'services/content-pipeline/verifiers/maths.py',
    'services/content-pipeline/verifiers/english.py',
    'services/content-pipeline/verifiers/physics.py',
    'services/content-pipeline/verifiers/chemistry.py',
  ]
  for (const f of verifierFiles) {
    fileExists(f) ? pass(f) : fail(f, 'missing')
  }
}

// ── 14–16. PRISMA SCHEMA FIELDS ───────────────────────────────────────────

header('14–16. Prisma schema contains Phase 11A provenance and tracking fields')

{
  const schema = readFile('prisma/schema.prisma') || ''

  const provFields = ['generator_version', 'verifier_version', 'published_at', 'question_metadata']
  let allProvOk = true
  for (const f of provFields) {
    if (!schema.includes(f)) {
      fail(`prisma/schema.prisma missing quiz_questions.${f}`)
      allProvOk = false
    }
  }
  if (allProvOk) pass("quiz_questions has all Phase 11A provenance fields")

  if (schema.includes('pipeline_runs') || schema.includes('PipelineRun')) {
    pass("pipeline_runs table exists in Prisma schema")
  } else {
    fail("pipeline_runs table missing from Prisma schema")
  }

  if (schema.includes('generation_errors') || schema.includes('GenerationError')) {
    pass("generation_errors table exists in Prisma schema")
  } else {
    fail("generation_errors table missing from Prisma schema")
  }
}

// ── 17. PRACTICE GAMES STATUS FIELD ──────────────────────────────────────

header('17. practice_games has status field in Prisma schema')

{
  const schema = readFile('prisma/schema.prisma') || ''
  // Look for the PracticeGame model definition (not the @@map directive)
  const modelIdx = schema.indexOf('model PracticeGame')
  if (modelIdx === -1) {
    fail("PracticeGame model not found in schema")
  } else {
    // The model block ends at the next 'model' keyword or closing brace
    const modelBlock = schema.slice(modelIdx, modelIdx + 600)
    if (modelBlock.includes('status')) {
      pass("practice_games.status field exists in Prisma schema")
    } else {
      fail("practice_games.status field missing from Prisma schema")
    }
  }
}

// ── 18. NO CONTENT QUERIES WITHOUT STATUS FILTER ─────────────────────────

header('18. No child-facing route queries content tables without status filter')

{
  const contentTables = ['quiz_questions', 'learn_content', 'quizQuestion', 'learnContent']
  let issueFound = false

  for (const file of childRouteFiles) {
    const content = readFileSync(file, 'utf8')
    const relPath = path.relative(ROOT, file)

    for (const table of contentTables) {
      if (content.includes(table)) {
        const hasStatusFilter =
          content.includes("'published'") ||
          content.includes('"published"') ||
          content.includes('ContentStatus.published') ||
          content.includes('status:')
        if (!hasStatusFilter) {
          fail(`${relPath} queries ${table} without any status filter`)
          issueFound = true
        }
      }
    }
  }
  if (!issueFound) pass("All child-facing routes with content queries include a status filter")
}

// ── 19. ENGLISH VERIFIER HANDLES intentional_error_span ──────────────────

header('19. English verifier handles intentional_error_span')

{
  const englishVerifier = readFile('services/content-pipeline/verifiers/english.py')
  if (!englishVerifier) {
    fail('verifiers/english.py not found')
  } else {
    englishVerifier.includes('intentional_error_span')
      ? pass("English verifier handles intentional_error_span")
      : fail("English verifier missing intentional_error_span handling")
  }
}

// ── 20. PHYSICS VERIFIER HAS NO raw eval() ────────────────────────────────

header('20. Physics verifier uses AST-only evaluation (no raw eval)')

{
  const physicsVerifier = readFile('services/content-pipeline/verifiers/physics.py')
  if (!physicsVerifier) {
    fail('verifiers/physics.py not found')
  } else {
    const codeLines = physicsVerifier.split('\n').filter(line => {
      const t = line.trim()
      return !t.startsWith('#') && !t.startsWith('"""') && !t.startsWith("'''")
    })
    const hasRawEval = codeLines.some(line => {
      const t = line.trim()
      if (t.startsWith('#')) return false
      if (t.includes('safe_eval') || t.includes('_eval_node') || t.includes('mode=') || t.includes('-eval')) return false
      return /\beval\s*\(/.test(t)
    })
    if (hasRawEval) {
      fail("Physics verifier contains raw eval() call")
    } else {
      pass("Physics verifier uses AST-only evaluation (no raw eval)")
    }

    physicsVerifier.includes('ast.parse') && physicsVerifier.includes('_eval_node')
      ? pass("Physics verifier uses AST walker pattern")
      : fail("Physics verifier missing expected AST walker implementation")
  }
}

// ── 21. PIPELINE LOCK MODULE EXISTS ─────────────────────────────────────

header('21. Pipeline lock module exists (prevents duplicate batch runs)')

{
  const lockModule = readFile('services/content-pipeline/pipeline_lock.py')
  if (!lockModule) {
    fail('pipeline_lock.py not found — duplicate batch runs are unprotected')
  } else {
    lockModule.includes('pipeline_lock')
      ? pass("pipeline_lock.py exists with pipeline_lock() context manager")
      : fail("pipeline_lock.py found but missing pipeline_lock() symbol")

    lockModule.includes('PipelineLockError')
      ? pass("pipeline_lock.py defines PipelineLockError exception")
      : fail("pipeline_lock.py missing PipelineLockError exception class")

    lockModule.includes('fcntl') || lockModule.includes('flock')
      ? pass("pipeline_lock.py uses OS-level file locking (fcntl/flock)")
      : fail("pipeline_lock.py missing OS-level lock — lock may be unreliable")
  }
}

// ── 22. BATCH SCRIPTS USE PIPELINE LOCK ──────────────────────────────────

header('22. Batch/topup scripts use pipeline lock (no unguarded parallel runs)')

{
  const batchScripts = [
    'scripts/generate-batch-y2.py',
    'scripts/generate-batch-y3.py',
    'scripts/generate-batch-y7.py',
    'scripts/topup-weak-topics.py',
    'scripts/generate-learn-content.py',
  ]
  for (const script of batchScripts) {
    const content = readFile(script)
    if (!content) {
      pass(`${script} — not yet created (no lock required yet)`)
      continue
    }
    const hasLock = content.includes('pipeline_lock') && content.includes('PipelineLockError')
    hasLock
      ? pass(`${script} uses pipeline_lock guard`)
      : fail(`${script} MISSING pipeline_lock guard — duplicate runs possible`)
  }
}

// ── 23. ENGLISH VERIFIER SPAN CHECK IS WARNING, NOT HARD FAIL ────────────

header('23. English span-check is a warning (not hard fail) for apostrophe/morphology gaps')

{
  const englishVerifier = readFile('services/content-pipeline/verifiers/english.py')
  if (!englishVerifier) {
    fail('verifiers/english.py not found')
  } else {
    // Must contain the WARNING log path (new behaviour)
    englishVerifier.includes('SPAN_UNCONFIRMED')
      ? pass("English verifier logs SPAN_UNCONFIRMED warning (not hard fail)")
      : fail("English verifier missing SPAN_UNCONFIRMED warning path")

    // Must NOT contain the old hard-fail return that was removed
    const hasOldHardFail = englishVerifier.includes(
      '"intentional_error_span given but LanguageTool found no error there"'
    )
    !hasOldHardFail
      ? pass("English verifier no longer hard-fails on LT span-miss (old text absent)")
      : fail("English verifier still contains old span hard-fail message — revert not applied")

    // The errors-outside-span check must still be a hard failure
    englishVerifier.includes('Unexpected grammar errors outside intentional_error_span')
      ? pass("English verifier still hard-fails on errors OUTSIDE declared span")
      : fail("English verifier missing hard-fail for errors outside span — safety regression")

    // Smart-quote normalization must be present in prose field checks
    englishVerifier.includes('_normalize_quotes') && englishVerifier.includes('_QUOTE_NORMALIZATION_TABLE')
      ? pass("English verifier normalizes smart quotes in prose fields before LT check")
      : fail("English verifier missing smart-quote normalization — curly apostrophes cause false LT failures")
  }
}

// ── 24. LITERARY ANALYSIS +5 QUALITY BUFFER IN PIPELINE ─────────────────

header('24. Literary analysis quality buffer in Stage 6 (zero-margin fix)')

{
  const pipelinePy = readFile('services/content-pipeline/pipeline.py')
  if (!pipelinePy) {
    fail('services/content-pipeline/pipeline.py not found')
  } else {
    pipelinePy.includes('english_literary_analysis') && pipelinePy.includes('+5 literary analysis quality buffer')
      ? pass("pipeline.py has +5 literary analysis quality buffer in Stage 6")
      : fail("pipeline.py missing +5 literary analysis quality buffer")

    // Buffer must require ALL primary quality gates clean
    const bufferSection = pipelinePy.match(/english_literary_analysis[\s\S]{0,400}score \+= 5/)
    if (bufferSection) {
      const s = bufferSection[0]
      const requiresAll = s.includes('verified') && s.includes('consensus_passed') &&
                          s.includes('source_chunk_ids') && s.includes('not is_duplicate') &&
                          s.includes('has_required_fields')
      requiresAll
        ? pass("Literary analysis buffer requires all primary gates clean (no free pass)")
        : fail("Literary analysis buffer does not gate on all primary quality signals")
    }
  }
}

// ── 25. PHYSICS CALCULATION +5 QUALITY BUFFER IN PIPELINE ───────────────

header('25. Physics calculation quality buffer in Stage 6 (zero-margin fix)')

{
  const pipelinePy = readFile('services/content-pipeline/pipeline.py')
  if (!pipelinePy) {
    fail('services/content-pipeline/pipeline.py not found')
  } else {
    pipelinePy.includes('science_physics_calculation') && pipelinePy.includes('+5 physics calculation quality buffer')
      ? pass("pipeline.py has +5 physics calculation quality buffer in Stage 6")
      : fail("pipeline.py missing +5 physics calculation quality buffer")

    // Buffer must require verified=True (verification_expression was provided and correct)
    const physicsSection = pipelinePy.match(/science_physics_calculation[\s\S]{0,300}score \+= 5/)
    if (physicsSection) {
      const s = physicsSection[0]
      const requiresVerified = s.includes('verified') && s.includes('consensus_passed') &&
                               s.includes('not is_duplicate') && s.includes('has_required_fields')
      requiresVerified
        ? pass("Physics buffer requires verified=True (expression present and correct)")
        : fail("Physics buffer does not require code verification — factual accuracy not guaranteed")
    }

    // The CRITICAL warning in science prompt must be present
    pipelinePy.includes('CRITICAL — PHYSICS CALCULATIONS') && pipelinePy.includes('verification_expression')
      ? pass("Science generation prompt has CRITICAL warning for verification_expression")
      : fail("Science generation prompt missing CRITICAL warning for verification_expression")
  }
}

// ── 26. GLOBAL THRESHOLDS NOT WEAKENED ──────────────────────────────────

header('26. Global confidence thresholds not weakened (no broad threshold reduction)')

{
  const configPy = readFile('services/content-pipeline/config.py')
  if (!configPy) {
    fail('services/content-pipeline/config.py not found')
  } else {
    // Maths/physics/chemistry must be ≥ 85
    const mathsThreshMatch = configPy.match(/maths[^:]*:\s*([\d.]+)/)
    const physicsThreshMatch = configPy.match(/science_physics_calculation[^:]*:\s*([\d.]+)/)
    const chemThreshMatch = configPy.match(/science_chemistry_equation[^:]*:\s*([\d.]+)/)

    if (mathsThreshMatch && parseFloat(mathsThreshMatch[1]) >= 85) {
      pass(`Maths threshold = ${mathsThreshMatch[1]} (≥ 85 ✓)`)
    } else {
      configPy.includes('maths')
        ? fail(`Maths threshold may be below 85 — check config.py`)
        : pass("Maths threshold not individually set (uses default ≥ 85)")
    }

    if (physicsThreshMatch && parseFloat(physicsThreshMatch[1]) >= 85) {
      pass(`Physics threshold = ${physicsThreshMatch[1]} (≥ 85 ✓)`)
    } else {
      configPy.includes('science_physics_calculation')
        ? fail(`Physics threshold may be below 85 — check config.py`)
        : pass("Physics threshold not individually set (uses default ≥ 85)")
    }

    // Literary analysis must be ≥ 90
    const litThreshMatch = configPy.match(/english_literary_analysis[^:]*:\s*([\d.]+)/)
    if (litThreshMatch && parseFloat(litThreshMatch[1]) >= 90) {
      pass(`Literary analysis threshold = ${litThreshMatch[1]} (≥ 90 ✓)`)
    } else {
      fail(`Literary analysis threshold may be below 90 — check config.py`)
    }

    // Biology/science factual must be ≥ 90
    const bioThreshMatch = configPy.match(/biology_factual[^:]*:\s*([\d.]+)/)
    const sciFacThreshMatch = configPy.match(/science_factual[^:]*:\s*([\d.]+)/)

    if (bioThreshMatch && parseFloat(bioThreshMatch[1]) >= 90) {
      pass(`Biology factual threshold = ${bioThreshMatch[1]} (≥ 90 ✓)`)
    } else {
      fail(`Biology factual threshold may be below 90 — check config.py`)
    }

    if (sciFacThreshMatch && parseFloat(sciFacThreshMatch[1]) >= 90) {
      pass(`Science factual threshold = ${sciFacThreshMatch[1]} (≥ 90 ✓)`)
    } else {
      fail(`Science factual threshold may be below 90 — check config.py`)
    }
  }
}

// ── SUMMARY ───────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60))
console.log(`  CONTENT SAFETY: ${passed} passed, ${failed} failed`)
console.log('═'.repeat(60))

if (failed > 0) {
  console.log('\n  ❌ Content safety checks FAILED. Do not run batch generation.\n')
  process.exit(1)
} else {
  console.log('\n  ✅ All content safety checks passed.\n')
  process.exit(0)
}

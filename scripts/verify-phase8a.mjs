/**
 * Phase 8A — Content Pipeline Activation Gate verifier.
 *
 * Three layers of checks:
 *
 *   STATIC (always run, no external resources required):
 *     1. railway.toml exists in services/content-pipeline/
 *     2. Dockerfile honours $PORT for Railway
 *     3. app/api/pipeline/{health,generate}/route.ts exist
 *     4. lib/admin/pipeline.ts exists and references PIPELINE_SERVICE_URL
 *     5. Admin trigger page exists under /dashboard/admin/pipeline
 *     6. PIPELINE_SERVICE_URL is referenced only in server-only files
 *        (never in a 'use client' file)
 *     7. No hand-seed script references the Phase 8A test topic slug
 *        (proves the test topic's content can only come from the pipeline)
 *
 *   DATABASE (run when DATABASE_URL is set):
 *     8. Phase 8A test topic exists and is is_published=false
 *     9. Topic has a mapped curriculum_outcome
 *    10. Any quiz_questions for the test topic have non-null confidence_score
 *        (hand-seed scripts never set confidence_score; presence proves the
 *        row came through the pipeline's Stage 6)
 *
 *   LIVE (run when PIPELINE_SERVICE_URL is set):
 *    11. /health returns 200
 *
 * Exits 0 if all RUN checks pass; non-zero if any FAIL. SKIPPED checks
 * never fail the run but are reported.
 *
 * Run:
 *   node --env-file=.env.local scripts/verify-phase8a.mjs
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(process.cwd())

const TEST_TOPIC_SLUG = 'addition-and-subtraction'

const results = []
function check(name, status, detail = '') {
  results.push({ name, status, detail })
  const tag =
    status === 'PASS' ? '[32mPASS[0m'
    : status === 'FAIL' ? '[31mFAIL[0m'
    : '[33mSKIP[0m'
  console.log(`  ${tag}  ${name}${detail ? ' — ' + detail : ''}`)
}

function fileContains(path, needles) {
  if (!existsSync(path)) return { exists: false, hits: [] }
  const src = readFileSync(path, 'utf8')
  return { exists: true, hits: needles.filter((n) => src.includes(n)) }
}

function walk(dir, accept) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) out.push(...walk(full, accept))
    else if (accept(full)) out.push(full)
  }
  return out
}

console.log('\n══════════════════════════════════════════════════════════════════')
console.log('  Phase 8A — Content Pipeline Activation Gate — verification')
console.log('══════════════════════════════════════════════════════════════════\n')

// ── STATIC CHECKS ─────────────────────────────────────────────────────────

console.log('STATIC')

// 1. railway.toml
{
  const path = join(ROOT, 'services/content-pipeline/railway.toml')
  if (!existsSync(path)) {
    check('railway.toml exists', 'FAIL', path)
  } else {
    const src = readFileSync(path, 'utf8')
    const ok =
      src.includes('DOCKERFILE') &&
      src.includes('healthcheckPath') &&
      src.includes('/health')
    check(
      'railway.toml exists',
      ok ? 'PASS' : 'FAIL',
      ok ? '' : 'missing Dockerfile builder or /health healthcheck',
    )
  }
}

// 2. Dockerfile honours $PORT
{
  const path = join(ROOT, 'services/content-pipeline/Dockerfile')
  const { exists, hits } = fileContains(path, ['$PORT', 'uvicorn'])
  check(
    'Dockerfile honours $PORT',
    exists && hits.length === 2 ? 'PASS' : 'FAIL',
    exists ? '' : 'Dockerfile missing',
  )
}

// 3. Proxy route files exist
{
  const files = [
    'app/api/pipeline/health/route.ts',
    'app/api/pipeline/generate/route.ts',
  ]
  for (const rel of files) {
    check(
      `${rel} exists`,
      existsSync(join(ROOT, rel)) ? 'PASS' : 'FAIL',
    )
  }
}

// 4. lib/admin/pipeline.ts exists and references PIPELINE_SERVICE_URL
{
  const path = join(ROOT, 'lib/admin/pipeline.ts')
  const { exists, hits } = fileContains(path, [
    'PIPELINE_SERVICE_URL',
    'server-only',
    'ADMIN_PIPELINE_TOKEN',
    'authoriseAdminRequest',
  ])
  check(
    'lib/admin/pipeline.ts references required identifiers',
    exists && hits.length === 4 ? 'PASS' : 'FAIL',
    exists ? `hits=${hits.length}/4` : 'file missing',
  )
}

// 5. Admin trigger page
{
  const files = [
    'app/dashboard/admin/pipeline/page.tsx',
    'app/dashboard/admin/pipeline/PipelinePanel.tsx',
  ]
  for (const rel of files) {
    check(
      `${rel} exists`,
      existsSync(join(ROOT, rel)) ? 'PASS' : 'FAIL',
    )
  }
}

// 6. PIPELINE_SERVICE_URL never appears in a 'use client' file
{
  const exts = ['.ts', '.tsx']
  const skipDirs = ['/services/content-pipeline/', '/node_modules/', '/.next/']
  const allFiles = walk(ROOT, (p) =>
    exts.some((e) => p.endsWith(e)) &&
    !skipDirs.some((d) => p.includes(d)),
  )
  const leaks = []
  for (const f of allFiles) {
    const src = readFileSync(f, 'utf8')
    if (!src.includes('PIPELINE_SERVICE_URL')) continue
    if (src.startsWith("'use client'") || src.startsWith('"use client"')) {
      leaks.push(f)
    }
  }
  check(
    "PIPELINE_SERVICE_URL never in a 'use client' file",
    leaks.length === 0 ? 'PASS' : 'FAIL',
    leaks.length ? leaks.join(', ') : '',
  )
}

// 7. No hand-seed script references the Phase 8A test topic slug
{
  const seedDir = join(ROOT, 'scripts')
  const seeds = readdirSync(seedDir).filter(
    (f) =>
      f.startsWith('seed-') &&
      // The test-topic seed itself is allowed to mention the slug.
      f !== 'seed-phase8a-test-topic.mjs',
  )
  const mentions = []
  for (const f of seeds) {
    const src = readFileSync(join(seedDir, f), 'utf8')
    if (src.includes(TEST_TOPIC_SLUG)) mentions.push(f)
  }
  check(
    'No legacy hand-seed script mentions the Phase 8A test topic',
    mentions.length === 0 ? 'PASS' : 'FAIL',
    mentions.length ? mentions.join(', ') : '',
  )
}

// ── DATABASE CHECKS ───────────────────────────────────────────────────────

console.log('\nDATABASE')

if (!process.env.DATABASE_URL) {
  check('DATABASE checks', 'SKIP', 'DATABASE_URL not set')
} else {
  // Lazy-load Prisma to avoid hard dependency in static-only runs.
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  try {
    const topic = await prisma.topic.findFirst({
      where: { slug: TEST_TOPIC_SLUG },
      include: { curriculum_outcomes: true, quiz_questions: true },
    })

    if (!topic) {
      check(
        'Phase 8A test topic seeded',
        'FAIL',
        'run scripts/seed-phase8a-test-topic.mjs first',
      )
    } else {
      check(
        'Phase 8A test topic seeded',
        'PASS',
        `topic_id=${topic.id}`,
      )
      check(
        'Test topic is_published=false (child journeys protected)',
        topic.is_published === false ? 'PASS' : 'FAIL',
        `is_published=${topic.is_published}`,
      )
      check(
        'Test topic has at least one mapped curriculum_outcome',
        topic.curriculum_outcomes.length > 0 ? 'PASS' : 'FAIL',
        `outcomes=${topic.curriculum_outcomes.length}`,
      )

      const qs = topic.quiz_questions
      if (qs.length === 0) {
        check(
          'Test topic has pipeline-generated questions',
          'SKIP',
          'no questions yet — trigger /api/pipeline/generate',
        )
      } else {
        const withScore = qs.filter((q) => q.confidence_score !== null).length
        check(
          'Every question has a confidence_score (proves pipeline path)',
          withScore === qs.length ? 'PASS' : 'FAIL',
          `${withScore}/${qs.length} scored`,
        )
        const verifiedTier = qs.filter(
          (q) => q.status === 'staged' || q.status === 'published',
        ).length
        check(
          'Generated questions reached staged or published',
          verifiedTier === qs.length ? 'PASS' : 'FAIL',
          `${verifiedTier}/${qs.length} in valid terminal state`,
        )
      }
    }
  } catch (err) {
    check('DATABASE checks', 'FAIL', err.message)
  } finally {
    await prisma.$disconnect()
  }
}

// ── LIVE CHECKS ───────────────────────────────────────────────────────────

console.log('\nLIVE')

if (!process.env.PIPELINE_SERVICE_URL) {
  check('LIVE health check', 'SKIP', 'PIPELINE_SERVICE_URL not set')
} else {
  const url = process.env.PIPELINE_SERVICE_URL.replace(/\/$/, '') + '/health'
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
    })
    const ok =
      res.ok && (await res.json().catch(() => ({}))).status === 'ok'
    check(
      `${url} returns 200 with status=ok`,
      ok ? 'PASS' : 'FAIL',
      `HTTP ${res.status}`,
    )
  } catch (err) {
    check(`${url}`, 'FAIL', err.message)
  }
}

// ── SUMMARY ───────────────────────────────────────────────────────────────

const tally = results.reduce(
  (acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  },
  { PASS: 0, FAIL: 0, SKIP: 0 },
)

console.log('\n══════════════════════════════════════════════════════════════════')
console.log(
  `  PASS=${tally.PASS}  FAIL=${tally.FAIL}  SKIP=${tally.SKIP}`,
)
console.log('══════════════════════════════════════════════════════════════════\n')

process.exit(tally.FAIL === 0 ? 0 : 1)

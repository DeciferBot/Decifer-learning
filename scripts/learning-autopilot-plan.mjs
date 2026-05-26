/**
 * learning-autopilot-plan.mjs — Autopilot dry-run plan for Decifer Learning.
 *
 * Scans all curriculum topics, classifies their coverage state, and prints
 * the next 10 recommended content jobs WITHOUT generating any content.
 *
 * This is a READ-ONLY planning command. It does not:
 *   • Generate or modify any content
 *   • Write to the work queue
 *   • Touch .PIPELINE_STOP
 *   • Reference or touch Decifer Trading in any way
 *
 * Usage:
 *   npm run learning:autopilot:plan
 *   node --env-file=.env.local scripts/learning-autopilot-plan.mjs
 *   node --env-file=.env.local scripts/learning-autopilot-plan.mjs --year year-3
 *   node --env-file=.env.local scripts/learning-autopilot-plan.mjs --json
 *
 * Exit codes:
 *   0 — plan printed successfully
 *   1 — internal error (DB connection, missing env vars)
 */

import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.resolve(__dirname, '..')

// ── Safety: refuse if trading patterns are referenced ─────────────────────────

const TRADING_PATTERN = /trading|alpaca|market|portfolio|trade|order|ticker|stock|crypto/i
const args = process.argv.slice(2)
for (const arg of args) {
  if (TRADING_PATTERN.test(arg)) {
    console.error(`❌ Trading-related argument detected: ${arg}`)
    console.error('   The Learning autopilot plan must never reference Decifer Trading.')
    process.exit(1)
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_QUESTIONS     = 10
const MIN_LEARN_CONTENT = 1
const BLOCKED_THRESHOLD = 20  // ≥ this many recent generation errors → BLOCKED
const MAX_PLAN_JOBS     = 10  // top N jobs to show in the plan

// ── Argument parsing ──────────────────────────────────────────────────────────

const yearFilter    = args.find((_, i) => args[i - 1] === '--year') ?? null
const jsonMode      = args.includes('--json')
const verboseMode   = args.includes('--verbose')

// ── Coverage state classification ─────────────────────────────────────────────

function classifyTopic(t) {
  const pubQ    = Number(t.pub_q    ?? 0)
  const flagQ   = Number(t.flagged_q ?? 0)
  const pubLC   = Number(t.pub_lc   ?? 0)
  const errors  = Number(t.recent_errors ?? 0)
  const chunks  = Number(t.chunk_count  ?? 0)
  const isPub   = Boolean(t.is_published)

  if (errors >= BLOCKED_THRESHOLD)
    return { state: 'BLOCKED',               action: 'manual_review' }
  if (flagQ > 0 && isPub)
    return { state: 'QUARANTINED',           action: 'regenerate_flagged' }
  if (pubQ >= MIN_QUESTIONS && pubLC >= MIN_LEARN_CONTENT && isPub)
    return { state: 'LIVE',                  action: 'monitor' }
  if (pubQ >= MIN_QUESTIONS && pubLC >= MIN_LEARN_CONTENT && !isPub)
    return { state: 'NEED_Q',               action: 'promote' }
  if (pubQ >= MIN_QUESTIONS && pubLC === 0)
    return { state: 'NEED_Q',               action: 'generate_learn_content' }
  if (pubQ > 0 && flagQ > 0 && !isPub)
    return { state: 'WEAK',                  action: 'regenerate_flagged' }
  if (pubQ > 0 && pubQ < MIN_QUESTIONS && chunks > 0)
    return { state: 'READY_FOR_TOPUP',       action: 'topup' }
  if (pubQ > 0 && pubQ < MIN_QUESTIONS)
    return { state: 'NEED_Q',               action: 'enrich_rag_then_topup' }
  if (pubQ === 0 && chunks > 0)
    return { state: 'READY_FOR_GENERATION', action: 'generate' }
  return { state: 'EMPTY',                   action: 'enrich_rag_then_generate' }
}

// ── Job priority scoring ──────────────────────────────────────────────────────
//
// Lower score = higher priority.

const STATE_PRIORITY = {
  QUARANTINED:           1,
  READY_FOR_TOPUP:       2,
  READY_FOR_GENERATION:  3,
  NEED_Q:                4,
  EMPTY:                 5,
  WEAK:                  6,
  BLOCKED:               9,
  LIVE:                  10,
}

function prioritise(classified) {
  return classified
    .filter(t => t.classification.state !== 'LIVE' && t.classification.state !== 'BLOCKED')
    .sort((a, b) => {
      const pa = STATE_PRIORITY[a.classification.state] ?? 9
      const pb = STATE_PRIORITY[b.classification.state] ?? 9
      if (pa !== pb) return pa - pb
      // Within same state: topics with more existing questions go first (closer to gate)
      return Number(b.pub_q ?? 0) - Number(a.pub_q ?? 0)
    })
    .slice(0, MAX_PLAN_JOBS)
}

// ── DB query ──────────────────────────────────────────────────────────────────

const prisma = new PrismaClient()

async function fetchTopics(yearFilter) {
  // Prisma doesn't support arbitrary lateral subqueries, so we use $queryRaw
  const params = []
  let yearClause = ''
  if (yearFilter) {
    params.push(yearFilter.toLowerCase())
    yearClause = `AND LOWER(yg.label) = $${params.length}`
  }

  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT
        t.id::text           AS topic_id,
        t.title,
        t.slug,
        t.is_published,
        yg.label             AS year_group,
        s.name               AS subject,
        COUNT(qq.id) FILTER (WHERE qq.status = 'published') AS pub_q,
        COUNT(qq.id) FILTER (WHERE qq.status = 'staged')    AS staged_q,
        COUNT(qq.id) FILTER (WHERE qq.status = 'flagged')   AS flagged_q,
        COUNT(lc.id) FILTER (WHERE lc.status = 'published') AS pub_lc,
        (
            SELECT COUNT(*) FROM generation_errors ge
            WHERE ge.topic_id = t.id
              AND ge.created_at > NOW() - INTERVAL '30 days'
        ) AS recent_errors,
        (
            SELECT ge.error_message FROM generation_errors ge
            WHERE ge.topic_id = t.id
            ORDER BY ge.created_at DESC LIMIT 1
        ) AS last_error,
        (
            SELECT COUNT(*) FROM curriculum_chunks cc
            WHERE cc.subject = s.name AND cc.year_group = yg.label
        ) AS chunk_count
    FROM topics t
    JOIN year_groups yg ON yg.id = t.year_group_id
    JOIN subjects    s  ON s.id  = t.subject_id
    LEFT JOIN quiz_questions qq ON qq.topic_id = t.id
    LEFT JOIN learn_content  lc ON lc.topic_id = t.id
    WHERE 1=1 ${yearClause}
    GROUP BY t.id, t.title, t.slug, t.is_published, yg.label, s.name
    ORDER BY s.name, yg.label, t.order_index, t.slug
    `,
    ...params,
  )
  return rows
}

// ── Report formatting ─────────────────────────────────────────────────────────

const STATE_SYMBOL = {
  LIVE:                  '🌟',
  NEED_Q:                '🔒',
  EMPTY:                 '⬜',
  WEAK:                  '⚠️ ',
  READY_FOR_GENERATION:  '🚀',
  READY_FOR_TOPUP:       '📈',
  BLOCKED:               '🚫',
  QUARANTINED:           '🔴',
}

const ACTION_LABEL = {
  monitor:                   'monitor',
  topup:                     'topup +Q',
  generate:                  'generate',
  generate_learn_content:    'gen LC',
  promote:                   'promote',
  regenerate_flagged:        'regen flagged',
  enrich_rag_then_generate:  'enrich RAG → generate',
  enrich_rag_then_topup:     'enrich RAG → topup',
  manual_review:             '⚠️  MANUAL REVIEW',
}

function printPlan(topics, jobsPreview, yearFilter) {
  // Summary counts
  const counts = {}
  for (const t of topics) {
    const s = t.classification.state
    counts[s] = (counts[s] ?? 0) + 1
  }

  const LINE = '═'.repeat(80)
  const line = '─'.repeat(80)

  console.log(`\n${LINE}`)
  console.log(`  DECIFER LEARNING — AUTOPILOT DRY-RUN PLAN  [read-only, no generation]`)
  if (yearFilter) console.log(`  Filter: year_group = ${yearFilter}`)
  console.log(`  ${topics.length} topics total`)
  console.log(
    `  🌟 ${counts.LIVE ?? 0} LIVE   ` +
    `🔒 ${counts.NEED_Q ?? 0} NEED_Q   ` +
    `⬜ ${counts.EMPTY ?? 0} EMPTY   ` +
    `🚀 ${counts.READY_FOR_GENERATION ?? 0} READY_GEN   ` +
    `📈 ${counts.READY_FOR_TOPUP ?? 0} READY_TOPUP`
  )
  const alerts = (counts.BLOCKED ?? 0) + (counts.QUARANTINED ?? 0) + (counts.WEAK ?? 0)
  if (alerts > 0) {
    console.log(
      `  🚫 ${counts.BLOCKED ?? 0} BLOCKED   ` +
      `🔴 ${counts.QUARANTINED ?? 0} QUARANTINED   ` +
      `⚠️  ${counts.WEAK ?? 0} WEAK`
    )
  }
  console.log(LINE)

  // Next jobs table
  console.log(`\n  NEXT ${jobsPreview.length} RECOMMENDED JOBS\n`)
  console.log(`  ${'#'.padEnd(3)} ${'Topic'.padEnd(38)} ${'Year'.padEnd(8)} ${'Q'.padEnd(5)} ${'State'.padEnd(24)} Action`)
  console.log(`  ${line}`)

  jobsPreview.forEach((t, i) => {
    const sym    = STATE_SYMBOL[t.classification.state] ?? '?'
    const action = ACTION_LABEL[t.classification.action] ?? t.classification.action
    const q      = `${Number(t.pub_q)}/${MIN_QUESTIONS}`
    const title  = (t.title ?? t.slug ?? 'unknown').slice(0, 38).padEnd(38)
    const year   = (t.year_group ?? '').padEnd(8)
    const state  = `${sym} ${t.classification.state}`.padEnd(24)
    console.log(`  ${String(i + 1).padEnd(3)} ${title} ${year} ${q.padEnd(5)} ${state} ${action}`)

    if (verboseMode) {
      if (t.last_error) {
        console.log(`       └─ last error: ${String(t.last_error).slice(0, 100)}`)
      }
      if (t.classification.action === 'topup') {
        const need = MIN_QUESTIONS - Number(t.pub_q)
        console.log(`       └─ needs +${need} questions  (chunks: ${t.chunk_count ?? 0})`)
      }
    }
  })

  // Blocked topics warning
  const blocked = topics.filter(t => t.classification.state === 'BLOCKED')
  if (blocked.length > 0) {
    console.log(`\n  ${line}`)
    console.log(`  🚫 BLOCKED TOPICS (require manual review — not included in job queue):`)
    for (const t of blocked) {
      console.log(`     • ${t.slug ?? t.title}  (${t.recent_errors} errors in 30d)`)
      if (t.last_error) {
        console.log(`       last error: ${String(t.last_error).slice(0, 120)}`)
      }
    }
  }

  console.log(`\n  ${LINE}`)
  console.log(`  This is a DRY RUN. No content was generated.`)
  console.log(`  .PIPELINE_STOP is ${existsSync(path.join(ROOT, '.PIPELINE_STOP')) ? 'ACTIVE ✅' : 'MISSING ⚠️ '}`)
  console.log(`  To execute: Phase 2B.2 will add npm run learning:autopilot:run`)
  console.log(`${LINE}\n`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let topics
  try {
    const raw = await fetchTopics(yearFilter)
    topics = raw.map(t => ({
      ...t,
      pub_q:         Number(t.pub_q ?? 0),
      staged_q:      Number(t.staged_q ?? 0),
      flagged_q:     Number(t.flagged_q ?? 0),
      pub_lc:        Number(t.pub_lc ?? 0),
      recent_errors: Number(t.recent_errors ?? 0),
      chunk_count:   Number(t.chunk_count ?? 0),
      classification: classifyTopic(t),
    }))
  } catch (err) {
    console.error('❌ DB query failed:', err.message)
    console.error('   Make sure DATABASE_URL or DIRECT_URL is set.')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }

  if (topics.length === 0) {
    console.log('No topics found. Check --year filter or DB connection.')
    process.exit(0)
  }

  const jobsPreview = prioritise(topics)

  if (jsonMode) {
    console.log(JSON.stringify({
      total: topics.length,
      summary: topics.reduce((acc, t) => {
        acc[t.classification.state] = (acc[t.classification.state] ?? 0) + 1
        return acc
      }, {}),
      next_jobs: jobsPreview.map(t => ({
        topic_id:   t.topic_id,
        slug:       t.slug,
        title:      t.title,
        year_group: t.year_group,
        subject:    t.subject,
        pub_q:      t.pub_q,
        state:      t.classification.state,
        action:     t.classification.action,
        reason:     `${t.classification.state}: ${t.pub_q}/${MIN_QUESTIONS} Q`,
      })),
    }, null, 2))
    return
  }

  printPlan(topics, jobsPreview, yearFilter)
}

main().catch(err => {
  console.error('Unhandled error:', err)
  process.exit(1)
})

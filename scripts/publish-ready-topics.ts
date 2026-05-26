// Publish-as-available: flip topics.is_published=true when content thresholds are met.
//
// Readiness bar (matches CLAUDE.md Phase 3/11 gate):
//   - ≥ 1 learn_content row with status='published'
//   - ≥ 10 quiz_questions with status='published'
//
// Practice games are optional — the UI gracefully hides the Practise step
// when no published practice_game exists.
//
// Idempotent. Never flips a topic back to is_published=false.
// Run after every pipeline batch:
//   $ set -a && source .env.local && set +a && npx tsx scripts/publish-ready-topics.ts

import { existsSync } from 'fs'
import { resolve } from 'path'
import { prisma } from '../lib/prisma'

// ── Pipeline stop guard ───────────────────────────────────────────────────────
const _stopGuard = resolve(__dirname, '..', '.PIPELINE_STOP')
if (existsSync(_stopGuard)) {
  console.log('PIPELINE STOP ACTIVE: Decifer Learning content generation is disabled')
  process.exit(0)
}

const MIN_QUIZ_QUESTIONS = 10
const MIN_LEARN_CONTENT = 1

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('DRY RUN — no DB writes will be made.\n')

  const candidates = await prisma.topic.findMany({
    where: { is_published: false },
    select: {
      id: true,
      title: true,
      year_group: { select: { label: true } },
      subject: { select: { name: true } },
      _count: {
        select: {
          learn_content: { where: { status: 'published' } },
          quiz_questions: { where: { status: 'published' } },
          practice_games: { where: { status: 'published' } },
        },
      },
    },
  })

  const ready = candidates.filter(
    (t) =>
      t._count.learn_content >= MIN_LEARN_CONTENT &&
      t._count.quiz_questions >= MIN_QUIZ_QUESTIONS,
  )
  const blocked = candidates.filter(
    (t) =>
      t._count.learn_content < MIN_LEARN_CONTENT ||
      t._count.quiz_questions < MIN_QUIZ_QUESTIONS,
  )

  console.log(`Candidates (is_published=false): ${candidates.length}`)
  console.log(`Ready to flip: ${ready.length}`)
  console.log(`Still below threshold: ${blocked.length}\n`)

  if (ready.length > 0) {
    console.log('=== Flipping is_published=true ===')
    for (const t of ready) {
      const practiseNote = t._count.practice_games === 0 ? ' [no practice_game — Practise hidden]' : ''
      console.log(
        `  ${dryRun ? '[dry]' : '✓'} [${t.year_group.label}] ${t.subject.name} — ${t.title}` +
          ` (learn=${t._count.learn_content}, quiz=${t._count.quiz_questions})${practiseNote}`,
      )
      if (!dryRun) {
        await prisma.topic.update({
          where: { id: t.id },
          data: { is_published: true },
        })
      }
    }
  }

  if (blocked.length > 0) {
    console.log('\n=== Still below threshold (kept hidden) ===')
    const sample = blocked.slice(0, 15)
    for (const t of sample) {
      console.log(
        `  · [${t.year_group.label}] ${t.subject.name} — ${t.title}` +
          ` (learn=${t._count.learn_content}, quiz=${t._count.quiz_questions})`,
      )
    }
    if (blocked.length > sample.length) {
      console.log(`  …and ${blocked.length - sample.length} more`)
    }
  }

  console.log('\nDone.')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

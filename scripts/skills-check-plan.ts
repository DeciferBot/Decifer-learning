/**
 * Plan (and optionally create) a Decifer Skills Check.
 *
 * Dry run by default: it prints the 20 items a check WOULD contain and writes
 * nothing. This is the output a human reads for the one-time hand-check of a
 * check's items (docs/SKILLS_CHECK_SCOPE.md §11) before it goes live.
 *
 *   npx tsx scripts/skills-check-plan.ts --subject Maths --year year-4
 *   npx tsx scripts/skills-check-plan.ts --subject Maths --year year-4 --write
 *
 * --write creates or replaces the check's item list. It always leaves
 * is_published false: publishing is a separate, deliberate act.
 */

import { planCheckForYear, persistCheck } from '../lib/skills-check/build'
import { prisma } from '../lib/prisma'

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

async function main() {
  const subject = arg('subject', 'Maths')!
  const year = arg('year', 'year-4')!
  const write = process.argv.includes('--write')

  const built = await planCheckForYear(subject, year)
  if (!built) {
    console.error(`No such subject or year: ${subject} / ${year}`)
    process.exit(1)
  }

  const { plan } = built
  console.log(`\nSkills Check plan: ${built.slug}`)
  console.log(`  subject ${built.subjectName}, year ${built.yearLabel}`)
  console.log(`  ${plan.strands.length} strands, ${plan.items.length} items\n`)

  // Fetch the question text so the hand-check has something to read.
  const questions = await prisma.quizQuestion.findMany({
    where: { id: { in: plan.items.map((i) => i.questionId) } },
    select: {
      id: true,
      tier: true,
      status: true,
      question_text: true,
      correct_answer: true,
      topic: { select: { title: true, year_group: { select: { label: true } } } },
    },
  })
  const byId = new Map(questions.map((q) => [q.id, q]))

  let unpublished = 0
  for (const strand of plan.strands) {
    console.log(`── ${strand.strandTitle}${strand.incomplete ? '  (INCOMPLETE)' : ''}`)
    for (const item of strand.items) {
      const q = byId.get(item.questionId)
      if (!q) {
        console.log(`   [${item.band}] MISSING QUESTION ${item.questionId}`)
        continue
      }
      if (q.status !== 'published') unpublished += 1
      const from = `${q.topic.year_group.label}/${q.topic.title}`
      console.log(`   [${item.band.padEnd(5)}] ${q.tier.padEnd(9)} ${from}`)
      console.log(`            ${q.question_text.replace(/\s+/g, ' ').slice(0, 110)}`)
      console.log(`            -> ${q.correct_answer}`)
    }
    console.log('')
  }

  if (plan.skipped.length > 0) {
    console.log('Skipped topics:')
    for (const s of plan.skipped) console.log(`   ${s.title}: ${s.reason}`)
    console.log('')
  }

  // A public, no-login check must never contain unpublished content.
  if (unpublished > 0) {
    console.error(`REFUSING: ${unpublished} item(s) are not published.`)
    process.exit(1)
  }
  console.log(`All ${plan.items.length} items are published.`)

  if (write) {
    const res = await persistCheck(built)
    console.log(`\nWritten: check ${res.checkId}, ${res.items} items, is_published=false.`)
  } else {
    console.log('\nDry run. Pass --write to create the check.')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

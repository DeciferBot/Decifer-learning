/**
 * Lint the items in every built Skills Check before a human reads them.
 *
 * WHY THIS EXISTS: a check must be hand-checked before it goes live
 * (docs/SKILLS_CHECK_SCOPE.md §11), and 18 checks is 360 questions. Reading 360
 * questions carefully is not something anyone does well. So this flags the
 * defect classes we already know this content bank produces, and the human reads
 * the flagged ones properly instead of skimming everything and missing them.
 *
 * It is a filter for attention, not a replacement for it.
 *
 * Every rule here comes from a defect actually found in this bank, recorded in
 * CONTENT_QUALITY_AUDIT_2026_08_03.md and the content-engine notes:
 *   - questions that refer to a picture, table or passage that is not there
 *   - "tick all that apply" phrasing where a distractor is also correct
 *   - truncated or malformed stems
 *   - arithmetic whose stated answer does not follow from the numbers given
 *   - duplicate stems inside one check
 *
 *   npx tsx scripts/skills-check-lint.ts
 *   npx tsx scripts/skills-check-lint.ts --slug maths-year-4   # one check
 */

import { prisma } from '../lib/prisma'
import { questionsAreNearDuplicates } from '../lib/skills-check/plan'

type Finding = { slug: string; position: number; rule: string; detail: string }

/** Refers to something the child cannot see. The highest-value rule here. */
const MISSING_MEDIA = [
  /\bthe (diagram|picture|image|graph|chart|table|grid|shape) (below|above|shown|opposite)\b/i,
  /\b(look at|study|use) the (diagram|picture|image|graph|chart|table|passage|text|extract)\b/i,
  /\bshown (below|above)\b/i,
  /\bin the (passage|extract|text) (below|above)\b/i,
  /\bfrom the (graph|chart|table)\b/i,
]

/** Plural phrasing that only works if exactly one option is right. */
const PLURAL_ANSWER = [
  /\btick (all|both|the .*s)\b/i,
  /\bselect all\b/i,
  /\bwhich (two|three|of these .*s are)\b/i,
  /\bchoose all\b/i,
]

/** Pull every integer out of a stem, ignoring years and ordinals. */
function numbersIn(text: string): number[] {
  return (text.match(/\b\d[\d,]*\b/g) ?? [])
    .map((n) => Number(n.replace(/,/g, '')))
    .filter((n) => Number.isFinite(n))
}

/**
 * For a two-number arithmetic stem, check the stated answer is one of the four
 * obvious operations. Deliberately narrow: it only fires when the stem has
 * exactly two numbers and a numeric answer, so it cannot misjudge a word problem
 * with a third quantity in it.
 */
function arithmeticLooksWrong(text: string, answer: string): string | null {
  const ans = Number(answer.replace(/[,£$%\s]/g, ''))
  if (!Number.isFinite(ans)) return null
  const nums = numbersIn(text)
  if (nums.length !== 2) return null
  const [a, b] = nums
  const candidates = [a + b, a - b, b - a, a * b, b === 0 ? NaN : a / b, a === 0 ? NaN : b / a]
  if (candidates.some((c) => Number.isFinite(c) && Math.abs(c - ans) < 1e-9)) return null
  return `stem has ${a} and ${b}, answer ${ans} is not any of + - x /`
}

async function main() {
  const only = process.argv.indexOf('--slug')
  const slug = only >= 0 ? process.argv[only + 1] : undefined

  const checks = await prisma.skillCheck.findMany({
    where: slug ? { slug } : {},
    orderBy: { slug: 'asc' },
    select: {
      slug: true,
      is_published: true,
      items: {
        orderBy: { position: 'asc' },
        select: {
          position: true,
          band: true,
          question: {
            select: { question_text: true, correct_answer: true, distractors: true, question_type: true },
          },
        },
      },
    },
  })

  const findings: Finding[] = []

  for (const check of checks) {
    const stems: string[] = []
    for (const item of check.items) {
      const q = item.question
      const text = q.question_text ?? ''
      const add = (rule: string, detail: string) =>
        findings.push({ slug: check.slug, position: item.position, rule, detail })

      if (text.trim().length < 15) add('stem-too-short', JSON.stringify(text))
      if (!/[?.:]\s*$|\?/.test(text)) add('no-question-mark', text.slice(0, 70))
      if (MISSING_MEDIA.some((re) => re.test(text))) add('refers-to-missing-media', text.slice(0, 90))
      if (PLURAL_ANSWER.some((re) => re.test(text))) add('plural-answer-phrasing', text.slice(0, 90))

      const distractors = Array.isArray(q.distractors) ? q.distractors : []
      if (distractors.length < 3) add('too-few-distractors', `${distractors.length}`)

      const wrong = arithmeticLooksWrong(text, q.correct_answer ?? '')
      if (wrong) add('arithmetic-mismatch', `${wrong} | ${text.slice(0, 70)}`)

      for (const seen of stems) {
        if (questionsAreNearDuplicates(text, seen)) {
          add('duplicate-in-check', text.slice(0, 70))
          break
        }
      }
      stems.push(text)
    }
  }

  const byRule = new Map<string, Finding[]>()
  for (const f of findings) {
    const list = byRule.get(f.rule) ?? []
    list.push(f)
    byRule.set(f.rule, list)
  }

  console.log(`Linted ${checks.length} check(s), ${checks.reduce((n, c) => n + c.items.length, 0)} items.\n`)
  if (findings.length === 0) {
    console.log('No findings.')
  } else {
    for (const [rule, list] of [...byRule.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n## ${rule} (${list.length})`)
      for (const f of list) console.log(`  ${f.slug} #${f.position}: ${f.detail}`)
    }
  }
  console.log(`\n${findings.length} finding(s) across ${new Set(findings.map((f) => f.slug)).size} check(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

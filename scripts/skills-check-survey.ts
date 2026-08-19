/**
 * Survey which subject/year combinations can produce a complete Skills Check.
 *
 * ONE process, ONE Prisma client, one connection. Running the single-check
 * script in a shell loop opens a fresh connection per run and exhausts the
 * Supabase pool (15 clients), which makes most of the runs fail and look like
 * missing content rather than a connection problem.
 *
 *   npx tsx scripts/skills-check-survey.ts
 *   npx tsx scripts/skills-check-survey.ts --write   # build every viable check
 *
 * --write creates or replaces each viable check. It never publishes: is_published
 * stays false until a person has read the items.
 */

import { planCheckForYear, persistCheck } from '../lib/skills-check/build'
import { ITEMS_PER_STRAND, STRANDS_PER_CHECK } from '../lib/skills-check/plan'
import { prisma } from '../lib/prisma'

const SUBJECTS = ['Maths', 'English']
const YEARS = Array.from({ length: 9 }, (_, i) => `year-${i + 1}`)
const FULL_LENGTH = STRANDS_PER_CHECK * ITEMS_PER_STRAND

/** True for the errors that mean "the pool is busy", not "the query is wrong". */
function isPoolExhaustion(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err)
  return /max clients|EMAXCONN|too many connections|Timed out fetching a new connection/i.test(m)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Retry with a widening gap, but only for pool exhaustion. Real errors surface at once. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i >= attempts - 1 || !isPoolExhaustion(err)) throw err
      await sleep(1500 * (i + 1))
    }
  }
}

async function main() {
  const write = process.argv.includes('--write')
  const viable: string[] = []

  console.log(`${'subject'.padEnd(9)}${'year'.padEnd(9)}${'items'.padEnd(7)}${'incomplete'.padEnd(12)}status`)
  console.log('-'.repeat(56))

  for (const subject of SUBJECTS) {
    for (const year of YEARS) {
      let line = `${subject.padEnd(9)}${year.padEnd(9)}`
      try {
        // Retry on connection-pool exhaustion. The Supabase session pooler caps
        // at 15 clients, and several agents share this database, so a run can
        // fail for reasons that have nothing to do with the content. Without
        // this, a busy pool looks exactly like "this year has no questions",
        // which is a wrong and expensive conclusion.
        const built = await withRetry(() => planCheckForYear(subject, year))
        if (!built) {
          console.log(line + `${'-'.padEnd(7)}${'-'.padEnd(12)}no such subject/year`)
          continue
        }
        const n = built.plan.items.length
        const incomplete = built.plan.strands.filter((s) => s.incomplete).length
        const status = n === FULL_LENGTH ? 'ok' : `SHORT (needs ${FULL_LENGTH})`
        line += `${String(n).padEnd(7)}${String(incomplete).padEnd(12)}${status}`
        console.log(line)
        if (n === FULL_LENGTH) {
          viable.push(built.slug)
          if (write) await withRetry(() => persistCheck(built))
        }
      } catch (err) {
        console.log(line + `${'-'.padEnd(7)}${'-'.padEnd(12)}ERROR ${(err as Error).message.slice(0, 60)}`)
      }
    }
  }

  console.log('')
  console.log(`${viable.length} viable check(s): ${viable.join(', ')}`)
  console.log(
    write
      ? '\nWritten. All are is_published=false — read the items before publishing.'
      : '\nDry run. Pass --write to build them.',
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

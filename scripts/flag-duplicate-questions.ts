/**
 * Flag near-duplicate published quiz questions within the same topic.
 *
 * Fetches all published questions per topic, embeds them via OpenAI, then
 * computes pairwise cosine similarity. For each pair above the threshold,
 * keeps the higher-confidence question and flags the other as 'flagged'.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/flag-duplicate-questions.ts [--dry-run] [--threshold 0.82]
 */

import { prisma } from '../lib/prisma'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const thresholdIdx = args.findIndex(a => a === '--threshold')
const THRESHOLD = thresholdIdx >= 0 ? parseFloat(args[thresholdIdx + 1]) : 0.82

console.log(`\nDuplicate question auditor`)
console.log(`  threshold : ${THRESHOLD}`)
console.log(`  dry-run   : ${DRY_RUN}\n`)

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12)
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-ada-002', input: texts }),
  })
  if (!res.ok) throw new Error(`OpenAI embedding error: ${res.status} ${await res.text()}`)
  const json = await res.json() as { data: { embedding: number[] }[] }
  return json.data.map(d => d.embedding)
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set. Run: set -a && source .env.local && set +a')
    process.exit(1)
  }

  const topics = await prisma.topic.findMany({
    select: { id: true, title: true, subject: { select: { name: true } } },
  })

  let totalPairs = 0
  let totalFlagged = 0

  for (const topic of topics) {
    const subjectName = topic.subject?.name ?? 'unknown'

    const questions = await prisma.quizQuestion.findMany({
      where: { topic_id: topic.id, status: 'published' },
      select: { id: true, question_text: true, confidence_score: true },
    })

    if (questions.length < 2) continue

    // Embed in batches of 20
    const texts = questions.map(q => q.question_text ?? '')
    const embeddings: number[][] = []
    for (let i = 0; i < texts.length; i += 20) {
      const batch = await embedBatch(texts.slice(i, i + 20))
      embeddings.push(...batch)
    }

    const flagged = new Set<string>()

    for (let i = 0; i < questions.length; i++) {
      for (let j = i + 1; j < questions.length; j++) {
        if (flagged.has(questions[i].id) || flagged.has(questions[j].id)) continue
        const sim = cosine(embeddings[i], embeddings[j])
        if (sim < THRESHOLD) continue

        totalPairs++
        const qi = questions[i]
        const qj = questions[j]
        const keepIdx = (Number(qi.confidence_score) ?? 0) >= (Number(qj.confidence_score) ?? 0) ? i : j
        const flagIdx = keepIdx === i ? j : i
        const kept = questions[keepIdx]
        const toFlag = questions[flagIdx]

        console.log(`  [${subjectName}] ${topic.title}`)
        console.log(`    similarity : ${sim.toFixed(3)}`)
        console.log(`    keep  (score=${Number(kept.confidence_score).toFixed(1)}) : "${(kept.question_text ?? '').slice(0, 80)}…"`)
        console.log(`    flag  (score=${Number(toFlag.confidence_score).toFixed(1)}) : "${(toFlag.question_text ?? '').slice(0, 80)}…"`)

        if (!DRY_RUN) {
          await prisma.quizQuestion.update({
            where: { id: toFlag.id },
            data: { status: 'flagged' },
          })
          console.log(`    ✓ flagged`)
        }
        flagged.add(toFlag.id)
        totalFlagged++
        console.log()
      }
    }
  }

  console.log(`\nSummary: ${totalPairs} duplicate pair(s), ${totalFlagged} question(s) ${DRY_RUN ? 'would be' : ''} flagged.`)
  if (DRY_RUN && totalFlagged > 0) console.log('Re-run without --dry-run to apply.')
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())

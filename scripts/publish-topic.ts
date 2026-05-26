/**
 * Publish a topic by setting is_published=true.
 *
 * This should only be run AFTER content gates pass:
 *   - At least 10 published quiz_questions per tier
 *   - learn_content exists with status='published'
 *   - Verifier unit tests pass
 *   - Safety verification scripts pass
 *
 * Usage: npx tsx --env-file=.env.local scripts/publish-topic.ts <topic-slug>
 * Example: npx tsx --env-file=.env.local scripts/publish-topic.ts y3-english-grammar-conjunctions
 */

import { existsSync } from 'fs'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'

// ── Pipeline stop guard ───────────────────────────────────────────────────────
const _stopGuard = resolve(__dirname, '..', '.PIPELINE_STOP')
if (existsSync(_stopGuard)) {
  console.log('PIPELINE STOP ACTIVE: Decifer Learning content generation is disabled')
  process.exit(0)
}

const prisma = new PrismaClient()

async function main() {
  const slug = process.argv[2]
  if (!slug) {
    console.error('Usage: npx tsx scripts/publish-topic.ts <topic-slug>')
    process.exit(1)
  }

  const topic = await prisma.topic.findFirst({
    where: { slug },
    include: {
      subject: true,
      year_group: true,
      quiz_questions: {
        where: { status: 'published' },
        select: { id: true, tier: true },
      },
      learn_content: {
        where: { status: 'published' },
        select: { id: true },
      },
    },
  })

  if (!topic) {
    console.error(`Topic not found: ${slug}`)
    process.exit(1)
  }

  console.log(`\nTopic: ${topic.title}`)
  console.log(`Subject: ${topic.subject.name}`)
  console.log(`Year group: ${topic.year_group?.label ?? 'unknown'}`)
  console.log(`Currently published: ${topic.is_published}`)

  const publishedQuestions = topic.quiz_questions.length
  const learnContentCount = topic.learn_content.length
  const tiers = {
    sprout: topic.quiz_questions.filter((q) => q.tier === 'sprout').length,
    explorer: topic.quiz_questions.filter((q) => q.tier === 'explorer').length,
    lightning: topic.quiz_questions.filter((q) => q.tier === 'lightning').length,
  }

  console.log(`\nContent gate check:`)
  console.log(`  Published questions: ${publishedQuestions}`)
  console.log(`  Sprout: ${tiers.sprout}, Explorer: ${tiers.explorer}, Lightning: ${tiers.lightning}`)
  console.log(`  Published learn_content: ${learnContentCount}`)

  if (publishedQuestions < 10) {
    console.error(`\n  ❌ GATE FAILED: Need at least 10 published questions (have ${publishedQuestions})`)
    console.error('  Run /generate/batch first and check the pipeline runs.')
    process.exit(1)
  }

  if (learnContentCount === 0) {
    console.error('\n  ❌ GATE FAILED: No published learn_content for this topic')
    process.exit(1)
  }

  if (topic.is_published) {
    console.log('\n  ⏭  Topic is already published. Nothing to do.')
    return
  }

  await prisma.topic.update({
    where: { id: topic.id },
    data: { is_published: true },
  })

  console.log(`\n  ✅ Topic published: ${topic.title}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

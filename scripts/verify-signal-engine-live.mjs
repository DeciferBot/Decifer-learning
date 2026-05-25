/**
 * Live signal engine verification against Aaina's seeded data.
 * Run: DATABASE_URL=<direct_url> node scripts/verify-signal-engine-live.mjs
 */
import { PrismaClient } from '@prisma/client'
import { computeSignals } from '../lib/learning-signals.js'

const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
const PROFILE = '94397204-eb84-4257-9c9e-9729a10babbc'

const [progressRows, attemptRows, eventRows] = await Promise.all([
  p.topicProgress.findMany({
    where: { profile_id: PROFILE },
    include: { topic: { include: { subject: true } } },
  }),
  p.quizAttempt.findMany({
    where: { profile_id: PROFILE },
    include: { topic: { select: { subject_id: true } }, answers: true },
    orderBy: { created_at: 'asc' },
  }),
  p.learningEvent.findMany({ where: { profile_id: PROFILE }, orderBy: { occurred_at: 'asc' } }),
])

const topicProgress = progressRows.map((r) => ({
  topicId: r.topic_id, subjectId: r.topic.subject_id, subjectName: r.topic.subject.name,
  topicTitle: r.topic.title, status: r.status, lastScore: r.last_score,
  completedAt: r.completed_at, srRepetitions: r.sr_repetitions, srIntervalDays: r.sr_interval_days,
}))

const quizAttempts = attemptRows.map((a) => ({
  attemptId: a.id, topicId: a.topic_id, subjectId: a.topic.subject_id,
  score: a.score, hintsUsed: a.hints_used, timeTakenSeconds: a.time_taken_seconds,
  heartsRemaining: a.hearts_remaining, createdAt: a.created_at,
}))

const quizAnswers = attemptRows.flatMap((a) =>
  a.answers.map((ans) => ({
    attemptId: a.id, topicId: a.topic_id, wasCorrect: ans.was_correct,
    hintNumber: ans.hint_number, timeSeconds: ans.time_seconds,
  })),
)

const learningEvents = eventRows.map((e) => ({
  eventType: e.event_type, topicId: e.topic_id, subjectId: e.subject_id,
  lessonId: e.lesson_id, metadata: e.metadata, occurredAt: e.occurred_at,
}))

console.log(`\nInput: ${topicProgress.length} topics, ${quizAttempts.length} attempts, ${quizAnswers.length} answers, ${learningEvents.length} events`)

const signals = computeSignals({
  childProfileId: PROFILE,
  topicProgress,
  quizAttempts,
  quizAnswers,
  learningEvents,
  generatedAt: new Date(),
})

const VALID_CONF = new Set(['early', 'moderate', 'strong'])
const FORBIDDEN  = ['lazy', 'disorder', 'adhd', 'dyslexia', 'bad at', 'struggles with', 'weak child', 'incapable']

console.log(`\n=== SIGNAL ENGINE OUTPUT — ${signals.length} signal(s) ===\n`)

let allOk = true
for (const s of signals) {
  const issues = []
  if (!s.evidenceSummary)              issues.push('MISSING evidenceSummary')
  if (!s.evidenceCount)                issues.push('MISSING evidenceCount')
  if (!VALID_CONF.has(s.confidence))   issues.push(`INVALID confidence: ${s.confidence}`)
  if (!s.whatThisMayMean)              issues.push('MISSING whatThisMayMean')
  if (!s.recommendedAction)            issues.push('MISSING recommendedAction')
  const text = [s.title, s.evidenceSummary, s.whatThisMayMean, s.recommendedAction].join(' ').toLowerCase()
  for (const w of FORBIDDEN) {
    if (text.includes(w)) issues.push(`FORBIDDEN WORD: "${w}"`)
  }

  const ok = issues.length === 0
  if (!ok) allOk = false

  console.log(`${ok ? '✅' : '❌'} ${s.signalType} [${s.confidence}] evidence=${s.evidenceCount}`)
  console.log(`   Title:    ${s.title}`)
  console.log(`   Evidence: ${s.evidenceSummary}`)
  console.log(`   Means:    ${s.whatThisMayMean}`)
  console.log(`   Action:   ${s.recommendedAction}`)
  if (issues.length) console.log(`   ISSUES:   ${issues.join(', ')}`)
  console.log()
}

// suppression check: lower_accuracy must not appear when persistence covers the same topic
const persistenceTopics = new Set(signals.filter((s) => s.signalType === 'persistence').map((s) => s.topicId))
const lowerAccTopics    = new Set(signals.filter((s) => s.signalType === 'lower_accuracy').map((s) => s.topicId))
const suppressionOk = [...persistenceTopics].every((t) => !lowerAccTopics.has(t))

console.log('── Suppression check ──────────────────────')
console.log('persistence topics:', [...persistenceTopics])
console.log('lower_accuracy topics:', [...lowerAccTopics])
console.log(suppressionOk ? '✅ Suppression correct (no overlap)' : '❌ Suppression FAILED — overlap found')

console.log('\n── Signal types present ───────────────────')
const types = signals.map((s) => s.signalType)
const hasMasteryOrQuick     = types.some((t) => ['mastery', 'quick_success'].includes(t))
const hasLowerOrHighEffort  = types.some((t) => ['lower_accuracy', 'high_effort_low_progress'].includes(t))
const hasInterestOrPersist  = types.some((t) => ['interest_signal', 'persistence'].includes(t))
console.log(hasMasteryOrQuick    ? '✅ mastery / quick_success present'        : '❌ mastery / quick_success MISSING')
console.log(hasLowerOrHighEffort ? '✅ lower_accuracy / high_effort present'    : '❌ lower_accuracy / high_effort MISSING')
console.log(hasInterestOrPersist ? '✅ interest_signal / persistence present'   : '❌ interest_signal / persistence MISSING')

const finalOk = allOk && suppressionOk && hasMasteryOrQuick && hasLowerOrHighEffort && hasInterestOrPersist
console.log(`\nVerdict: ${finalOk ? 'PASS' : 'FAIL'}`)

await p.$disconnect()
if (!finalOk) process.exit(1)

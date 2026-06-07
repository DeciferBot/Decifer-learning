// Admin difficulty calibration page.
// Shows questions flagged as too_hard or too_easy based on session_answers data.
// Queries Prisma directly — no self-HTTP-fetch anti-pattern.
export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth/admin-guard'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { BarChart, Check } from '@/components/ui/icons'

export const metadata = { title: 'Difficulty Calibration — Admin' }
export const revalidate = 60

const MIN_ANSWERS = 20
const TOO_HARD_THRESHOLD = 0.80
const TOO_EASY_THRESHOLD = 0.10

export default async function CalibrationPage() {
  await requireAdmin()

  // Aggregate session_answers per question
  const rows = await prisma.sessionAnswer.groupBy({
    by: ['question_id'],
    _count: { _all: true },
  })

  const eligibleIds = rows
    .filter((r) => r._count._all >= MIN_ANSWERS)
    .map((r) => r.question_id)

  const totalWithData = eligibleIds.length

  type FlaggedQuestion = {
    question_id: string
    question_text: string
    tier: string
    wrong_rate: number
    flag_type: 'too_hard' | 'too_easy'
    topic_title: string
    subject: string
  }

  let flaggedQuestions: FlaggedQuestion[] = []

  if (eligibleIds.length > 0) {
    const correctCounts = await prisma.sessionAnswer.groupBy({
      by: ['question_id'],
      where: { question_id: { in: eligibleIds }, was_correct: true },
      _count: { _all: true },
    })
    const correctMap = Object.fromEntries(
      correctCounts.map((r) => [r.question_id, r._count._all]),
    )
    const totalMap = Object.fromEntries(
      rows
        .filter((r) => eligibleIds.includes(r.question_id))
        .map((r) => [r.question_id, r._count._all]),
    )

    const flagged: Array<{ question_id: string; wrong_rate: number; flag_type: 'too_hard' | 'too_easy' }> = []
    for (const qid of eligibleIds) {
      const total = totalMap[qid] ?? 0
      const correct = correctMap[qid] ?? 0
      const wrongRate = total > 0 ? (total - correct) / total : 0
      if (wrongRate > TOO_HARD_THRESHOLD) {
        flagged.push({ question_id: qid, wrong_rate: wrongRate, flag_type: 'too_hard' })
      } else if (wrongRate < TOO_EASY_THRESHOLD) {
        flagged.push({ question_id: qid, wrong_rate: wrongRate, flag_type: 'too_easy' })
      }
    }

    if (flagged.length > 0) {
      const flaggedIds = flagged.map((f) => f.question_id)
      const questions = await prisma.quizQuestion.findMany({
        where: { id: { in: flaggedIds } },
        select: {
          id: true,
          question_text: true,
          tier: true,
          topic: { select: { title: true, subject: { select: { name: true } } } },
        },
      })
      const qMap = Object.fromEntries(questions.map((q) => [q.id, q]))

      flaggedQuestions = flagged
        .flatMap((f) => {
          const q = qMap[f.question_id]
          if (!q) return []
          const item: FlaggedQuestion = {
            question_id: f.question_id,
            question_text: q.question_text,
            tier: q.tier as string,
            wrong_rate: Math.round(f.wrong_rate * 10000) / 10000,
            flag_type: f.flag_type,
            topic_title: q.topic.title,
            subject: q.topic.subject.name,
          }
          return [item]
        })
        .sort((a, b) => b.wrong_rate - a.wrong_rate)
    }
  }

  const tooHardCount = flaggedQuestions.filter((q) => q.flag_type === 'too_hard').length
  const tooEasyCount = flaggedQuestions.filter((q) => q.flag_type === 'too_easy').length

  return (
    <section className="space-y-6 max-w-3xl mx-auto px-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h1 className="font-heading text-2xl font-bold text-ink">Difficulty Calibration</h1>
        <Link href="/dashboard/admin" className="text-sm text-muted hover:text-ink">← Admin</Link>
      </div>

      <p className="text-sm text-muted leading-relaxed">
        Questions with ≥{MIN_ANSWERS} session answers are analysed. A wrong rate above{' '}
        {Math.round(TOO_HARD_THRESHOLD * 100)}% flags <strong>too hard</strong>; below{' '}
        {Math.round(TOO_EASY_THRESHOLD * 100)}% flags <strong>too easy</strong>.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm">
          <p className="font-heading text-2xl font-bold text-ink">{totalWithData.toLocaleString()}</p>
          <p className="text-xs text-muted mt-0.5">With data</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm">
          <p className={`font-heading text-2xl font-bold ${tooHardCount > 0 ? 'text-incorrect' : 'text-correct'}`}>
            {tooHardCount.toLocaleString()}
          </p>
          <p className="text-xs text-muted mt-0.5">Too hard</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm">
          <p className={`font-heading text-2xl font-bold ${tooEasyCount > 0 ? 'text-lightning' : 'text-correct'}`}>
            {tooEasyCount.toLocaleString()}
          </p>
          <p className="text-xs text-muted mt-0.5">Too easy</p>
        </div>
      </div>

      {/* Empty state or table */}
      {totalWithData === 0 ? (
        <div className="rounded-2xl border border-black/5 bg-surface px-6 py-10 text-center shadow-sm">
          <div className="flex justify-center mb-3"><BarChart className="w-10 h-10 text-muted" aria-hidden /></div>
          <p className="font-heading text-base font-semibold text-ink">No calibration data yet</p>
          <p className="mt-1 text-sm text-muted max-w-sm mx-auto leading-relaxed">
            Calibration data will appear here once children start using the app. Check back after 50+ quiz attempts.
          </p>
        </div>
      ) : flaggedQuestions.length === 0 ? (
        <div className="rounded-2xl border border-correct/20 bg-correct/5 px-6 py-8 text-center shadow-sm">
          <p className="font-heading text-base font-semibold text-correct flex items-center justify-center gap-1"><Check className="w-4 h-4" aria-hidden /> All calibrated</p>
          <p className="mt-1 text-sm text-muted">
            {totalWithData} question{totalWithData === 1 ? '' : 's'} analysed — none outside the difficulty thresholds.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-heading text-base font-bold text-ink">
            Flagged questions ({flaggedQuestions.length})
          </h2>
          <div className="space-y-2">
            {flaggedQuestions.map((q) => (
              <div
                key={q.question_id}
                className={`rounded-2xl border p-4 shadow-sm space-y-1 ${
                  q.flag_type === 'too_hard'
                    ? 'border-incorrect/20 bg-incorrect/5'
                    : 'border-lightning/30 bg-lightning/10'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>{q.subject} · {q.topic_title}</span>
                  <TierBadge tier={q.tier} />
                  <FlagBadge flag={q.flag_type} wrongRate={q.wrong_rate} />
                </div>
                <p className="text-sm text-ink leading-snug">{q.question_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function TierBadge({ tier }: { tier: string }) {
  const colours: Record<string, string> = {
    sprout: 'bg-sprout/30 text-ink',
    explorer: 'bg-explorer/30 text-ink',
    lightning: 'bg-lightning/30 text-ink',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium capitalize ${colours[tier] ?? 'bg-black/5 text-muted'}`}>
      {tier}
    </span>
  )
}

function FlagBadge({ flag, wrongRate }: { flag: 'too_hard' | 'too_easy'; wrongRate: number }) {
  const isTooHard = flag === 'too_hard'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
        isTooHard ? 'bg-incorrect/20 text-incorrect' : 'bg-lightning/30 text-ink'
      }`}
    >
      {isTooHard ? 'Too hard' : 'Too easy'} — {Math.round(wrongRate * 100)}% wrong
    </span>
  )
}

// GET /api/admin/calibration — difficulty calibration stats for admin.
// Returns questions with ≥20 session answers that are flagged as too_hard or too_easy.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/auth/admin-guard'

const MIN_ANSWERS = 20
const TOO_HARD_THRESHOLD = 0.80
const TOO_EASY_THRESHOLD = 0.10

export async function GET() {
  const denied = await requireAdminApi()
  if (denied) return denied

  // Aggregate session_answers per question
  const rows = await prisma.sessionAnswer.groupBy({
    by: ['question_id'],
    _count: { _all: true },
  })

  // Filter to questions with enough data
  const eligibleIds = rows
    .filter((r) => r._count._all >= MIN_ANSWERS)
    .map((r) => r.question_id)

  if (eligibleIds.length === 0) {
    return NextResponse.json({
      total_with_data: 0,
      too_hard: 0,
      too_easy: 0,
      flagged: [],
    })
  }

  // For each eligible question, count correct vs total
  const correctCounts = await prisma.sessionAnswer.groupBy({
    by: ['question_id'],
    where: {
      question_id: { in: eligibleIds },
      was_correct: true,
    },
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

  // Build flagged list
  type FlagType = 'too_hard' | 'too_easy'
  const flagged: Array<{
    question_id: string
    wrong_rate: number
    flag_type: FlagType
  }> = []

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

  if (flagged.length === 0) {
    return NextResponse.json({
      total_with_data: eligibleIds.length,
      too_hard: 0,
      too_easy: 0,
      flagged: [],
    })
  }

  // Fetch question details for flagged items
  const flaggedIds = flagged.map((f) => f.question_id)
  const questions = await prisma.quizQuestion.findMany({
    where: { id: { in: flaggedIds } },
    select: {
      id: true,
      question_text: true,
      tier: true,
      topic: {
        select: {
          title: true,
          subject: { select: { name: true } },
        },
      },
    },
  })
  const qMap = Object.fromEntries(questions.map((q) => [q.id, q]))

  const flaggedWithDetails = flagged
    .map((f) => {
      const q = qMap[f.question_id]
      if (!q) return null
      return {
        question_id: f.question_id,
        question_text: q.question_text,
        tier: q.tier,
        wrong_rate: Math.round(f.wrong_rate * 10000) / 10000,
        flag_type: f.flag_type,
        topic_title: q.topic.title,
        subject: q.topic.subject.name,
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b!.wrong_rate - a!.wrong_rate))

  return NextResponse.json({
    total_with_data: eligibleIds.length,
    too_hard: flagged.filter((f) => f.flag_type === 'too_hard').length,
    too_easy: flagged.filter((f) => f.flag_type === 'too_easy').length,
    flagged: flaggedWithDetails,
  })
}

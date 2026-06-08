// Exam Revision Mode — question selection and scoring helpers.
//
// SAFETY CONTRACT:
//   - Only ever selects status='published' quiz questions.
//   - No SM-2 updates, no card drops — exam is assessment only.
//   - Tier mix: 40% sprout / 40% explorer / 20% lightning (same as regular quiz).

import { prisma } from './prisma'

export interface ExamQuestion {
  id: string
  topic_id: string
  topic_title: string
  tier: string
  question_text: string
  question_type: string
  correct_answer: string
  distractors: unknown
  hint_1: string | null
  hint_2: string | null
  hint_3: string | null
  explanation: string | null
  worked_example: string | null
  technique_type: string | null
  technique_hint: string | null
  technique_note: string | null
  answer_parts: unknown
  source_text: string | null
  source_label: string | null
  source_type: string | null
}

export interface ExamAnswerRecord {
  questionId: string
  topicId: string
  childAnswer: string
  wasCorrect: boolean
  timeSeconds: number
}

export interface TopicBreakdown {
  topicId: string
  topicTitle: string
  correct: number
  total: number
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function selectExamQuestions(
  assignmentId: string,
  childProfileId: string,
): Promise<ExamQuestion[]> {
  const assignment = await prisma.examAssignment.findUnique({
    where: { id: assignmentId },
    include: { subject: true, year_group: true },
  })
  if (!assignment) throw new Error('Exam assignment not found')

  // Build topic pool
  let topicIds: string[]

  if (assignment.topic_scope === 'selected' && Array.isArray(assignment.topic_ids)) {
    topicIds = assignment.topic_ids as string[]
  } else if (assignment.topic_scope === 'weak_areas') {
    // Topics where the child's error rate > 50% (min 5 answers)
    const answers = await prisma.quizAnswer.findMany({
      where: {
        attempt: { profile_id: childProfileId },
        question: {
          topic: {
            subject_id: assignment.subject_id,
            year_group_id: assignment.year_group_id,
          },
        },
      },
      select: { was_correct: true, question: { select: { topic_id: true } } },
    })
    const byTopic: Record<string, { correct: number; total: number }> = {}
    for (const a of answers) {
      const tid = a.question.topic_id
      if (!byTopic[tid]) byTopic[tid] = { correct: 0, total: 0 }
      byTopic[tid].total++
      if (a.was_correct) byTopic[tid].correct++
    }
    topicIds = Object.entries(byTopic)
      .filter(([, s]) => s.total >= 5 && (s.total - s.correct) / s.total > 0.5)
      .map(([id]) => id)

    // Fall back to all topics if no weak areas found
    if (topicIds.length === 0) {
      const all = await prisma.topic.findMany({
        where: {
          subject_id: assignment.subject_id,
          year_group_id: assignment.year_group_id,
          is_published: true,
        },
        select: { id: true },
      })
      topicIds = all.map((t) => t.id)
    }
  } else {
    // 'all'
    const all = await prisma.topic.findMany({
      where: {
        subject_id: assignment.subject_id,
        year_group_id: assignment.year_group_id,
        is_published: true,
      },
      select: { id: true },
    })
    topicIds = all.map((t) => t.id)
  }

  if (topicIds.length === 0) return []

  // Fetch published questions for the topic pool with topic title
  const questions = await prisma.quizQuestion.findMany({
    where: {
      topic_id: { in: topicIds },
      status: 'published',
    },
    select: {
      id: true,
      topic_id: true,
      tier: true,
      question_text: true,
      question_type: true,
      correct_answer: true,
      distractors: true,
      hint_1: true,
      hint_2: true,
      hint_3: true,
      explanation: true,
      worked_example: true,
      technique_type: true,
      technique_hint: true,
      technique_note: true,
      answer_parts: true,
      source_text: true,
      source_label: true,
      source_type: true,
      topic: { select: { title: true } },
    },
  })

  const byTier: Record<string, typeof questions> = {
    sprout: questions.filter((q) => q.tier === 'sprout'),
    explorer: questions.filter((q) => q.tier === 'explorer'),
    lightning: questions.filter((q) => q.tier === 'lightning'),
  }

  const n = assignment.question_count
  const nSprout = Math.round(n * 0.4)
  const nExplorer = Math.round(n * 0.4)
  const nLightning = n - nSprout - nExplorer

  const picked = [
    ...shuffle(byTier.sprout).slice(0, nSprout),
    ...shuffle(byTier.explorer).slice(0, nExplorer),
    ...shuffle(byTier.lightning).slice(0, nLightning),
  ]

  // If we couldn't fill a tier, top up from any tier
  if (picked.length < n) {
    const usedIds = new Set(picked.map((q) => q.id))
    const remaining = shuffle(questions.filter((q) => !usedIds.has(q.id)))
    picked.push(...remaining.slice(0, n - picked.length))
  }

  return shuffle(picked).slice(0, n).map((q) => ({
    id: q.id,
    topic_id: q.topic_id,
    topic_title: q.topic.title,
    tier: q.tier,
    question_text: q.question_text,
    question_type: q.question_type,
    correct_answer: q.correct_answer,
    distractors: q.distractors,
    hint_1: q.hint_1,
    hint_2: q.hint_2,
    hint_3: q.hint_3,
    explanation: q.explanation,
    worked_example: q.worked_example,
    technique_type: q.technique_type,
    technique_hint: q.technique_hint,
    technique_note: q.technique_note,
    answer_parts: q.answer_parts,
    source_text: q.source_text,
    source_label: q.source_label,
    source_type: q.source_type,
  }))
}

export function scoreExamAnswers(answers: ExamAnswerRecord[]): {
  score: number
  correct: number
  total: number
  breakdown: TopicBreakdown[]
} {
  const total = answers.length
  const correct = answers.filter((a) => a.wasCorrect).length
  const score = total > 0 ? correct / total : 0

  const byTopic: Record<string, TopicBreakdown> = {}
  for (const a of answers) {
    if (!byTopic[a.topicId]) {
      byTopic[a.topicId] = { topicId: a.topicId, topicTitle: '', correct: 0, total: 0 }
    }
    byTopic[a.topicId].total++
    if (a.wasCorrect) byTopic[a.topicId].correct++
  }

  return { score, correct, total, breakdown: Object.values(byTopic) }
}

export function examPointsAwarded(correct: number): number {
  return Math.round(correct * 1.5)
}

/**
 * Marks a pupil's written answer against the question's rubric.
 *
 * THE MODEL DOES NOT TALK TO THE CHILD. It returns one thing, a list of
 * criterion indices, and this route bounds-checks that list against the rubric
 * before using it. Both the marks and every word the child reads are then
 * computed here from criteria a human wrote.
 *
 * It used to ask the model for the feedback sentence as well and pass that
 * straight through to the child, unread by anything. That is what
 * scripts/verify-content-safety.mjs check 7 exists to stop, and it had been
 * failing on this file. Check 7 now allows this one route to import the SDK
 * and fails it again the moment any model-authored string reaches the response.
 */
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import {
  buildFeedback,
  MARKING_UNAVAILABLE_FEEDBACK,
  type MarkingCriterion,
} from '@/lib/quiz-marking-feedback'

const anthropic = new Anthropic()
const MARKING_MODEL = 'claude-haiku-4-5-20251001'

export type MarkingResult = {
  marksAwarded: number
  marksAvailable: number
  criteriaMet: number[]   // 0-based indices of criteria that were met
  feedback: string
  modelAnswer: string
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { questionId: string; childAnswer: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { questionId, childAnswer } = body
  if (!questionId || typeof childAnswer !== 'string') {
    return NextResponse.json({ error: 'Missing questionId or childAnswer' }, { status: 400 })
  }
  if (childAnswer.trim().length === 0) {
    return NextResponse.json({ error: 'Empty answer' }, { status: 400 })
  }
  // Cap input to prevent abuse
  const answerText = childAnswer.slice(0, 2000)

  // Fetch the question — findFirst because we need both id (unique) and status filter
  const question = await prisma.quizQuestion.findFirst({
    where: { id: questionId, status: 'published', question_type: 'structured_answer' },
    select: {
      question_text: true,
      correct_answer: true,
      answer_parts: true,
      topic: { select: { year_group_id: true } },
    },
  })
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  // Verify the child has access to this question's year group
  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { year_group_id: true },
  })
  if (!profile || profile.year_group_id !== question.topic.year_group_id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const criteria = question.answer_parts as MarkingCriterion[] | null
  if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
    return NextResponse.json({ error: 'Question has no marking rubric' }, { status: 422 })
  }

  const marksAvailable = criteria.reduce((sum, c) => sum + (c.marks ?? 1), 0)
  const modelAnswer = question.correct_answer

  const rubricLines = criteria
    .map((c, i) => `${i + 1}. [${c.marks} mark${c.marks !== 1 ? 's' : ''}] ${c.criterion}`)
    .join('\n')

  const markingPrompt = `You are marking a UK school pupil's written answer. Be fair and generous — award a mark if the pupil conveys the idea, even if the wording is imperfect or informal.

Question: ${question.question_text}

Marking rubric (award marks per criterion):
${rubricLines}

Model answer (for your reference only — do not penalise different wording):
${modelAnswer}

Pupil's answer:
${answerText}

Instructions:
- For each criterion, decide: did the pupil's answer convey this idea, even approximately? If yes, award the mark.
- criteriaMet: list the 0-based indices of criteria the pupil met (e.g. [0, 2] means criteria 1 and 3 were met).
- Return nothing else. Do not write feedback, praise or commentary: the pupil never sees your words, only which criteria you judged met.

Return ONLY valid JSON:
{
  "criteriaMet": [<0-based indices>]
}`

  let markingResult: MarkingResult
  try {
    const msg = await anthropic.messages.create({
      model: MARKING_MODEL,
      max_tokens: 300,
      temperature: 0,
      messages: [{ role: 'user', content: markingPrompt }],
    })

    const raw = (msg.content[0] as { text: string }).text.trim()
    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(jsonStr) as { criteriaMet?: unknown }

    // The only thing taken from the model, and it is bounds-checked against the
    // rubric before use. Anything out of range, duplicated or not a whole
    // number is dropped rather than trusted.
    const criteriaMet = Array.from(
      new Set(
        (Array.isArray(parsed.criteriaMet) ? parsed.criteriaMet : []).filter(
          (i): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < criteria.length
        )
      )
    ).sort((a, b) => a - b)

    const marksAwarded = criteriaMet.reduce((sum, i) => sum + (criteria[i]?.marks ?? 1), 0)

    markingResult = {
      marksAwarded,
      marksAvailable,
      criteriaMet,
      // Built here from the authored criteria, never from the model's words.
      feedback: buildFeedback(criteria, criteriaMet),
      modelAnswer,
    }
  } catch (err) {
    console.error('[quiz/mark] Claude marking failed:', err)
    return NextResponse.json(
      { error: 'Marking failed, please try again', feedback: MARKING_UNAVAILABLE_FEEDBACK },
      { status: 502 }
    )
  }

  return NextResponse.json(markingResult)
}

import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { calcQuizPoints, scoreAnswers, scoreQuizAttempt } from '@/lib/points'
import { getConsentGate, CONSENT_GATE_RESPONSE } from '@/lib/parental-consent'
import { getGuardianGate } from '@/lib/guardian'
import { notifyParentBigMoment } from '@/lib/parent-notify'
import type { DroppedCard, EarnedBadge } from '@/app/api/quiz/submit/route'

type AnswerInput = {
  questionId: string
  childAnswer: string
  wasCorrect: boolean
  hintNumber: number
  timeSeconds: number
}

type GuardianSubmitBody = {
  answers: AnswerInput[]
  timeTakenSeconds: number
  heartsRemaining: number
}

export async function POST(req: Request, { params }: { params: { zoneId: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: GuardianSubmitBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { answers, timeTakenSeconds: _time, heartsRemaining: _hearts } = body
  if (!Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (answers.length > 50) {
    return NextResponse.json({ error: 'Too many answers' }, { status: 400 })
  }

  const profile = await prisma.profile.findUnique({ where: { user_id: user.id } })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Parental-consent soft gate — same rule as /api/quiz/submit.
  const consentGate = await getConsentGate(user.id)
  if (consentGate.state === 'gated') {
    return NextResponse.json(CONSENT_GATE_RESPONSE, { status: 422 })
  }

  // Scope zone to the child's year group — prevent cross-year-group submissions
  const zone = await prisma.zone.findFirst({
    where: {
      id: params.zoneId,
      ...(profile.year_group_id ? { year_group_id: profile.year_group_id } : {}),
    },
    select: { id: true, name: true },
  })
  if (!zone) return NextResponse.json({ error: 'Zone not found' }, { status: 404 })

  // The boss is earned. The guardian page redirects a child who has not finished
  // the zone, and this is the same check on the reward side so the URL alone
  // wins nothing. See lib/guardian.ts.
  const gate = await getGuardianGate(profile.id, zone.id)
  if (!gate.unlocked) {
    return NextResponse.json(
      {
        error: 'Finish every topic in this zone before facing the Guardian',
        code: 'GUARDIAN_LOCKED',
        completedTopics: gate.completedTopics,
        totalTopics: gate.totalTopics,
      },
      { status: 403 },
    )
  }

  // ── Server-side verification — never trust the client's wasCorrect ────────
  // The Guardian pool is every published question across the zone's published
  // topics, so the answer key is scoped the same way. Anything outside that
  // pool has no key row and scores wrong.
  const answerKey = await prisma.quizQuestion.findMany({
    where: {
      id: { in: answers.map((a) => a.questionId) },
      status: 'published',
      topic: { zone_id: zone.id, is_published: true },
    },
    select: { id: true, correct_answer: true, question_type: true },
  })
  const scoredAnswers = scoreAnswers(answers, answerKey)
  // ── End server-side verification ──────────────────────────────────────────

  // Scored per distinct question with credit falling by try, matching
  // /api/quiz/submit. Guardian quizzes carry the same 3-tries-per-question
  // mechanic, so the old row-count scoring punished persistence here too.
  const { totalQuestions, correctCount, scoreFraction, passed } = scoreQuizAttempt(scoredAnswers)
  const points = passed ? calcQuizPoints(scoredAnswers) : 0

  if (!passed) {
    return NextResponse.json({
      points: 0,
      passed: false,
      // `score` is a COUNT; `scoreFraction` is the credit-weighted 0–1 value.
      score: correctCount,
      scoreFraction,
      totalQuestions,
      totalPoints: profile.total_points,
      droppedCard: null,
      newBadges: [],
      shieldAwarded: false,
      streakDays: profile.streak_days,
      newStreak: false,
    })
  }

  // Passed — award points, Legendary card, Guardian Slayer badge
  const result = await prisma.$transaction(
    async (tx) => {
      // Points
      const newTotalPoints = profile.total_points + points
      if (points > 0) {
        await tx.pointEvent.create({
          data: {
            profile_id: profile.id,
            amount: points,
            reason: `guardian:${params.zoneId}`,
          },
        })
      }
      await tx.profile.update({
        where: { id: profile.id },
        data: { total_points: newTotalPoints },
      })

      // Force Legendary card drop (guardian always awards Legendary)
      const legendaryCards = await tx.cardCatalog.findMany({
        where: {
          rarity: 'legendary',
          status: 'published',
          OR: [
            { year_group_id: profile.year_group_id ?? undefined },
            { year_group_id: null },
          ],
        },
      })

      let droppedCard: DroppedCard | null = null
      if (legendaryCards.length > 0) {
        const card = legendaryCards[Math.floor(Math.random() * legendaryCards.length)]
        const existing = await tx.childCollection.findUnique({
          where: { profile_id_card_id: { profile_id: profile.id, card_id: card.id } },
        })
        if (existing) {
          await tx.childCollection.update({
            where: { profile_id_card_id: { profile_id: profile.id, card_id: card.id } },
            data: { quantity: { increment: 1 } },
          })
        } else {
          await tx.childCollection.create({
            data: { profile_id: profile.id, card_id: card.id, quantity: 1 },
          })
        }
        droppedCard = {
          id: card.id,
          title: card.title,
          fact_text: card.fact_text,
          rarity: 'legendary',
          isNew: !existing,
        }
      }

      // Guardian Slayer badge (only once; ownedIds guard prevents double-award)
      const existingBadges = await tx.profileBadge.findMany({
        where: { profile_id: profile.id },
        select: { badge_id: true },
      })
      const ownedIds = new Set(existingBadges.map((b) => b.badge_id))

      const allBadges = await tx.badge.findMany()
      let earnedBadge: EarnedBadge | null = null
      for (const badge of allBadges) {
        if (ownedIds.has(badge.id)) continue
        const rule = badge.trigger_rule as { type: string }
        if (rule.type === 'guardian_win') {
          await tx.profileBadge.create({
            data: { profile_id: profile.id, badge_id: badge.id },
          })
          earnedBadge = {
            id: badge.id,
            name: badge.name ?? '',
            description: badge.description ?? '',
          }
          break
        }
      }

      return { newTotalPoints, droppedCard, earnedBadge }
    },
    { timeout: 15000 },
  )

  // Non-blocking parent email on the first-ever Guardian win (the Guardian
  // Slayer badge is awarded once, so this fires at most once). Never throws.
  // waitUntil, not `void` — see the note in app/api/quiz/submit/route.ts: on
  // Vercel an un-awaited promise is frozen with the response and never sends.
  if (result.earnedBadge) {
    waitUntil(notifyParentBigMoment(profile.id, profile.display_name, { kind: 'guardian_win', zoneName: zone.name }))
  }

  return NextResponse.json({
    points,
    passed: true,
    // `score` is a COUNT; `scoreFraction` is the credit-weighted 0–1 value.
    score: correctCount,
    scoreFraction,
    totalQuestions,
    totalPoints: result.newTotalPoints,
    droppedCard: result.droppedCard,
    newBadges: result.earnedBadge ? [result.earnedBadge] : [],
    shieldAwarded: false,
    streakDays: profile.streak_days,
    newStreak: false,
  })
}

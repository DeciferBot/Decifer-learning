import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { calcQuizPoints } from '@/lib/points'
import { getConsentGate, CONSENT_GATE_RESPONSE } from '@/lib/parental-consent'
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

  const totalQuestions = answers.length
  const correctCount = answers.filter((a) => a.wasCorrect).length
  const scoreFraction = correctCount / totalQuestions
  const passed = scoreFraction >= 0.7
  const points = passed ? calcQuizPoints(answers) : 0

  if (!passed) {
    return NextResponse.json({
      points: 0,
      passed: false,
      score: correctCount,
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
  if (result.earnedBadge) {
    void notifyParentBigMoment(profile.id, profile.display_name, { kind: 'guardian_win', zoneName: zone.name })
  }

  return NextResponse.json({
    points,
    passed: true,
    score: correctCount,
    totalQuestions,
    totalPoints: result.newTotalPoints,
    droppedCard: result.droppedCard,
    newBadges: result.earnedBadge ? [result.earnedBadge] : [],
    shieldAwarded: false,
    streakDays: profile.streak_days,
    newStreak: false,
  })
}

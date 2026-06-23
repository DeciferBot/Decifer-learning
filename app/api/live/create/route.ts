import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import {
  getAuthedProfile,
  generateUniquePin,
  isValidEmail,
  cleanNickname,
  GUEST_COOKIE,
  GUEST_COOKIE_MAX_AGE,
} from '@/lib/live/server'
import { selectLiveQuestions } from '@/lib/live/questions'

// POST /api/live/create
// Anyone can host — logged-in users use their profile; guests supply an email.
// Returns { gameId, pin }.

type CreateBody = {
  mode: 'topic' | 'subject'
  topicId?: string
  subjectId?: string
  yearGroupId?: string
  questionCount?: number
  secondsPerQuestion?: number
  email?: string      // required when not logged in
  nickname?: string   // optional guest host display name
}

const MIN_QUESTIONS = 3
const MAX_QUESTIONS = 20
const ALLOWED_SECONDS = new Set([10, 15, 20, 30])

export async function POST(req: Request) {
  const profile = await getAuthedProfile()

  let body: CreateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Resolve host identity
  let hostProfileId: string | null = null
  let hostEmail: string | null = null
  let hostGuestToken: string | null = null
  let hostDisplayName: string

  if (profile) {
    hostProfileId = profile.id
    hostDisplayName = profile.display_name
  } else {
    if (!isValidEmail(body.email)) {
      return NextResponse.json({ error: 'valid_email_required' }, { status: 400 })
    }
    hostEmail = body.email.trim().toLowerCase()
    hostGuestToken = crypto.randomUUID()
    // Use supplied nickname, or derive from email local-part
    const fromEmail = hostEmail.split('@')[0].slice(0, 20)
    hostDisplayName = cleanNickname(body.nickname) ?? fromEmail
  }

  const mode = body.mode === 'subject' ? 'subject' : 'topic'
  const questionCount = Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, body.questionCount ?? 10))
  const secondsPerQuestion = ALLOWED_SECONDS.has(body.secondsPerQuestion ?? 0)
    ? (body.secondsPerQuestion as number)
    : 20

  if (mode === 'topic' && !body.topicId) {
    return NextResponse.json({ error: 'topicId required' }, { status: 400 })
  }
  if (mode === 'subject' && !body.subjectId) {
    return NextResponse.json({ error: 'subjectId required' }, { status: 400 })
  }

  const yearGroupId = body.yearGroupId ?? profile?.year_group_id ?? null

  const questions = await selectLiveQuestions({
    mode,
    topicId: body.topicId,
    subjectId: body.subjectId,
    yearGroupId,
    count: questionCount,
  })

  if (questions.length < MIN_QUESTIONS) {
    return NextResponse.json(
      { error: 'not_enough_questions', available: questions.length },
      { status: 422 },
    )
  }

  const pin = await generateUniquePin()

  const game = await prisma.liveGame.create({
    data: {
      pin,
      host_profile_id: hostProfileId,
      host_email: hostEmail,
      host_guest_token: hostGuestToken,
      status: 'lobby',
      mode,
      topic_id: mode === 'topic' ? body.topicId : null,
      subject_id: mode === 'subject' ? body.subjectId : null,
      year_group_id: yearGroupId,
      question_ids: questions.map((q) => q.id),
      question_count: questions.length,
      seconds_per_question: secondsPerQuestion,
      current_index: -1,
      players: {
        create: profile
          ? {
              profile_id: profile.id,
              display_name: profile.display_name,
              avatar_config: profile.avatar_config ?? undefined,
              is_host: true,
            }
          : {
              guest_token: hostGuestToken!,
              is_guest: true,
              display_name: hostDisplayName,
              is_host: true,
            },
      },
    },
    select: { id: true, pin: true },
  })

  // Give guest hosts the same cookie so resolveHostAuth + resolvePlayer work.
  if (hostGuestToken) {
    cookies().set(GUEST_COOKIE, hostGuestToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: GUEST_COOKIE_MAX_AGE,
      path: '/',
    })
  }

  return NextResponse.json({ gameId: game.id, pin: game.pin })
}

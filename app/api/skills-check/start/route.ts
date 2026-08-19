import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { rateLimit } from '@/lib/rate-limit'
import { getPublishedCheck, startAttempt } from '@/lib/skills-check/server'

// POST /api/skills-check/start  { subject, year }
//
// Public and unauthenticated on purpose: the whole point of the Skills Check is
// that a parent can hand a child a tablet without making an account first.
//
// Returns the questions with their options already shuffled, and NOTHING that
// says which option is right. Marking happens server-side in /submit.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  // Generous: a family sharing one connection may legitimately start several.
  if (!rateLimit(`skills-check-start:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  let body: { subject?: string; year?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const subject = body.subject?.trim().toLowerCase()
  const year = body.year?.trim().toLowerCase()
  if (!subject || !year) {
    return NextResponse.json({ error: 'Missing subject or year.' }, { status: 400 })
  }

  const check = await getPublishedCheck(subject, year)
  if (!check) {
    return NextResponse.json({ error: 'No check available for that subject and year.' }, { status: 404 })
  }

  const started = await startAttempt(check.id)
  if (!started || started.questions.length === 0) {
    return NextResponse.json({ error: 'That check has no questions yet.' }, { status: 404 })
  }

  return NextResponse.json({
    token: started.token,
    subjectName: started.subjectName,
    yearLabel: started.yearLabel,
    questions: started.questions,
  })
}

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { rateLimit } from '@/lib/rate-limit'
import { submitAttempt, getAttemptView } from '@/lib/skills-check/server'

// POST /api/skills-check/submit  { token, answers: [{ itemId, answer, timeSeconds }] }
//
// Marks the whole check server-side and returns ONLY the free teaser. The strand
// detail stays behind the email gate, so it is never sent to a browser that has
// not unlocked it.

export const dynamic = 'force-dynamic'

type Body = {
  token?: string
  answers?: { itemId?: string; answer?: string | null; timeSeconds?: number }[]
}

export async function POST(req: Request) {
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`skills-check-submit:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const token = body.token?.trim()
  if (!token) return NextResponse.json({ error: 'Missing token.' }, { status: 400 })

  const answers = (body.answers ?? [])
    .filter((a): a is { itemId: string; answer?: string | null; timeSeconds?: number } =>
      typeof a?.itemId === 'string' && a.itemId.length > 0,
    )
    .map((a) => ({
      itemId: a.itemId,
      answer: typeof a.answer === 'string' ? a.answer : null,
      timeSeconds: typeof a.timeSeconds === 'number' && a.timeSeconds >= 0 ? a.timeSeconds : undefined,
    }))

  const result = await submitAttempt(token, answers)
  if (!result) return NextResponse.json({ error: 'Unknown check.' }, { status: 404 })

  const view = await getAttemptView(token)
  if (!view) return NextResponse.json({ error: 'Unknown check.' }, { status: 404 })

  return NextResponse.json({ token: view.token, teaser: view.teaser })
}

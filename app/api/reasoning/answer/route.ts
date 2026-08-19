import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { rateLimit } from '@/lib/rate-limit'
import { answerQuestion, isDone } from '@/lib/reasoning/server'

// POST /api/reasoning/answer  { token, position, chosenIndex, timeMs }
//
// Marks one answer and hands back the next question, or `done`.
//
// Marking regenerates the item from its seed server-side and compares indexes.
// The browser is never told which option was right — not before the answer and
// not after it — so there is nothing in the page source to read the paper off.

export const dynamic = 'force-dynamic'

// One answer roughly every few seconds, 24 of them, plus retries. Well clear of
// honest use, tight enough that a script cannot grind through paper after paper.
const ANSWERS_PER_MINUTE = 60

export async function POST(req: Request) {
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`reasoning-answer:${ip}`, ANSWERS_PER_MINUTE, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  let body: { token?: string; position?: number; chosenIndex?: number | null; timeMs?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const token = body.token?.trim()
  if (!token) return NextResponse.json({ error: 'Missing token.' }, { status: 400 })
  if (!Number.isInteger(body.position) || (body.position as number) < 0) {
    return NextResponse.json({ error: 'Missing position.' }, { status: 400 })
  }

  const chosenIndex =
    Number.isInteger(body.chosenIndex) && (body.chosenIndex as number) >= 0
      ? (body.chosenIndex as number)
      : null

  // Clamp rather than reject. The time is a client-supplied stopwatch, so a tab
  // left open over lunch or a clock that jumps should not lose an answer — but
  // it must not poison the median either. An hour is well past any real item.
  const rawTime = typeof body.timeMs === 'number' && body.timeMs >= 0 ? Math.round(body.timeMs) : null
  const timeMs = rawTime === null ? null : Math.min(rawTime, 3_600_000)

  const step = await answerQuestion(token, body.position as number, chosenIndex, timeMs)
  if (!step) return NextResponse.json({ error: 'Unknown test.' }, { status: 404 })

  if (isDone(step)) return NextResponse.json({ token: step.token, done: true })
  return NextResponse.json({ token: step.token, question: step.question })
}

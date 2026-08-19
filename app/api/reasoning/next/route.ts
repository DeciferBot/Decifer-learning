import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { rateLimit } from '@/lib/rate-limit'
import { currentStep, isDone } from '@/lib/reasoning/server'

// POST /api/reasoning/next  { token }
//
// The question this attempt is currently on. This is what a reload calls.
//
// It regenerates the item from (token, position, answers so far) rather than
// reading stored content, so a child who refreshes mid-test gets the same
// shapes in the same option order, not a fresh question. That is scope §11's
// Phase B gate: "a reload mid-test does not reshuffle".

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`reasoning-next:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  let body: { token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const token = body.token?.trim()
  if (!token) return NextResponse.json({ error: 'Missing token.' }, { status: 400 })

  const step = await currentStep(token)
  if (!step) return NextResponse.json({ error: 'Unknown test.' }, { status: 404 })

  if (isDone(step)) return NextResponse.json({ token: step.token, done: true })
  return NextResponse.json({ token: step.token, question: step.question })
}

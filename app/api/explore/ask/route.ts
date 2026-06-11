import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit } from '@/lib/rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorised', { status: 401 })

  // Rate limit: 30 requests per user per minute to prevent API budget exhaustion
  if (!rateLimit(`explore-ask:${user.id}`, 30, 60_000)) {
    return new Response('Too many requests', { status: 429 })
  }

  const raw = await req.json()
  const message: string = String(raw.message ?? '').trim().slice(0, 1000)
  const aid: string = String(raw.aid ?? '').slice(0, 100)
  const context: string = String(raw.context ?? '').slice(0, 200)
  const yearGroup: string = String(raw.yearGroup ?? '').slice(0, 50)
  const history: { role: string; content: string }[] = Array.isArray(raw.history) ? raw.history : []

  if (!message) return new Response('Bad request', { status: 400 })

  const systemPrompt = `You are Decifer, a brilliant and enthusiastic assistant teacher in the Decifer Learning app.
You're currently helping a child who is exploring the ${aid} in the interactive learning area.
${context ? `They are currently looking at: ${context}.` : ''}
${yearGroup ? `They are in ${yearGroup}.` : ''}

Your personality:
- Genuinely excited about learning — you love this stuff!
- Warm, friendly, never preachy or condescending
- Short answers (2-4 sentences) unless they clearly want more depth
- Use simple language but don't talk down to them
- Add a fun fact or surprising twist when you can
- End with an open question to encourage curiosity (but only sometimes, not every reply)
- Never say "Great question!" or "That's a wonderful question" — just answer
- UK English spelling (colour, recognise, etc.)

You know everything about: science, space, geography, history, biology, chemistry, animals, and all school subjects.`

  // Cap each history message body and strip leading assistant turns
  const rawHistory = history
    .slice(-6)
    .map((m) => ({ role: m.role, content: String(m.content ?? '').slice(0, 1000) }))
  const firstUserIdx = rawHistory.findIndex((m) => m.role === 'user')
  const safeHistory = firstUserIdx === -1 ? [] : rawHistory.slice(firstUserIdx)

  const messages = [
    ...safeHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message },
  ]

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: systemPrompt,
          messages,
        })
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorised', { status: 401 })

  const { message, aid, context, yearGroup, history = [] } = await req.json()

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

  const messages = [
    ...history.slice(-6).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message },
  ]

  const stream = anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}

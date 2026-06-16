import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { ensureNarrationAudio } from '@/lib/explore/tts'

// Needs Node crypto + Buffer + the service-role Supabase client.
export const runtime = 'nodejs'

/**
 * Returns a public URL to the fixed-voice narration audio for the given text,
 * generating + caching it on a miss. See lib/explore/tts.ts for the rationale
 * (consistent voice across every device instead of per-device speechSynthesis).
 */
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Cache hits are cheap; misses hit OpenAI. 60/min/user is generous for a
  // child clicking through narration while still capping API spend.
  if (!rateLimit(`explore-tts:${user.id}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const raw = await req.json().catch(() => null)
  const text = String(raw?.text ?? '').trim()
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  try {
    const audio = await ensureNarrationAudio(text)
    if (!audio) return NextResponse.json({ error: 'No narration' }, { status: 400 })
    return NextResponse.json({ url: audio.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS failed'
    console.error('[explore/tts]', message)
    return NextResponse.json({ error: 'TTS unavailable' }, { status: 502 })
  }
}

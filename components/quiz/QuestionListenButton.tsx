'use client'

import { useEffect, useRef, useState } from 'react'
import { Volume2, RefreshCw } from '@/components/ui/icons'

/**
 * Reads the current question aloud on tap. Reuses the same server-side
 * Piper narration already built for Explore (/api/explore/tts,
 * lib/explore/tts.ts) — fixed voice, cached by content hash, no new
 * infrastructure. Shown to every child, but this is the one piece of UI a
 * pre-reader in "young mode" cannot play the quiz without.
 */
export function QuestionListenButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const tokenRef = useRef(0)

  useEffect(() => {
    // A fresh question invalidates any in-flight fetch or playing audio for
    // the previous one.
    tokenRef.current += 1
    audioRef.current?.pause()
    setState('idle')
  }, [text])

  useEffect(() => () => { audioRef.current?.pause() }, [])

  function toggle() {
    if (state === 'playing') {
      audioRef.current?.pause()
      setState('idle')
      return
    }
    const myToken = ++tokenRef.current
    setState('loading')
    fetch('/api/explore/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ url }: { url: string }) => {
        if (myToken !== tokenRef.current) return // stale — question changed mid-fetch
        if (!audioRef.current) audioRef.current = new Audio()
        const audio = audioRef.current
        audio.src = url
        audio.onended = () => { if (myToken === tokenRef.current) setState('idle') }
        audio.onerror = () => { if (myToken === tokenRef.current) setState('idle') }
        audio.play()
          .then(() => { if (myToken === tokenRef.current) setState('playing') })
          .catch(() => { if (myToken === tokenRef.current) setState('idle') })
      })
      .catch(() => { if (myToken === tokenRef.current) setState('idle') })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={state === 'playing' ? 'Stop reading the question aloud' : 'Read the question aloud'}
      aria-pressed={state === 'playing'}
      className={[
        'inline-flex min-h-[48px] min-w-[48px] items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors',
        state === 'playing'
          ? 'bg-maths/15 text-maths'
          : 'bg-black/5 text-ink-2 hover:bg-black/10',
      ].join(' ')}
    >
      {state === 'loading'
        ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
        : <Volume2 className="h-4 w-4" aria-hidden />}
      <span>{state === 'playing' ? 'Stop' : 'Listen'}</span>
    </button>
  )
}

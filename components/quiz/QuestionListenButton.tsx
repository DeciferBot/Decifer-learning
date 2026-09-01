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

  /**
   * Second voice, for when the first one fails.
   *
   * The nice recorded voice comes from our own server. If that call fails —
   * the server is busy, the connection drops — this button used to give up
   * silently: a moment of "loading", then nothing. For most children that is
   * a shrug; for a pre-reader in young mode this button is the only way to
   * play at all, so silence means the quiz is over for them.
   *
   * Every phone and browser ships its own built-in voice. It sounds different
   * on every device, which is exactly why it is not the FIRST choice — but a
   * different voice beats no voice, every time. So: server voice first,
   * device voice as the understudy.
   */
  function speakWithDeviceVoice(myToken: number) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (myToken === tokenRef.current) setState('idle')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-GB'
    utterance.onend = () => { if (myToken === tokenRef.current) setState('idle') }
    utterance.onerror = () => { if (myToken === tokenRef.current) setState('idle') }
    window.speechSynthesis.speak(utterance)
    if (myToken === tokenRef.current) setState('playing')
  }

  useEffect(() => {
    // A fresh question invalidates any in-flight fetch or playing audio for
    // the previous one.
    tokenRef.current += 1
    audioRef.current?.pause()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setState('idle')
  }, [text])

  useEffect(() => () => {
    audioRef.current?.pause()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  function toggle() {
    if (state === 'playing') {
      audioRef.current?.pause()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
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
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(({ url }: { url: string }) => {
        if (myToken !== tokenRef.current) return // stale — question changed mid-fetch
        if (!audioRef.current) audioRef.current = new Audio()
        const audio = audioRef.current
        audio.src = url
        audio.onended = () => { if (myToken === tokenRef.current) setState('idle') }
        audio.onerror = () => { if (myToken === tokenRef.current) setState('idle') }
        audio.play()
          .then(() => { if (myToken === tokenRef.current) setState('playing') })
          .catch(() => speakWithDeviceVoice(myToken))
      })
      .catch(() => speakWithDeviceVoice(myToken))
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
          ? 'bg-maths/15 text-on-maths'
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

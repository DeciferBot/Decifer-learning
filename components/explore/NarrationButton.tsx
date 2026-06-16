'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface NarrationButtonProps {
  text: string
  muted: boolean
  onToggleMute: () => void
  autoPlay?: boolean
  // Fires only when narration plays to its natural end — never on a manual
  // stop, mute, item switch, or unmount. Used to gate Discovery Card drops so
  // a child must actually listen through before earning a card.
  onComplete?: () => void
}

// Narration is synthesised server-side with one fixed OpenAI voice and cached
// in Supabase Storage (see lib/explore/tts.ts + /api/explore/tts). This replaces
// the old Web Speech API path, where each device used whatever voice it had
// installed — the same narration could sound like a warm lady on one phone and
// a robotic man on another. Now every device plays the identical MP3.

// The single audio element currently playing anywhere in the app. Mirrors the
// old global speechSynthesis.cancel() so stopNarration() can silence narration
// on navigation/unmount regardless of which button started it.
let activeAudio: HTMLAudioElement | null = null

function stopActiveAudio() {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.onended = null
    activeAudio.onerror = null
    activeAudio = null
  }
}

export function NarrationButton({ text, muted, onToggleMute, autoPlay = false, onComplete }: NarrationButtonProps) {
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Always hold latest text + muted + onComplete in refs so closures are never stale
  const textRef = useRef(text)
  const mutedRef = useRef(muted)
  const onCompleteRef = useRef(onComplete)
  // Bumped on every (re)start so an in-flight fetch/playback for stale text is
  // ignored and never fires onComplete (mute/switch/stop/unmount all bump it).
  const tokenRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  textRef.current = text
  mutedRef.current = muted
  onCompleteRef.current = onComplete

  // One audio element per button, created lazily on the client only.
  const getAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio()
    return audioRef.current
  }, [])

  const stop = useCallback(() => {
    tokenRef.current += 1 // invalidate any in-flight fetch/playback
    abortRef.current?.abort()
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.onended = null
      audio.onerror = null
    }
    if (activeAudio && activeAudio === audio) activeAudio = null
    if (mountedRef.current) {
      setSpeaking(false)
      setLoading(false)
    }
  }, [])

  // Fetch (or cache-hit) the narration audio for the current text, then play it.
  const speak = useCallback(() => {
    if (mutedRef.current) return
    const myToken = ++tokenRef.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    if (mountedRef.current) setLoading(true)

    fetch('/api/explore/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textRef.current }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`tts ${res.status}`)
        return res.json() as Promise<{ url: string }>
      })
      .then(({ url }) => {
        // Stale (text changed / stopped / muted / unmounted) — drop it silently.
        if (myToken !== tokenRef.current || !mountedRef.current || mutedRef.current) return
        stopActiveAudio()
        const audio = getAudio()
        audio.src = url
        activeAudio = audio
        audio.onended = () => {
          if (activeAudio === audio) activeAudio = null
          if (mountedRef.current) setSpeaking(false)
          // Natural end only — a stop/switch bumps the token first.
          if (myToken === tokenRef.current) onCompleteRef.current?.()
        }
        audio.onerror = () => {
          if (mountedRef.current) { setSpeaking(false); setLoading(false) }
        }
        audio
          .play()
          .then(() => {
            if (myToken === tokenRef.current && mountedRef.current) {
              setSpeaking(true)
              setLoading(false)
            }
          })
          .catch(() => {
            // Autoplay blocked (e.g. iOS before a user gesture) — leave the
            // Listen button so the child can start it with a tap.
            if (mountedRef.current) { setSpeaking(false); setLoading(false) }
          })
      })
      .catch(() => {
        if (mountedRef.current && myToken === tokenRef.current) setLoading(false)
      })
  }, [getAudio])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stop()
    }
  }, [stop])

  // Auto-play when text changes (item switches). Deps: [text] only — intentional.
  // Attempted on every platform; the play() catch handles browsers that block
  // autoplay until a user gesture.
  useEffect(() => {
    if (!autoPlay) return
    const t = setTimeout(speak, 400)
    return () => {
      clearTimeout(t)
      stop()
    }
  }, [text, autoPlay, speak, stop])

  // Stop when muted mid-speech
  useEffect(() => {
    if (muted) stop()
  }, [muted, stop])

  return (
    <div className="flex items-center gap-2">
      {/* Play/stop — tap target wrapped to 48px */}
      <button
        onClick={speaking ? stop : speak}
        className="flex items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-white transition-all active:scale-95"
        style={{
          background: speaking ? 'rgba(108,158,255,0.25)' : 'rgba(255,255,255,0.1)',
          border: speaking ? '1px solid rgba(108,158,255,0.4)' : '1px solid rgba(255,255,255,0.15)',
          minHeight: '48px',
          minWidth: '80px',
        }}
        aria-label={speaking ? 'Stop narration' : 'Play narration'}
      >
        {speaking ? (
          <>
            <Waveform />
            <span>Stop</span>
          </>
        ) : (
          <>
            <span>🔊</span>
            <span>{loading ? 'Loading…' : 'Listen'}</span>
          </>
        )}
      </button>

      {/* Mute toggle — 48×48 tap target */}
      <button
        onClick={onToggleMute}
        className="rounded-full flex items-center justify-center text-sm transition-all"
        style={{
          background: 'rgba(255,255,255,0.08)',
          color: muted ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
          minHeight: '48px',
          minWidth: '48px',
        }}
        aria-label={muted ? 'Unmute narration' : 'Mute narration'}
      >
        {muted ? '🔇' : '🔈'}
      </button>
    </div>
  )
}

function Waveform() {
  return (
    <span className="flex items-center gap-0.5 h-3 mr-1">
      {[0, 1, 2, 3].map(i => (
        <motion.span
          key={i}
          className="block w-0.5 rounded-full bg-blue-300"
          animate={{ height: ['3px', '10px', '3px'] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

export function stopNarration() {
  stopActiveAudio()
}

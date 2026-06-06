'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface NarrationButtonProps {
  text: string
  muted: boolean
  onToggleMute: () => void
  autoPlay?: boolean
}

// Detect iOS Safari — speechSynthesis requires a user gesture there, autoPlay won't work
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function NarrationButton({ text, muted, onToggleMute, autoPlay = false }: NarrationButtonProps) {
  const [speaking, setSpeaking] = useState(false)
  const [supported, setSupported] = useState(false)
  const mountedRef = useRef(true)
  // Always hold latest text + muted in refs so closures are never stale
  const textRef = useRef(text)
  const mutedRef = useRef(muted)
  // Holds any pending voiceschanged listener so it can be cleaned up on unmount
  const voicesHandlerRef = useRef<(() => void) | null>(null)
  textRef.current = text
  mutedRef.current = muted

  useEffect(() => {
    setSupported('speechSynthesis' in window)
    return () => {
      mountedRef.current = false
      // Remove any orphaned voiceschanged listener if component unmounts before voices load
      if (voicesHandlerRef.current) {
        window.speechSynthesis?.removeEventListener('voiceschanged', voicesHandlerRef.current)
        voicesHandlerRef.current = null
      }
    }
  }, [])

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    if (mountedRef.current) setSpeaking(false)
  }, [])

  // Returns a function that speaks the current text. Uses refs so it's always fresh.
  const speakCurrent = useCallback(() => {
    if (!('speechSynthesis' in window) || mutedRef.current) return
    window.speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(textRef.current)
    utter.lang = 'en-GB'
    utter.rate = 0.88
    utter.pitch = 0.82
    utter.volume = 1

    // Pick best UK English voice. Voices may not be ready yet — listen for voiceschanged.
    const assignVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) return
      const ukVoice =
        voices.find(v => v.lang === 'en-GB' && v.name.toLowerCase().includes('daniel')) ||
        voices.find(v => v.lang === 'en-GB' && v.name.toLowerCase().includes('male')) ||
        voices.find(v => v.lang === 'en-GB') ||
        voices.find(v => v.lang.startsWith('en'))
      if (ukVoice) utter.voice = ukVoice
    }

    assignVoice()
    // If voices were empty, wait for voiceschanged (fires once on Chrome/Firefox)
    if (!utter.voice) {
      const handler = () => {
        assignVoice()
        window.speechSynthesis.removeEventListener('voiceschanged', handler)
        voicesHandlerRef.current = null
      }
      voicesHandlerRef.current = handler
      window.speechSynthesis.addEventListener('voiceschanged', handler)
    }

    utter.onstart = () => { if (mountedRef.current) setSpeaking(true) }
    utter.onend = () => { if (mountedRef.current) setSpeaking(false) }
    utter.onerror = () => { if (mountedRef.current) setSpeaking(false) }

    window.speechSynthesis.speak(utter)
  }, []) // stable — reads from refs, no closure over props

  // Auto-play when text changes (planet switches). Deps: [text] only — intentional.
  // Uses refs for muted/speak so no stale-closure risk.
  useEffect(() => {
    // autoPlay is disabled on iOS Safari — requires user gesture
    if (!autoPlay || !supported || isIOS()) return
    const t = setTimeout(speakCurrent, 600)
    return () => {
      clearTimeout(t)
      stop()
    }
  }, [text, autoPlay, supported, speakCurrent, stop])

  // Stop when muted mid-speech
  useEffect(() => {
    if (muted) stop()
  }, [muted, stop])

  if (!supported) return null

  return (
    <div className="flex items-center gap-2">
      {/* Play/stop — tap target wrapped to 48px */}
      <button
        onClick={speaking ? stop : speakCurrent}
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
            <span>Listen</span>
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
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

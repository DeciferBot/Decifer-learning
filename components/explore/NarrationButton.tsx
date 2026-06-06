'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface NarrationButtonProps {
  text: string
  muted: boolean
  onToggleMute: () => void
  autoPlay?: boolean
}

export function NarrationButton({ text, muted, onToggleMute, autoPlay = false }: NarrationButtonProps) {
  const [speaking, setSpeaking] = useState(false)
  const [supported, setSupported] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    setSupported('speechSynthesis' in window)
  }, [])

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
  }, [])

  const speak = useCallback(() => {
    if (!('speechSynthesis' in window) || muted) return
    window.speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-GB'
    utter.rate = 0.88
    utter.pitch = 0.82
    utter.volume = 1

    // Pick best available UK English voice
    const voices = window.speechSynthesis.getVoices()
    const ukVoice =
      voices.find(v => v.lang === 'en-GB' && v.name.toLowerCase().includes('daniel')) ||
      voices.find(v => v.lang === 'en-GB' && !v.name.toLowerCase().includes('female')) ||
      voices.find(v => v.lang === 'en-GB') ||
      voices.find(v => v.lang.startsWith('en'))
    if (ukVoice) utter.voice = ukVoice

    utter.onstart = () => setSpeaking(true)
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)

    utteranceRef.current = utter
    window.speechSynthesis.speak(utter)
  }, [text, muted])

  // Auto-play when text changes (new planet selected) and not muted
  useEffect(() => {
    if (!autoPlay || !supported) return
    // Small delay to let the panel animation settle
    const t = setTimeout(() => { if (!muted) speak() }, 600)
    return () => {
      clearTimeout(t)
      stop()
    }
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stop when muted mid-speech
  useEffect(() => {
    if (muted) stop()
  }, [muted, stop])

  if (!supported) return null

  return (
    <div className="flex items-center gap-2">
      {/* Play/stop button */}
      <button
        onClick={speaking ? stop : speak}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-95"
        style={{
          background: speaking
            ? 'rgba(108,158,255,0.25)'
            : 'rgba(255,255,255,0.1)',
          border: speaking
            ? '1px solid rgba(108,158,255,0.4)'
            : '1px solid rgba(255,255,255,0.15)',
          minHeight: '32px',
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

      {/* Mute toggle */}
      <button
        onClick={() => { stop(); onToggleMute() }}
        className="h-7 w-7 rounded-full flex items-center justify-center text-xs transition-all"
        style={{
          background: 'rgba(255,255,255,0.08)',
          color: muted ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)',
        }}
        aria-label={muted ? 'Unmute narration' : 'Mute narration'}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🔈'}
      </button>
    </div>
  )
}

// Animated waveform icon shown while speaking
function Waveform() {
  return (
    <span className="flex items-center gap-0.5 h-3">
      {[0, 1, 2, 3].map(i => (
        <motion.span
          key={i}
          className="block w-0.5 rounded-full bg-blue-300"
          animate={{ height: ['3px', '10px', '3px'] }}
          transition={{
            duration: 0.7,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  )
}

// Global stop — call this when navigating away
export function stopNarration() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

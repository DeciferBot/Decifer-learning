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

// Detect iOS Safari — speechSynthesis requires a user gesture there, autoPlay won't work
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Rank the available voices for the most natural UK-English read. Quality
// markers ("Enhanced"/"Premium" on Apple, "Natural" on Microsoft, "Neural")
// and Google's network voices sound dramatically more human than the basic
// built-ins — we deliberately do NOT prefer localService, which would exclude
// them. Falls through to any en-GB, then any English voice.
function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null
  const enGB = voices.filter(v => v.lang === 'en-GB')
  const enAny = voices.filter(v => v.lang.toLowerCase().startsWith('en'))
  const isPremium = (v: SpeechSynthesisVoice) => /enhanced|premium|neural|natural/i.test(v.name)
  const isGoogle = (v: SpeechSynthesisVoice) => /google/i.test(v.name)
  const isNamedUK = (v: SpeechSynthesisVoice) =>
    /daniel|arthur|oliver|george|ryan|kate|serena|stephanie|sonia|libby|hazel/i.test(v.name)
  return (
    enGB.find(isPremium) ||
    enGB.find(isGoogle) ||
    enGB.find(isNamedUK) ||
    enGB[0] ||
    enAny.find(isPremium) ||
    enAny.find(isGoogle) ||
    enAny[0] ||
    null
  )
}

// Break narration into sentence-sized chunks. Each becomes its own queued
// utterance, which yields a natural micro-pause between sentences and keeps
// every utterance comfortably under Chrome's ~15s cutoff.
function splitIntoSentences(text: string): string[] {
  const normalised = text.replace(/\s+/g, ' ').trim()
  if (!normalised) return []
  const matches = normalised.match(/[^.!?]+[.!?]+(?:["'”’)\]]+)?|[^.!?]+$/g)
  return (matches ?? [normalised]).map(s => s.trim()).filter(Boolean)
}

export function NarrationButton({ text, muted, onToggleMute, autoPlay = false, onComplete }: NarrationButtonProps) {
  const [speaking, setSpeaking] = useState(false)
  const [supported, setSupported] = useState(false)
  const mountedRef = useRef(true)
  // Always hold latest text + muted + onComplete in refs so closures are never stale
  const textRef = useRef(text)
  const mutedRef = useRef(muted)
  const onCompleteRef = useRef(onComplete)
  // Marks the active utterance as cancelled so its onend (which the browser also
  // fires on cancel()) does NOT count as a natural completion.
  const cancelActiveRef = useRef<(() => void) | null>(null)
  // Holds any pending voiceschanged listener so it can be cleaned up on unmount
  const voicesHandlerRef = useRef<(() => void) | null>(null)
  // Chrome cuts long utterances off after ~15s; a periodic pause()+resume()
  // keeps the queue alive. Cleared whenever speech stops. (chromium #679437)
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  textRef.current = text
  mutedRef.current = muted
  onCompleteRef.current = onComplete

  useEffect(() => {
    setSupported('speechSynthesis' in window)
    return () => {
      mountedRef.current = false
      // Remove any orphaned voiceschanged listener if component unmounts before voices load
      if (voicesHandlerRef.current) {
        window.speechSynthesis?.removeEventListener('voiceschanged', voicesHandlerRef.current)
        voicesHandlerRef.current = null
      }
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current)
        keepAliveRef.current = null
      }
    }
  }, [])

  const clearKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    // Mark the current utterance cancelled before cancelling so its onend is
    // not mistaken for a natural completion.
    cancelActiveRef.current?.()
    clearKeepAlive()
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    if (mountedRef.current) setSpeaking(false)
  }, [clearKeepAlive])

  // Returns a function that speaks the current text. Uses refs so it's always fresh.
  const speakCurrent = useCallback(() => {
    if (!('speechSynthesis' in window) || mutedRef.current) return
    // Suppress completion for any previous utterance before replacing it.
    cancelActiveRef.current?.()
    clearKeepAlive()
    window.speechSynthesis.cancel()

    let cancelled = false
    cancelActiveRef.current = () => { cancelled = true }

    // Speak the text as a queue of per-sentence utterances. Short utterances
    // give more natural cadence (a brief gap between sentences) and avoid
    // Chrome's ~15s long-utterance cutoff. onComplete fires only when the LAST
    // chunk reaches its natural end — never on cancel/mute/switch/unmount.
    const startSpeaking = () => {
      if (cancelled || !mountedRef.current) return
      const voice = pickBestVoice(window.speechSynthesis.getVoices())
      const chunks = splitIntoSentences(textRef.current)
      if (chunks.length === 0) return

      // Keep-alive backstop for Chrome's cutoff bug on any long sentence.
      keepAliveRef.current = setInterval(() => {
        if (cancelled) { clearKeepAlive(); return }
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }, 10000)

      chunks.forEach((chunk, i) => {
        const utter = new SpeechSynthesisUtterance(chunk)
        utter.lang = 'en-GB'
        // Natural defaults: pitch 1 is the platform baseline; a hair under 1.0
        // rate reads a touch slower for children without sounding sedated.
        utter.rate = 0.96
        utter.pitch = 1.0
        utter.volume = 1
        if (voice) utter.voice = voice

        if (i === 0) {
          utter.onstart = () => { if (mountedRef.current && !cancelled) setSpeaking(true) }
        }
        if (i === chunks.length - 1) {
          utter.onend = () => {
            clearKeepAlive()
            if (mountedRef.current) setSpeaking(false)
            // Natural end only — cancelled utterances skip the reward.
            if (!cancelled) onCompleteRef.current?.()
          }
        }
        utter.onerror = () => {
          clearKeepAlive()
          if (mountedRef.current) setSpeaking(false)
        }

        window.speechSynthesis.speak(utter)
      })
    }

    // Voices may not be ready yet — wait for voiceschanged (fires once on
    // Chrome/Firefox) so we don't fall back to a worse default voice.
    if (window.speechSynthesis.getVoices().length === 0) {
      const handler = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handler)
        voicesHandlerRef.current = null
        startSpeaking()
      }
      voicesHandlerRef.current = handler
      window.speechSynthesis.addEventListener('voiceschanged', handler)
    } else {
      startSpeaking()
    }
  }, [clearKeepAlive]) // stable — reads from refs

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

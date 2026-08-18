// Sound and haptics for the child loop.
//
// Until now there was no audio and no vibration anywhere a child touches: a
// grep for `new Audio`, `AudioContext`, `navigator.vibrate`, `.mp3` and `.wav`
// across app/, lib/ and components/ returned exactly one hit, the Explore
// narration player. Every correct answer in Decifer was silent, which is a large
// part of why it reads as a worksheet and Duolingo reads as a game.
//
// Tones are synthesised with the Web Audio API rather than shipped as files:
// no asset to download, nothing for the service worker to cache, nothing for the
// CSP to block, and it works offline on the first run.
//
// Everything here is best-effort. A browser with no Web Audio, no vibration, or
// a suspended audio context must degrade to silence, never to an error.

export type FeedbackKind =
  | 'correct'
  | 'incorrect'
  | 'combo'
  | 'roundComplete'
  | 'cardReveal'
  | 'tick'

const SOUND_KEY = 'decifer:sound'

/** A note in a cue: frequency in Hz, start offset and duration in seconds. */
type Note = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number }

// Warm, short, and firmly in the "toy" register. The incorrect cue is
// deliberately gentle and low rather than a buzzer: a child hears it six times
// in ten and it must not feel like a telling-off.
const CUES: Record<FeedbackKind, Note[]> = {
  correct: [
    { freq: 660, at: 0, dur: 0.09 },
    { freq: 880, at: 0.07, dur: 0.14 },
  ],
  incorrect: [
    { freq: 300, at: 0, dur: 0.13, type: 'sine', gain: 0.16 },
    { freq: 240, at: 0.1, dur: 0.16, type: 'sine', gain: 0.16 },
  ],
  combo: [
    { freq: 660, at: 0, dur: 0.07 },
    { freq: 880, at: 0.06, dur: 0.07 },
    { freq: 1175, at: 0.12, dur: 0.18 },
  ],
  roundComplete: [
    { freq: 523, at: 0, dur: 0.11 },
    { freq: 659, at: 0.09, dur: 0.11 },
    { freq: 784, at: 0.18, dur: 0.11 },
    { freq: 1047, at: 0.27, dur: 0.26 },
  ],
  cardReveal: [
    { freq: 784, at: 0, dur: 0.08, type: 'triangle' },
    { freq: 1047, at: 0.07, dur: 0.08, type: 'triangle' },
    { freq: 1319, at: 0.14, dur: 0.24, type: 'triangle' },
  ],
  // A quiet countdown pulse for the last few seconds of a timed round. Kept
  // deliberately soft — this marks urgency, it must not read as an alarm.
  tick: [
    { freq: 900, at: 0, dur: 0.045, type: 'square', gain: 0.06 },
  ],
}

// Short taps only. A long buzz on a wrong answer would read as a punishment.
const HAPTICS: Record<FeedbackKind, number | number[]> = {
  correct: 12,
  incorrect: [8, 40, 8],
  combo: [10, 30, 10, 30, 18],
  roundComplete: [14, 40, 14],
  cardReveal: [10, 30, 24],
  tick: 6,
}

let ctx: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    // Browsers suspend the context until a user gesture. Every cue here is
    // triggered by a tap, so resuming at play time is the right moment.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

/** Whether cue sounds are on. Defaults to on; the child can mute in the quiz. */
export function isSoundOn(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    // Private mode or blocked storage: fall back to on rather than to broken.
    return true
  }
}

export function setSoundOn(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // Nothing to do — the preference simply will not persist.
  }
}

/**
 * True when the viewer has asked the OS to reduce motion. Haptics are a physical
 * motion cue, so this mutes them along with the animations.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function playCue(kind: FeedbackKind): void {
  const ac = audioContext()
  if (!ac) return
  const now = ac.currentTime
  for (const note of CUES[kind]) {
    try {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = note.type ?? 'sine'
      osc.frequency.value = note.freq
      // Ramp in and out so the cue never clicks.
      const peak = note.gain ?? 0.13
      gain.gain.setValueAtTime(0.0001, now + note.at)
      gain.gain.exponentialRampToValueAtTime(peak, now + note.at + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.dur)
      osc.connect(gain).connect(ac.destination)
      osc.start(now + note.at)
      osc.stop(now + note.at + note.dur + 0.02)
    } catch {
      // One bad note must not stop the rest of the cue.
    }
  }
}

function buzz(kind: FeedbackKind): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  if (prefersReducedMotion()) return
  try {
    navigator.vibrate(HAPTICS[kind])
  } catch {
    // iOS Safari has no Vibration API; this is a no-op there by design.
  }
}

/**
 * Fire the sound and haptic cue for a moment in the quiz.
 *
 * Safe to call from anywhere: it does nothing on the server, does nothing when
 * the child has muted, and never throws.
 */
export function fireFeedback(kind: FeedbackKind): void {
  if (typeof window === 'undefined') return
  if (!isSoundOn()) {
    // Muting the sound does not mute the phone: a silent tap is still useful
    // feedback, and it is the only cue left for a child playing with the volume
    // down. Reduced motion still suppresses it inside buzz().
    buzz(kind)
    return
  }
  playCue(kind)
  buzz(kind)
}

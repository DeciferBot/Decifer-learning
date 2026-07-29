'use client'

import { useEffect, useState } from 'react'
import { isSoundOn, setSoundOn, fireFeedback } from '@/lib/feedback'
import { Volume2, VolumeX } from '@/components/ui/icons'

/**
 * Mute control for the quiz cue sounds.
 *
 * Sits in the quiz header, in the space hearts used to occupy. Reads its initial
 * value after mount rather than during render, because localStorage is not
 * available on the server and a mismatch would hydrate wrong.
 */
export function SoundToggle() {
  const [on, setOn] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setOn(isSoundOn())
    setReady(true)
  }, [])

  function toggle() {
    const next = !on
    setOn(next)
    setSoundOn(next)
    // Play the cue when switching on, so the child hears what they just chose.
    if (next) fireFeedback('correct')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'Turn quiz sounds off' : 'Turn quiz sounds on'}
      title={on ? 'Sounds on' : 'Sounds off'}
      className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-muted transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {/* Render the "on" icon until mounted so the button never flips on hydrate. */}
      {!ready || on
        ? <Volume2 className="w-5 h-5" aria-hidden />
        : <VolumeX className="w-5 h-5" aria-hidden />}
    </button>
  )
}

'use client'

import { Stars } from '@react-three/drei'

interface StarfieldProps {
  count: number
  radius: number
  depth: number
  reducedMotion: boolean
}

/**
 * Calm background starfield. drei <Stars> is a single Points object (one draw
 * call), so even a few thousand stars are cheap. Motion is disabled when the
 * user prefers reduced motion.
 */
export function Starfield({ count, radius, depth, reducedMotion }: StarfieldProps) {
  return (
    <Stars
      radius={radius}
      depth={depth}
      count={count}
      factor={4}
      saturation={0.3}
      fade
      speed={reducedMotion ? 0 : 0.5}
    />
  )
}

'use client'

import { MotionConfig } from 'framer-motion'

/**
 * App-wide framer-motion config. reducedMotion="user" disables transform and
 * layout animations (keeping opacity fades) for children whose device has
 * "Reduce Motion" turned on — vestibular and sensory-sensitivity support.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

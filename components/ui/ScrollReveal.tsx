'use client'

import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'

interface ScrollRevealProps {
  children: React.ReactNode
  delay?: number
  className?: string
}

/**
 * Reveals children when they enter the viewport.
 * Respects prefers-reduced-motion — falls back to instant show.
 * Uses Framer Motion's useInView with once:true so elements stay visible.
 *
 * When reduced motion is preferred, the element is always visible immediately
 * with no translate or opacity animation. We keep motion.div in both paths to
 * avoid a server/client hydration mismatch.
 */
export function ScrollReveal({ children, delay = 0, className }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      ref={ref}
      // When reduced motion is preferred: start at the final visible state
      // (initial=false) and animate with zero duration — no movement, no flash.
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={
        prefersReducedMotion || isInView
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: 20 }
      }
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }
      }
      className={className}
    >
      {children}
    </motion.div>
  )
}

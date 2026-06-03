'use client'

import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'

interface ScrollRevealProps {
  children: React.ReactNode
  delay?: number
  className?: string
}

/**
 * Reveals children when they enter the viewport.
 *
 * SSR / first-paint: element is visible at opacity:1 (initial=false skips
 * the hidden state). After hydration, below-fold elements instantly hide
 * (duration:0) then animate in when scrolled into view. This prevents
 * Lighthouse from seeing opacity:0 in the initial paint, which tanks
 * Speed Index and LCP element-render-delay.
 *
 * Respects prefers-reduced-motion — skips all animation.
 */
export function ScrollReveal({ children, delay = 0, className }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  const prefersReducedMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const visible = { opacity: 1, y: 0 }
  const hidden = { opacity: 0, y: 20 }

  return (
    <motion.div
      ref={ref}
      // initial=false: Framer skips the initial state entirely and renders at
      // the animate target — which on first render is `visible` (opacity:1).
      // No inline opacity:0 ever appears in SSR HTML.
      initial={false}
      animate={
        !mounted || prefersReducedMotion || isInView ? visible : hidden
      }
      transition={
        // No animation before mount (SSR consistency) or when reduced motion.
        // Instant hide for below-fold elements after mount.
        // Smooth reveal when entering viewport.
        !mounted || prefersReducedMotion
          ? { duration: 0 }
          : isInView
            ? { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }
            : { duration: 0 }
      }
      className={className}
    >
      {children}
    </motion.div>
  )
}

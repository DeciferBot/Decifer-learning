'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * A short confetti burst behind the result card.
 *
 * The pass screen previously scaled a card in and stopped there, so the biggest
 * moment in the loop was the quietest thing on screen. Drawn as absolutely
 * positioned divs rather than a canvas or a library: a couple of dozen elements
 * for one second costs nothing and adds no dependency.
 *
 * Fully suppressed under prefers-reduced-motion, where the result card's own
 * fade is the whole celebration.
 */

const COLOURS = ['#FFC107', '#6C9EFF', '#52D9A0', '#FF8FAB', '#FFD43B', '#A78BFA']
const PIECES = 26

type Piece = { left: number; delay: number; drift: number; rotate: number; colour: string; size: number }

function buildPieces(): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => ({
    left: (i / PIECES) * 100 + (i % 3) * 4,
    delay: (i % 7) * 0.05,
    drift: ((i % 5) - 2) * 22,
    rotate: (i % 2 === 0 ? 1 : -1) * (120 + (i % 4) * 60),
    colour: COLOURS[i % COLOURS.length],
    size: i % 3 === 0 ? 10 : 7,
  }))
}

export function WinBurst() {
  const reduceMotion = useReducedMotion()
  // Built after mount so the piece layout never differs between server and client.
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    setPieces(buildPieces())
  }, [])

  if (reduceMotion || pieces.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden"
      aria-hidden
    >
      {pieces.map((p, i) => (
        <motion.div
          key={i}
          initial={{ y: -20, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 240, x: p.drift, opacity: 0, rotate: p.rotate }}
          transition={{ duration: 1.1, delay: p.delay, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            borderRadius: 2,
            background: p.colour,
          }}
        />
      ))}
    </div>
  )
}

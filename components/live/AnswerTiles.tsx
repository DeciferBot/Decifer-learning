'use client'

import { motion } from 'framer-motion'
import { Check, X } from '@/components/ui/icons'

// Kahoot-style coloured/shaped answer tiles. Four fixed colour+shape pairs so
// kids can answer by colour/shape, not just by reading. Each tile has a darker
// bottom "lip" for a tactile, pressable feel, and per-tile text colour so the
// amber tile stays AA-legible (dark text, not white).
const TILES = [
  { bg: '#F0506E', lip: '#C7374F', text: '#FFFFFF', shape: '▲' },
  { bg: '#4C8DFF', lip: '#2E6AD6', text: '#FFFFFF', shape: '◆' },
  { bg: '#FFC53D', lip: '#E0A100', text: '#3A2E00', shape: '●' },
  { bg: '#2FBF87', lip: '#1E9C6C', text: '#FFFFFF', shape: '■' },
] as const

export function AnswerTiles({
  choices,
  disabled,
  selected,
  correctAnswer,
  onPick,
}: {
  choices: string[]
  disabled: boolean
  selected: string | null
  correctAnswer: string | null // set only after the player is locked in / time's up
  onPick: (choice: string) => void
}) {
  const revealed = correctAnswer !== null
  const norm = (s: string) => s.trim().toLowerCase()

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {choices.map((choice, i) => {
        const tile = TILES[i % TILES.length]
        const isCorrect = revealed && norm(choice) === norm(correctAnswer)
        const isMine = selected !== null && norm(choice) === norm(selected)
        const dim = revealed && !isCorrect && !isMine

        return (
          <motion.button
            key={`${choice}-${i}`}
            whileHover={disabled ? undefined : { y: -2 }}
            whileTap={disabled ? undefined : { y: 2, scale: 0.99 }}
            disabled={disabled}
            onClick={() => onPick(choice)}
            aria-pressed={isMine}
            animate={{
              opacity: dim ? 0.35 : 1,
              scale: revealed && isCorrect ? 1.015 : 1,
            }}
            className="relative flex min-h-[68px] items-center gap-3.5 rounded-2xl px-5 py-4 text-left font-heading text-lg font-extrabold transition-[filter] disabled:cursor-default"
            style={{
              backgroundColor: tile.bg,
              color: tile.text,
              // tactile lip + soft drop shadow; brighten the correct tile
              boxShadow: isCorrect
                ? `inset 0 -5px 0 ${tile.lip}, 0 0 0 4px rgba(255,255,255,0.95), 0 10px 24px -8px ${tile.bg}`
                : isMine
                  ? `inset 0 -5px 0 ${tile.lip}, 0 0 0 4px rgba(255,255,255,0.9)`
                  : `inset 0 -5px 0 ${tile.lip}, 0 8px 18px -10px rgba(0,0,0,0.35)`,
            }}
          >
            <span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xl leading-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
            >
              {tile.shape}
            </span>
            <span className="flex-1 leading-snug">{choice}</span>
            {isCorrect ? (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/90">
                <Check className="h-5 w-5" style={{ color: tile.lip }} />
              </span>
            ) : revealed && isMine ? (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/20">
                <X className="h-5 w-5" />
              </span>
            ) : null}
          </motion.button>
        )
      })}
    </div>
  )
}

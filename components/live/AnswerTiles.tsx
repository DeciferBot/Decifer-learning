'use client'

import { motion } from 'framer-motion'
import { Check, X } from '@/components/ui/icons'

// Kahoot-style coloured/shaped answer tiles. Four fixed colour+shape pairs so
// kids can answer by colour/shape, not just by reading.
const TILES = [
  { bg: '#FF6B6B', shape: '▲' },
  { bg: '#6C9EFF', shape: '◆' },
  { bg: '#FFD43B', shape: '●' },
  { bg: '#52D9A0', shape: '■' },
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
            whileTap={disabled ? undefined : { scale: 0.96 }}
            disabled={disabled}
            onClick={() => onPick(choice)}
            aria-pressed={isMine}
            className="relative flex min-h-[64px] items-center gap-3 rounded-2xl px-4 py-4 text-left font-heading text-base font-bold text-white shadow-sm transition disabled:cursor-default"
            style={{
              backgroundColor: tile.bg,
              opacity: dim ? 0.4 : 1,
              outline: isMine ? '4px solid rgba(255,255,255,0.9)' : 'none',
              outlineOffset: -4,
            }}
          >
            <span aria-hidden className="text-2xl leading-none">
              {tile.shape}
            </span>
            <span className="flex-1">{choice}</span>
            {isCorrect ? (
              <Check className="h-6 w-6 shrink-0" />
            ) : revealed && isMine ? (
              <X className="h-6 w-6 shrink-0" />
            ) : null}
          </motion.button>
        )
      })}
    </div>
  )
}

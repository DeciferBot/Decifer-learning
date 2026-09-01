'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from '@/components/ui/icons'

/**
 * "Match each word to its root word." The child pairs a card on the left with a
 * card on the right.
 *
 * TAPPING, NOT DRAGGING. Dragging is the obvious way to build this and the wrong
 * one: it fails on a touch screen the moment a finger wanders, it cannot be done
 * with a keyboard at all, and a child using a screen reader has no way in. So a
 * pair is made by tapping the left card, then tapping the right one. That is one
 * button press each, which every child can do by any means they use — finger,
 * mouse, keyboard or switch.
 *
 * The right-hand cards are shuffled once on load, so the answer is never simply
 * the row opposite. Shuffling is seeded off the pairs themselves rather than the
 * clock, so the same question looks the same each time a child sees it and the
 * server and browser cannot disagree about the order.
 */

export type MatchPair = {
  left: string
  right: string
}

type Props = {
  pairs: MatchPair[]
  onAnswer: (result: {
    allCorrect: boolean
    correctCount: number
    totalCount: number
    childAnswer?: string
  }) => void
  disabled: boolean
}

/** Same input, same order, every time — and never the order they were given in. */
function stableShuffle(values: string[]): string[] {
  return [...values]
    .map((v) => {
      let h = 0
      for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0
      return { v, h }
    })
    .sort((a, b) => a.h - b.h || a.v.localeCompare(b.v))
    .map((x) => x.v)
}

export function MatchPairs({ pairs, onAnswer, disabled }: Props) {
  const rights = useMemo(() => stableShuffle(pairs.map((p) => p.right)), [pairs])

  // left card text -> right card text the child put with it
  const [joined, setJoined] = useState<Record<string, string>>({})
  const [pickedLeft, setPickedLeft] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const usedRights = new Set(Object.values(joined))
  const allJoined = pairs.every((p) => joined[p.left])

  function tapLeft(left: string) {
    if (submitted || disabled) return
    // Tapping a card that is already paired takes the pair apart again, so a
    // child can change their mind without starting over.
    if (joined[left]) {
      setJoined(({ [left]: _removed, ...rest }) => rest)
      setPickedLeft(left)
      return
    }
    setPickedLeft((cur) => (cur === left ? null : left))
  }

  function tapRight(right: string) {
    if (submitted || disabled) return
    if (usedRights.has(right)) {
      // Free it from whichever left card is holding it.
      const owner = Object.keys(joined).find((k) => joined[k] === right)
      if (owner) setJoined(({ [owner]: _removed, ...rest }) => rest)
      return
    }
    if (!pickedLeft) return
    setJoined((prev) => ({ ...prev, [pickedLeft]: right }))
    setPickedLeft(null)
  }

  function submit() {
    if (!allJoined || submitted || disabled) return
    const correctCount = pairs.filter((p) => joined[p.left] === p.right).length
    setSubmitted(true)
    onAnswer({
      allCorrect: correctCount === pairs.length,
      correctCount,
      totalCount: pairs.length,
      childAnswer: pairs.map((p) => `${p.left}=${joined[p.left] ?? ''}`).join('; '),
    })
  }

  const cardBase =
    'min-h-[48px] w-full rounded-xl border-2 px-3 py-2 text-left text-sm font-bold ' +
    'leading-snug transition-colors focus-visible:outline focus-visible:outline-2 ' +
    'focus-visible:outline-offset-2 focus-visible:outline-ink'

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted">
        {submitted
          ? 'Here is how you did.'
          : pickedLeft
            ? 'Now tap what it goes with.'
            : 'Tap something on the left, then tap what it goes with.'}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Left column */}
        <div className="space-y-3">
          {pairs.map((p, i) => {
            const partner = joined[p.left]
            const right = submitted ? partner === p.right : null
            let cls = cardBase
            if (submitted) {
              cls += right
                ? ' border-correct bg-correct/15 text-correct-700'
                : ' border-incorrect bg-incorrect/15 text-rose-700'
            } else if (pickedLeft === p.left) {
              cls += ' border-brand bg-brand/15 text-ink'
            } else if (partner) {
              cls += ' border-brand/40 bg-brand/8 text-ink'
            } else {
              cls += ' border-black/10 bg-background text-ink hover:border-brand'
            }

            return (
              <motion.button
                key={p.left}
                type="button"
                onClick={() => tapLeft(p.left)}
                disabled={submitted || disabled}
                whileTap={submitted || disabled ? {} : { scale: 0.97 }}
                aria-pressed={pickedLeft === p.left}
                aria-label={
                  partner
                    ? `${p.left}, paired with ${partner}. Tap to undo.`
                    : `${p.left}, item ${i + 1}. Tap to choose it.`
                }
                className={cls}
              >
                {p.left}
                {partner && (
                  <span className="mt-1 block text-xs font-normal text-muted">
                    → {partner}
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>

        {/* Right column, shuffled */}
        <div className="space-y-3">
          {rights.map((r) => {
            const taken = usedRights.has(r)
            let cls = cardBase
            if (submitted) {
              cls += ' border-black/10 bg-background text-muted'
            } else if (taken) {
              cls += ' border-brand/40 bg-brand/8 text-muted'
            } else if (pickedLeft) {
              cls += ' border-black/10 bg-background text-ink hover:border-brand'
            } else {
              cls += ' border-black/10 bg-background text-ink'
            }

            return (
              <motion.button
                key={r}
                type="button"
                onClick={() => tapRight(r)}
                disabled={submitted || disabled}
                whileTap={submitted || disabled ? {} : { scale: 0.97 }}
                aria-label={taken ? `${r}, already used. Tap to free it.` : r}
                className={cls}
              >
                {r}
              </motion.button>
            )
          })}
        </div>
      </div>

      {submitted && (
        <div role="status" aria-live="polite" className="space-y-1">
          {pairs
            .filter((p) => joined[p.left] !== p.right)
            .map((p) => (
              <p key={p.left} className="text-sm text-muted">
                <span className="font-bold text-ink">{p.left}</span> goes with{' '}
                <span className="font-bold text-ink">{p.right}</span>
              </p>
            ))}
        </div>
      )}

      {!submitted && (
        <motion.button
          type="button"
          onClick={submit}
          disabled={!allJoined || disabled}
          whileTap={!allJoined || disabled ? {} : { scale: 0.97 }}
          className="min-h-[56px] w-full rounded-xl border-2 border-brand bg-brand
            font-heading text-lg font-bold text-white transition-colors hover:bg-brand/90
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-ink disabled:opacity-40"
        >
          {allJoined ? (
            <span className="flex items-center justify-center gap-1">
              <Check className="h-5 w-5" aria-hidden /> Check my pairs
            </span>
          ) : (
            'Pair them all up first'
          )}
        </motion.button>
      )}
    </div>
  )
}

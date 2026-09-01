'use client'

import { useId, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from '@/components/ui/icons'

/**
 * A question the child answers by typing rather than by picking.
 *
 * Oak National Academy writes about 7,000 of these, and until now every one was
 * thrown away because our quiz only offered four buttons. They are the questions
 * where seeing the answer written down would give it away: "what number comes
 * next? 9, 10, 11, __".
 *
 * Oak supplies EVERY spelling it will accept — "12", "12.", "twelve", "Twelve" —
 * so this never has to guess. It compares against all of them after tidying up
 * the differences that should not cost a child a mark: capitals, stray spaces, a
 * full stop on the end, curly apostrophes, and the commas inside big numbers.
 */

export type AcceptedAnswer = { accept: string }

type Props = {
  /** Every spelling counted as right. The first is the one shown afterwards. */
  accepted: AcceptedAnswer[]
  /** Called on each try. `matched` is the tidy form when right, else what they typed. */
  onSubmit: (result: { correct: boolean; matched: string }) => void
  disabled: boolean
  /** Bigger type and a bigger box for the youngest children. */
  young?: boolean
}

/** Differences that should never cost a mark. */
function tidy(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")      // curly apostrophes typed as straight ones
    .replace(/[“”]/g, '"')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')   // 1,000 and 1000 are the same number
    .replace(/[.!?]+$/, '')               // a full stop on the end
    .replace(/\s+/g, ' ')
    .trim()
}

export function TypeAnswer({ accepted, onSubmit, disabled, young = false }: Props) {
  // A name unique to this box. A fixed one would collide the moment two
  // questions were ever on screen together, and then the label would point at the
  // wrong box for anyone using a screen reader.
  const inputId = useId()
  const [text, setText] = useState('')
  const [lastWrong, setLastWrong] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const answers = accepted.map((a) => a.accept).filter(Boolean)
  const shownAnswer = answers[0] ?? ''

  function check() {
    if (disabled) return
    const typed = text.trim()
    if (!typed) return
    const correct = answers.some((a) => tidy(a) === tidy(typed))
    if (!correct) {
      setLastWrong(typed)
      setText('')
      inputRef.current?.focus()
    }
    onSubmit({ correct, matched: correct ? shownAnswer : typed })
  }

  return (
    <div className="mt-4 space-y-3">
      <label
        htmlFor={inputId}
        className="block text-sm font-bold text-muted"
      >
        Type your answer
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              check()
            }
          }}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          // A child answering "12" should get the number pad, not the alphabet.
          inputMode={answers.every((a) => /^[\d\s.,:/-]+$/.test(a)) ? 'decimal' : 'text'}
          placeholder="Your answer"
          className={`w-full flex-1 rounded-xl border-2 border-black/10 bg-background px-4
            font-heading font-bold text-ink placeholder:font-body placeholder:font-normal
            placeholder:text-muted focus-visible:border-brand focus-visible:outline
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink
            disabled:opacity-60 ${young ? 'min-h-[64px] text-xl' : 'min-h-[56px] text-lg'}`}
        />

        <motion.button
          type="button"
          onClick={check}
          disabled={disabled || !text.trim()}
          whileTap={disabled || !text.trim() ? {} : { scale: 0.97 }}
          className={`shrink-0 rounded-xl border-2 border-brand bg-brand px-6 font-heading
            font-bold text-white transition-colors hover:bg-brand/90
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-ink disabled:opacity-40
            ${young ? 'min-h-[64px] text-xl' : 'min-h-[56px] text-lg'}`}
        >
          Check
        </motion.button>
      </div>

      {/* Said out loud to a child using a screen reader, not just shown. */}
      <div role="status" aria-live="polite" className="min-h-[20px]">
        {disabled && (
          <p className="flex items-center gap-1 text-sm font-bold text-correct-700">
            <Check className="h-4 w-4" aria-hidden /> The answer is {shownAnswer}
          </p>
        )}
        {!disabled && lastWrong && (
          <p className="text-sm text-muted">
            You tried &ldquo;{lastWrong}&rdquo;. Have another go.
          </p>
        )}
      </div>
    </div>
  )
}
